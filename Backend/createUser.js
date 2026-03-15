import { Router }         from 'express';
import { body, validationResult } from 'express-validator';
import admin              from 'firebase-admin';
import { getDb, COLLECTIONS }     from '../config/firebase.js';
import { CLASSES, STAT_KEYS, xpToNextLevel, getTitleForLevel } from '../config/gameConstants.js';
import { ok, err }        from '../utils/helpers.js';
import { asyncHandler }   from '../middleware/errorHandler.js';

const router = Router();
const { Timestamp } = admin.firestore;

// ─── VALIDATION ─────────────────────────────────────────────────────────────

const createUserValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be 3–20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username may only contain letters, numbers and underscores'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),

  body('playerClass')
    .isIn(Object.keys(CLASSES))
    .withMessage(`Class must be one of: ${Object.keys(CLASSES).join(', ')}`),

  body('avatarEmoji')
    .optional()
    .isString()
    .withMessage('Avatar must be a string'),
];

// ─── POST /createUser ───────────────────────────────────────────────────────

/**
 * Creates:
 *  1. Firebase Auth user
 *  2. users/{uid}          — profile, level, XP, streak
 *  3. stats/{uid}          — four stat scores
 *  4. credits/{uid}        — balance document
 *  5. leaderboard/{uid}_weekly — initial leaderboard entry
 *
 * Body: { username, email, password, playerClass, avatarEmoji? }
 */
router.post(
  '/',
  createUserValidation,
  asyncHandler(async (req, res) => {
    // 1. Validate inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return err(res, 'Validation failed', 400, errors.array());
    }

    const { username, email, password, playerClass, avatarEmoji = '⚔️' } = req.body;
    const db = getDb();

    // 2. Check username uniqueness
    const usernameSnap = await db
      .collection(COLLECTIONS.USERS)
      .where('username', '==', username)
      .limit(1)
      .get();

    if (!usernameSnap.empty) {
      return err(res, 'Username already taken', 409);
    }

    // 3. Create Firebase Auth account
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().createUser({ email, password, displayName: username });
    } catch (firebaseErr) {
      if (firebaseErr.code === 'auth/email-already-exists') {
        return err(res, 'Email already registered', 409);
      }
      throw firebaseErr;
    }

    const uid  = firebaseUser.uid;
    const now  = Timestamp.now();
    const lvl1 = xpToNextLevel(1);

    // 4. Write all documents in a batch (atomic)
    const batch = db.batch();

    // ── users/{uid} ──
    batch.set(db.collection(COLLECTIONS.USERS).doc(uid), {
      id:                    uid,
      username,
      email,
      avatar_emoji:          avatarEmoji,
      class:                 playerClass,
      level:                 1,
      xp:                    0,
      xp_to_next_level:      lvl1,
      streak_days:           0,
      last_active_date:      now,
      streak_shield_active:  false,
      title:                 getTitleForLevel(1),
      tasks_completed:       0,
      created_at:            now,
      updated_at:            now,
    });

    // ── stats/{uid} ──
    const statsDoc = { id: uid, user_id: uid, last_decay_check: now, updated_at: now };
    STAT_KEYS.forEach(s => {
      statsDoc[s]                = 10;   // everyone starts at 10
      statsDoc[`${s}_lifetime`]  = 10;
    });
    batch.set(db.collection(COLLECTIONS.STATS).doc(uid), statsDoc);

    // ── credits/{uid} ──
    batch.set(db.collection(COLLECTIONS.CREDITS).doc(uid), {
      id:               uid,
      user_id:          uid,
      balance:          100,   // starter bonus
      lifetime_earned:  100,
      lifetime_spent:   0,
      weekly_earned:    0,
      week_start:       now,
      updated_at:       now,
    });

    // ── leaderboard entry ──
    batch.set(db.collection(COLLECTIONS.LEADERBOARD).doc(`${uid}_weekly`), {
      user_id:             uid,
      username,
      avatar_emoji:        avatarEmoji,
      class:               playerClass,
      period:              'weekly',
      score:               0,
      rank:                0,
      credits_earned:      0,
      xp_earned:           0,
      tasks_completed:     0,
      streak_contribution: 0,
      is_bot:              false,
      updated_at:          now,
    });

    await batch.commit();

    // 5. Respond — never return password or sensitive Firebase internals
    return ok(res, {
      message: 'Character created! Your adventure begins.',
      user: {
        uid,
        username,
        email,
        class:          playerClass,
        level:          1,
        xp:             0,
        xp_to_next:     lvl1,
        streak_days:    0,
        starting_credits: 100,
        title:          getTitleForLevel(1),
        stats:          Object.fromEntries(STAT_KEYS.map(s => [s, 10])),
      },
    }, 201);
  }),
);

export default router;
