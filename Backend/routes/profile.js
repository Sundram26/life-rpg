import { Router }              from 'express';
import { getDb, COLLECTIONS } from '../config/firebase.js';
import { LOAN } from '../config/gameConstants.js';
import { ok, err, computeDecay, calcLoanBalance } from '../utils/helpers.js';
import { authenticate }       from '../middleware/auth.js';
import { asyncHandler }       from '../middleware/errorHandler.js';

const router = Router();

// ─── GET /profile ────────────────────────────────────────────────────────────

/**
 * Returns a complete profile snapshot for the authenticated user:
 *   - Character info (level, XP, class, title, streak)
 *   - All four stats (with current values + decay warning if applicable)
 *   - Credits balance + weekly summary
 *   - Active loan (if any) with current balance including accrued interest
 *   - Recent tasks (last 10)
 *   - Achievement progress (unlocked count + latest)
 *   - Leaderboard rank (weekly)
 *
 * Auth: Bearer <Firebase ID token>
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const uid = req.user.uid;
    const db  = getDb();

    // Fetch all profile data in parallel
    const [
      userSnap,
      statsSnap,
      creditsSnap,
      tasksSnap,
      loanSnap,
      lbSnap,
      achievementsSnap,
    ] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(uid).get(),

      db.collection(COLLECTIONS.STATS).doc(uid).get(),

      db.collection(COLLECTIONS.CREDITS).doc(uid).get(),

      db.collection(COLLECTIONS.TASKS)
        .where('user_id', '==', uid)
        .orderBy('completed_at', 'desc')
        .limit(10)
        .get(),

      db.collection(COLLECTIONS.LOANS)
        .where('user_id', '==', uid)
        .where('status', 'in', ['active', 'defaulted'])
        .limit(1)
        .get(),

      db.collection(COLLECTIONS.LEADERBOARD)
        .doc(`${uid}_weekly`)
        .get(),

      db.collection(COLLECTIONS.USER_ACHIEVEMENTS)
        .where('user_id', '==', uid)
        .where('unlocked', '==', true)
        .orderBy('unlocked_at', 'desc')
        .limit(5)
        .get(),
    ]);

    if (!userSnap.exists) return err(res, 'User not found', 404);

    const user    = userSnap.data();
    const stats   = statsSnap.exists   ? statsSnap.data()   : null;
    const credits = creditsSnap.exists ? creditsSnap.data() : null;

    // ── Stat decay warning ───────────────────────────────────────────────
    let decayWarning = null;
    if (stats && user.last_active_date) {
      const daysSince = Math.floor(
        (Date.now() - user.last_active_date.toMillis()) / 86_400_000
      );
      if (daysSince >= 2) {
        decayWarning = {
          days_inactive: daysSince,
          decay_starts_in: Math.max(0, 3 - daysSince),
          message: daysSince >= 3
            ? 'Stats are decaying! Complete a task to stop the damage.'
            : `Stats start decaying in ${3 - daysSince} day(s).`,
        };
      }
    }

    // ── Active loan with live interest ───────────────────────────────────
    let activeLoan = null;
    if (!loanSnap.empty) {
      const loanData     = loanSnap.docs[0].data();
      const liveBalance  = calcLoanBalance(loanData.principal, loanData.issued_at);
      const daysOverdue  = Math.max(
        0,
        Math.floor((Date.now() - loanData.due_date.toMillis()) / 86_400_000)
      );
      const defaultsAt   = loanData.principal * LOAN.DEFAULT_MULT;

      activeLoan = {
        id:               loanData.id,
        principal:        loanData.principal,
        current_balance:  liveBalance,
        repaid_amount:    loanData.repaid_amount,
        status:           loanData.status,
        due_date:         loanData.due_date.toDate(),
        days_overdue:     daysOverdue,
        defaults_at:      defaultsAt,
        danger_level:     liveBalance >= defaultsAt * 0.8 ? 'critical'
                        : liveBalance >= defaultsAt * 0.5 ? 'warning'
                        : 'ok',
        repay_progress:   Math.round((loanData.repaid_amount / loanData.principal) * 100),
      };
    }

    // ── Recent tasks ─────────────────────────────────────────────────────
    const recentTasks = tasksSnap.docs.map(d => {
      const t = d.data();
      return {
        id:              t.id,
        name:            t.name,
        stat_affected:   t.stat_affected,
        difficulty:      t.difficulty,
        xp_awarded:      t.xp_awarded,
        credits_awarded: t.credits_awarded,
        net_credits:     t.net_credits,
        completed_at:    t.completed_at?.toDate(),
      };
    });

    // ── Leaderboard rank ─────────────────────────────────────────────────
    const lbData = lbSnap.exists ? lbSnap.data() : null;

    // ── Achievements ─────────────────────────────────────────────────────
    const recentAchievements = achievementsSnap.docs.map(d => ({
      achievement_id: d.data().achievement_id,
      unlocked_at:    d.data().unlocked_at?.toDate(),
    }));

    return ok(res, {
      character: {
        uid,
        username:            user.username,
        avatar_emoji:        user.avatar_emoji,
        class:               user.class,
        level:               user.level,
        xp:                  user.xp,
        xp_to_next_level:    user.xp_to_next_level,
        xp_progress_pct:     Math.round((user.xp / user.xp_to_next_level) * 100),
        title:               user.title,
        streak_days:         user.streak_days,
        streak_shield_active: user.streak_shield_active,
        tasks_completed:     user.tasks_completed,
        last_active:         user.last_active_date?.toDate(),
        created_at:          user.created_at?.toDate(),
        decay_warning:       decayWarning,
      },
      stats: stats ? {
        intelligence:          stats.intelligence,
        strength:              stats.strength,
        discipline:            stats.discipline,
        social:                stats.social,
        intelligence_lifetime: stats.intelligence_lifetime,
        strength_lifetime:     stats.strength_lifetime,
        discipline_lifetime:   stats.discipline_lifetime,
        social_lifetime:       stats.social_lifetime,
      } : null,
      credits: credits ? {
        balance:         credits.balance,
        lifetime_earned: credits.lifetime_earned,
        lifetime_spent:  credits.lifetime_spent,
        weekly_earned:   credits.weekly_earned,
        week_start:      credits.week_start?.toDate(),
      } : null,
      active_loan:          activeLoan,
      recent_tasks:         recentTasks,
      leaderboard: lbData ? {
        weekly_score:    lbData.score,
        weekly_rank:     lbData.rank,
        tasks_this_week: lbData.tasks_completed,
      } : null,
      recent_achievements:  recentAchievements,
    });
  }),
);

export default router;
