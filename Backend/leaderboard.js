import { Router }          from 'express';
import { query, validationResult } from 'express-validator';
import { getDb, COLLECTIONS } from '../config/firebase.js';
import { ok, err }            from '../utils/helpers.js';
import { optionalAuth }       from '../middleware/auth.js';
import { asyncHandler }       from '../middleware/errorHandler.js';

const router = Router();

// ─── BOT POOL ────────────────────────────────────────────────────────────────
// Bots are seeded with realistic score distributions.
// Scores vary per request using a deterministic daily seed so they don't
// jump around wildly on refresh, but do change day to day.

function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededRand(seed, min, max) {
  const x = Math.sin(seed) * 10000;
  const r = x - Math.floor(x);
  return Math.floor(r * (max - min + 1)) + min;
}

const BOT_TEMPLATES = [
  { username: 'IronNova',      class: 'warrior', level: 12, avatar: '🛡️',  tier: 'elite'   },
  { username: 'ZenMaster99',   class: 'monk',    level: 9,  avatar: '🧘',  tier: 'elite'   },
  { username: 'StudyBot_42',   class: 'scholar', level: 8,  avatar: '📚',  tier: 'regular' },
  { username: 'GrindMode',     class: 'warrior', level: 6,  avatar: '💪',  tier: 'regular' },
  { username: 'QuietCoder',    class: 'scholar', level: 5,  avatar: '💻',  tier: 'regular' },
  { username: 'DailyDoer',     class: 'monk',    level: 4,  avatar: '📅',  tier: 'casual'  },
  { username: 'CreativeBlaze', class: 'creator', level: 7,  avatar: '🎨',  tier: 'regular' },
  { username: 'MorningRun',    class: 'warrior', level: 3,  avatar: '🏃',  tier: 'casual'  },
  { username: 'BookWorm7',     class: 'scholar', level: 3,  avatar: '📖',  tier: 'casual'  },
];

const TIER_SCORE_RANGE = {
  elite:   { min: 3200, max: 4800 },
  regular: { min: 1800, max: 3100 },
  casual:  { min: 500,  max: 1700 },
};

function generateBots(seed) {
  return BOT_TEMPLATES.map((bot, i) => {
    const range = TIER_SCORE_RANGE[bot.tier];
    const score = seededRand(seed + i * 17, range.min, range.max);
    return {
      uid:             `bot_${bot.username.toLowerCase()}`,
      username:        bot.username,
      avatar_emoji:    bot.avatar,
      class:           bot.class,
      level:           bot.level,
      score,
      tasks_completed: seededRand(seed + i * 31, 5, 60),
      streak_days:     seededRand(seed + i * 13, 0, 21),
      is_bot:          true,
      period:          'weekly',
    };
  });
}

// ─── GET /leaderboard ────────────────────────────────────────────────────────

/**
 * Returns the ranked leaderboard, merging real users with AI bots.
 *
 * Query params:
 *   period  — 'weekly' | 'alltime'  (default: 'weekly')
 *   limit   — 1–50                  (default: 20)
 *   offset  — pagination start      (default: 0)
 *
 * Auth: optional — if authenticated, caller's rank is highlighted.
 */
router.get(
  '/',
  optionalAuth,
  [
    query('period').optional().isIn(['weekly', 'alltime']).withMessage('period must be weekly or alltime'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1–50'),
    query('offset').optional().isInt({ min: 0 }).withMessage('offset must be >= 0'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return err(res, 'Validation failed', 400, errors.array());

    const period = req.query.period  ?? 'weekly';
    const limit  = parseInt(req.query.limit  ?? '20', 10);
    const offset = parseInt(req.query.offset ?? '0',  10);
    const db     = getDb();
    const uid    = req.user?.uid ?? null;

    // Fetch real user leaderboard docs
    const snap = await db
      .collection(COLLECTIONS.LEADERBOARD)
      .where('period', '==', period)
      .where('is_bot', '==', false)
      .orderBy('score', 'desc')
      .limit(100)   // fetch top 100 real users to merge with bots
      .get();

    const realPlayers = snap.docs.map(d => ({ ...d.data(), uid: d.data().user_id }));

    // Merge bots + real players, sort by score
    const seed  = dailySeed();
    const bots  = period === 'weekly' ? generateBots(seed) : [];
    const all   = [...realPlayers, ...bots].sort((a, b) => b.score - a.score);

    // Assign ranks
    all.forEach((entry, i) => { entry.rank = i + 1; });

    // Paginate
    const page = all.slice(offset, offset + limit);

    // Find caller's rank if authenticated
    let yourEntry = null;
    if (uid) {
      const found = all.find(e => e.uid === uid);
      if (found) {
        yourEntry = {
          rank:            found.rank,
          score:           found.score,
          username:        found.username,
          class:           found.class,
          level:           found.level,
          streak_days:     found.streak_days,
          tasks_completed: found.tasks_completed,
        };
      }
    }

    return ok(res, {
      period,
      total:       all.length,
      offset,
      limit,
      entries:     page.map(e => ({
        rank:            e.rank,
        uid:             e.uid,
        username:        e.username,
        avatar_emoji:    e.avatar_emoji,
        class:           e.class,
        level:           e.level,
        score:           e.score,
        streak_days:     e.streak_days     ?? 0,
        tasks_completed: e.tasks_completed ?? 0,
        is_bot:          e.is_bot ?? false,
        is_you:          e.uid === uid,
      })),
      your_rank:   yourEntry,
    });
  }),
);

export default router;
