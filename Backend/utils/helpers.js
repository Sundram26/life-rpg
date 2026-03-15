import admin from 'firebase-admin';
import { getDb, COLLECTIONS } from '../config/firebase.js';
import {
  DIFFICULTY, CLASSES, LOAN, DECAY, STAT_KEYS,
  xpToNextLevel, getTitleForLevel, streakBonus, calcLeaderboardScore,
} from '../config/gameConstants.js';

const { FieldValue, Timestamp } = admin.firestore;

// ─── RESPONSE HELPERS ───────────────────────────────────────────────────────

export const ok  = (res, data, status = 200) => res.status(status).json({ success: true,  ...data });
export const err = (res, message, status = 400) => res.status(status).json({ success: false, error: message });

// ─── XP & LEVELLING ─────────────────────────────────────────────────────────

/**
 * Apply XP to a user document within a Firestore transaction.
 * Returns updated level info.
 */
export function computeXpAward({ baseXp, difficulty, playerClass, statAffected, streakDays }) {
  const diffMult   = DIFFICULTY[difficulty]?.mult ?? 1.0;
  const classConf  = CLASSES[playerClass] ?? CLASSES.scholar;
  const isPrimary  = Array.isArray(classConf.primary_stats)
    ? classConf.primary_stats.includes(statAffected)
    : classConf.primary_stat === statAffected;
  const classMult  = isPrimary ? classConf.xp_mult : 1.0;
  const strkBonus  = streakBonus(streakDays, playerClass);

  return Math.round(baseXp * diffMult * classMult * strkBonus);
}

/**
 * Compute credits awarded for a task.
 */
export function computeCreditsAward({ baseCredits, difficulty, playerClass, statAffected, streakDays, source }) {
  const diffMult  = DIFFICULTY[difficulty]?.mult ?? 1.0;
  const classConf = CLASSES[playerClass] ?? CLASSES.scholar;
  const isPrimary = Array.isArray(classConf.primary_stats)
    ? classConf.primary_stats.includes(statAffected)
    : classConf.primary_stat === statAffected;

  let mult = isPrimary ? classConf.credit_mult : 1.0;
  mult *= classConf.credit_penalty ?? 1.0;

  // Creator bonus on custom tasks
  if (playerClass === 'creator' && source === 'custom') mult *= 1.25;

  const strk = streakBonus(streakDays, playerClass);
  return Math.round(baseCredits * diffMult * mult * strk);
}

/**
 * Check if accumulated XP triggers a level-up (can level up multiple times).
 * Returns { newLevel, newXp, levelsGained, newTitle }.
 */
export function resolveLevelUp(currentLevel, currentXp, gainedXp) {
  let level = currentLevel;
  let xp    = currentXp + gainedXp;

  while (xp >= xpToNextLevel(level)) {
    xp    -= xpToNextLevel(level);
    level += 1;
  }

  return {
    newLevel:     level,
    newXp:        xp,
    levelsGained: level - currentLevel,
    newTitle:     getTitleForLevel(level),
  };
}

// ─── STAT HELPERS ───────────────────────────────────────────────────────────

export function computeStatGain(difficulty) {
  return DIFFICULTY[difficulty]?.stat_gain ?? 1;
}

/**
 * Apply stat decay based on days since last active.
 * Returns a patch object to merge into the stats document.
 */
export function computeDecay(statsDoc, playerClass, lastActiveDate) {
  const daysSince = Math.floor((Date.now() - lastActiveDate.toMillis()) / 86_400_000);
  if (daysSince < DECAY.INACTIVE_DAYS) return null;

  const ticks      = Math.floor(daysSince / DECAY.INACTIVE_DAYS);
  const classConf  = CLASSES[playerClass] ?? {};
  const patch      = {};

  STAT_KEYS.forEach(stat => {
    const current  = statsDoc[stat] ?? 0;
    const isWeak   = stat === classConf.weakness_stat;
    const decayAmt = isWeak
      ? DECAY.DECAY_AMOUNT * (classConf.decay_weakness ?? 1)
      : DECAY.DECAY_AMOUNT * (classConf.decay_weakness ?? 1);
    const reduced  = Math.max(DECAY.MIN_VALUE, current - decayAmt * ticks);
    if (reduced !== current) patch[stat] = reduced;
  });

  patch.last_decay_check = Timestamp.now();
  return patch;
}

// ─── CREDIT TRANSACTION HELPER ──────────────────────────────────────────────

/**
 * Write a credit transaction record and update the credits balance doc.
 * Designed to be called inside a Firestore transaction.
 */
export function buildCreditTxPayload({ userId, type, amount, source, referenceId, note }) {
  return {
    user_id:      userId,
    type,            // 'earn' | 'spend' | 'loan_issued' | 'loan_repayment' | 'penalty' | 'bonus'
    amount,          // positive = earn, negative = spend
    source,          // 'task' | 'reward' | 'loan' | 'streak_bonus' | 'leaderboard' etc.
    reference_id:  referenceId ?? null,
    note:          note ?? null,
    created_at:    Timestamp.now(),
  };
}

// ─── LOAN HELPERS ───────────────────────────────────────────────────────────

/**
 * Calculate current balance with compounded interest.
 */
export function calcLoanBalance(principal, issuedAt, graceDays = LOAN.GRACE_DAYS) {
  const daysSince = Math.floor((Date.now() - issuedAt.toMillis()) / 86_400_000);
  const overdueDays = Math.max(0, daysSince - graceDays);
  return Math.round(principal * Math.pow(1 + LOAN.DAILY_INTEREST, overdueDays));
}

/**
 * How much of `earned` should go toward loan repayment.
 */
export function loanRepaymentSlice(earned) {
  return Math.round(earned * LOAN.REPAY_FRACTION);
}

// ─── LEADERBOARD HELPER ─────────────────────────────────────────────────────

export async function refreshLeaderboardScore(userId, transaction) {
  const db = getDb();

  const [creditDoc, userDoc] = await Promise.all([
    transaction.get(db.collection(COLLECTIONS.CREDITS).doc(userId)),
    transaction.get(db.collection(COLLECTIONS.USERS).doc(userId)),
  ]);

  if (!creditDoc.exists || !userDoc.exists) return;

  const credits = creditDoc.data();
  const user    = userDoc.data();

  const score = calcLeaderboardScore({
    credits_earned: credits.weekly_earned ?? 0,
    xp_earned:      user.xp               ?? 0,
    streak_days:    user.streak_days       ?? 0,
    level:          user.level             ?? 1,
  });

  const lbRef = db.collection(COLLECTIONS.LEADERBOARD)
    .doc(`${userId}_weekly`);

  transaction.set(lbRef, {
    user_id:          userId,
    period:           'weekly',
    score,
    credits_earned:   credits.weekly_earned ?? 0,
    xp_earned:        user.xp               ?? 0,
    tasks_completed:  user.tasks_completed  ?? 0,
    streak_contribution: user.streak_days   ?? 0,
    is_bot:           false,
    updated_at:       Timestamp.now(),
  }, { merge: true });
}

// ─── DATE HELPERS ───────────────────────────────────────────────────────────

export function todayString() {
  return new Date().toISOString().slice(0, 10);  // 'YYYY-MM-DD'
}

export function isToday(firestoreTimestamp) {
  return firestoreTimestamp?.toDate().toISOString().slice(0, 10) === todayString();
}
