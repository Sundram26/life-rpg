import { Router }                   from 'express';
import { body, validationResult }   from 'express-validator';
import admin                        from 'firebase-admin';
import { getDb, COLLECTIONS }       from '../config/firebase.js';
import {
  DIFFICULTY, STAT_KEYS,
  xpToNextLevel, getTitleForLevel,
} from '../config/gameConstants.js';
import {
  ok, err,
  computeXpAward, computeCreditsAward, computeStatGain,
  resolveLevelUp, loanRepaymentSlice, refreshLeaderboardScore,
  buildCreditTxPayload, todayString,
} from '../utils/helpers.js';
import { authenticate }             from '../middleware/auth.js';
import { asyncHandler }             from '../middleware/errorHandler.js';

const router   = Router();
const { FieldValue, Timestamp } = admin.firestore;

// ─── VALIDATION ─────────────────────────────────────────────────────────────

const addTaskValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Task name must be 2–120 characters'),

  body('statAffected')
    .isIn(STAT_KEYS)
    .withMessage(`Stat must be one of: ${STAT_KEYS.join(', ')}`),

  body('difficulty')
    .isIn(Object.keys(DIFFICULTY))
    .withMessage(`Difficulty must be one of: ${Object.keys(DIFFICULTY).join(', ')}`),

  body('source')
    .optional()
    .isIn(['daily', 'custom', 'class'])
    .withMessage('Source must be daily, custom, or class'),

  body('baseXp')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('baseXp must be 1–500'),

  body('baseCredits')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('baseCredits must be 1–500'),

  body('questDate')
    .optional()
    .isDate()
    .withMessage('questDate must be YYYY-MM-DD'),
];

// ─── POST /addTask ───────────────────────────────────────────────────────────

/**
 * Logs a completed task for the authenticated user.
 *
 * Steps (inside a single Firestore transaction):
 *   1. Load user, stats, credits — abort if any loan is defaulted
 *   2. Calculate XP and credits with class/streak/difficulty multipliers
 *   3. Apply loan repayment slice (60% of credits) if active loan exists
 *   4. Level-up check — can level up multiple times in one call
 *   5. Stat gain — cap at 100
 *   6. Write task document
 *   7. Update user (xp, level, streak, title)
 *   8. Update stats
 *   9. Update credits balance + write transaction record
 *  10. Refresh leaderboard score
 *
 * Body: { name, statAffected, difficulty, source?, baseXp?, baseCredits?, questDate? }
 * Auth: Bearer <Firebase ID token>
 */
router.post(
  '/',
  authenticate,
  addTaskValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return err(res, 'Validation failed', 400, errors.array());
    }

    const uid = req.user.uid;
    const db  = getDb();
    const {
      name,
      statAffected,
      difficulty,
      source       = 'custom',
      questDate    = todayString(),
      aiNotes      = null,
      aiEvaluated  = false,
    } = req.body;

    // Use caller-supplied base values or fall back to difficulty defaults
    const baseXp      = Math.min(req.body.baseXp      ?? DIFFICULTY[difficulty].base_xp,      500);
    const baseCredits = Math.min(req.body.baseCredits  ?? DIFFICULTY[difficulty].base_credits, 500);

    // ── Firestore transaction ────────────────────────────────────────────────
    const result = await db.runTransaction(async (tx) => {

      // Fetch required docs
      const [userSnap, statsSnap, creditsSnap] = await Promise.all([
        tx.get(db.collection(COLLECTIONS.USERS).doc(uid)),
        tx.get(db.collection(COLLECTIONS.STATS).doc(uid)),
        tx.get(db.collection(COLLECTIONS.CREDITS).doc(uid)),
      ]);

      if (!userSnap.exists)    throw Object.assign(new Error('User not found'),    { status: 404 });
      if (!statsSnap.exists)   throw Object.assign(new Error('Stats not found'),   { status: 404 });
      if (!creditsSnap.exists) throw Object.assign(new Error('Credits not found'), { status: 404 });

      const user    = userSnap.data();
      const stats   = statsSnap.data();
      const credits = creditsSnap.data();

      // Check for active loan
      const activeLoanSnap = await tx.get(
        db.collection(COLLECTIONS.LOANS)
          .where('user_id', '==', uid)
          .where('status', '==', 'active')
          .limit(1),
      );
      const activeLoan = activeLoanSnap.empty ? null : activeLoanSnap.docs[0];

      // ── 2. Compute rewards ──────────────────────────────────────────────
      const xpAwarded = computeXpAward({
        baseXp,
        difficulty,
        playerClass:  user.class,
        statAffected,
        streakDays:   user.streak_days,
      });

      let creditsAwarded = computeCreditsAward({
        baseCredits,
        difficulty,
        playerClass:  user.class,
        statAffected,
        streakDays:   user.streak_days,
        source,
      });

      // Lv 10 perk: +10% credits on all tasks
      if (user.level >= 10) creditsAwarded = Math.round(creditsAwarded * 1.1);

      // ── 3. Loan repayment slice ─────────────────────────────────────────
      let loanRepaid  = 0;
      let netCredits  = creditsAwarded;
      let loanUpdates = null;

      if (activeLoan) {
        const loanData    = activeLoan.data();
        loanRepaid        = Math.min(loanRepaymentSlice(creditsAwarded), loanData.current_balance);
        netCredits        = creditsAwarded - loanRepaid;
        const newBalance  = loanData.current_balance - loanRepaid;
        const nowRepaid   = newBalance <= 0;

        loanUpdates = {
          ref:  activeLoan.ref,
          data: {
            current_balance: Math.max(0, newBalance),
            repaid_amount:   FieldValue.increment(loanRepaid),
            status:          nowRepaid ? 'repaid' : 'active',
            ...(nowRepaid && { repaid_at: Timestamp.now() }),
          },
        };
      }

      // ── 4. Level-up resolution ──────────────────────────────────────────
      const { newLevel, newXp, levelsGained, newTitle } = resolveLevelUp(
        user.level,
        user.xp,
        xpAwarded,
      );

      // ── 5. Stat gain ────────────────────────────────────────────────────
      const statGain    = computeStatGain(difficulty);
      const currentStat = stats[statAffected] ?? 0;
      const newStatVal  = Math.min(100, currentStat + statGain);
      const lifetimeKey = `${statAffected}_lifetime`;

      // ── 6–10. Write all documents ───────────────────────────────────────
      const now      = Timestamp.now();
      const taskRef  = db.collection(COLLECTIONS.TASKS).doc();
      const txRef    = db.collection(COLLECTIONS.CREDIT_TRANSACTIONS).doc();

      // Task document
      tx.set(taskRef, {
        id:             taskRef.id,
        user_id:        uid,
        name,
        stat_affected:  statAffected,
        difficulty,
        source,
        base_xp:        baseXp,
        base_credits:   baseCredits,
        xp_awarded:     xpAwarded,
        credits_awarded: creditsAwarded,
        loan_repaid:    loanRepaid,
        net_credits:    netCredits,
        completed:      true,
        ai_evaluated:   aiEvaluated,
        ai_notes:       aiNotes,
        quest_date:     questDate,
        completed_at:   now,
        created_at:     now,
      });

      // User update
      tx.update(db.collection(COLLECTIONS.USERS).doc(uid), {
        xp:               newXp,
        level:            newLevel,
        xp_to_next_level: xpToNextLevel(newLevel),
        title:            newTitle,
        streak_days:      FieldValue.increment(0),   // managed by daily-check logic
        tasks_completed:  FieldValue.increment(1),
        last_active_date: now,
        updated_at:       now,
      });

      // Stats update
      tx.update(db.collection(COLLECTIONS.STATS).doc(uid), {
        [statAffected]:   newStatVal,
        [lifetimeKey]:    Math.max(stats[lifetimeKey] ?? 0, newStatVal),
        updated_at:       now,
      });

      // Credits update
      tx.update(db.collection(COLLECTIONS.CREDITS).doc(uid), {
        balance:          FieldValue.increment(netCredits),
        lifetime_earned:  FieldValue.increment(creditsAwarded),
        weekly_earned:    FieldValue.increment(creditsAwarded),
        updated_at:       now,
      });

      // Credit transaction ledger entry
      tx.set(txRef, buildCreditTxPayload({
        userId:      uid,
        type:        'earn',
        amount:      creditsAwarded,
        source:      'task',
        referenceId: taskRef.id,
        note:        `${name} (${difficulty})`,
      }));

      // Loan update
      if (loanUpdates) {
        tx.update(loanUpdates.ref, loanUpdates.data);
      }

      
      return {
        taskId:       taskRef.id,
        xpAwarded,
        creditsAwarded,
        netCredits,
        loanRepaid,
        levelBefore:  user.level,
        levelAfter:   newLevel,
        levelsGained,
        newTitle,
        newXp,
        xpToNext:     xpToNextLevel(newLevel),
        statAfter:    newStatVal,
        loanCleared:  loanUpdates ? loanUpdates.data.status === 'repaid' : false,
      };
    });

    // Refresh leaderboard outside transaction
    try { await refreshLeaderboardScore(uid); } catch (_) {}

    return ok(res, {
      message:    'Quest complete! Keep going.',
      task:       { id: result.taskId, name, difficulty, statAffected },
      rewards: {
        xp:              result.xpAwarded,
        credits:         result.creditsAwarded,
        net_credits:     result.netCredits,
        loan_repaid:     result.loanRepaid,
        loan_cleared:    result.loanCleared,
      },
      progress: {
        level:           result.levelAfter,
        levels_gained:   result.levelsGained,
        title:           result.newTitle,
        xp:              result.newXp,
        xp_to_next:      result.xpToNext,
        [`${statAffected}_after`]: result.statAfter,
      },
    });
  }),
);

export default router;
