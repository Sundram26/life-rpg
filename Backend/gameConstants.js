// ─── XP & CREDIT BASE VALUES ───────────────────────────────────────────────

export const DIFFICULTY = {
  easy:   { mult: 1.0, stat_gain: 1, base_xp: 20,  base_credits: 15 },
  medium: { mult: 1.5, stat_gain: 2, base_xp: 40,  base_credits: 30 },
  hard:   { mult: 2.0, stat_gain: 4, base_xp: 70,  base_credits: 60 },
  epic:   { mult: 3.0, stat_gain: 8, base_xp: 120, base_credits: 100 },
};

export const STAT_KEYS = ['intelligence', 'strength', 'discipline', 'social'];

// ─── CLASSES ────────────────────────────────────────────────────────────────

export const CLASSES = {
  scholar: {
    primary_stat:    'intelligence',
    xp_mult:         1.3,   // on primary stat tasks
    credit_mult:     1.2,
    weakness_stat:   'strength',
    decay_weakness:  1.5,
    credit_penalty:  1.0,
  },
  warrior: {
    primary_stat:    'strength',
    xp_mult:         1.3,
    credit_mult:     1.2,
    weakness_stat:   'social',
    decay_weakness:  1.5,
    credit_penalty:  1.0,
  },
  monk: {
    primary_stat:    'discipline',
    xp_mult:         1.0,   // monk bonus comes from streak cap
    credit_mult:     1.0,
    weakness_stat:   null,
    decay_weakness:  0.5,   // monk's decay is halved across the board
    credit_penalty:  0.9,   // monks earn 10% fewer credits
    streak_cap:      2.0,   // vs 1.5 for others
  },
  creator: {
    primary_stats:   ['social', 'intelligence'],
    xp_mult:         1.2,
    credit_mult:     1.25,  // on custom tasks
    weakness_stat:   null,
    decay_weakness:  1.0,
    credit_penalty:  1.0,
    streak_bonus:    false, // creators work in bursts
  },
};

// ─── LEVEL SYSTEM ───────────────────────────────────────────────────────────

// XP needed to reach the NEXT level from `level`
// Formula: 100 * level^2 + 50 * level
export function xpToNextLevel(level) {
  return 100 * level * level + 50 * level;
}

export const LEVEL_PERKS = {
  5:  { title: 'Apprentice',  perk: 'Unlocks Hard difficulty quests' },
  10: { title: 'Adept',       perk: '+10% credits on all tasks' },
  15: { title: 'Champion',    perk: 'Unlocks Epic quests and loan access' },
  20: { title: 'Legend',      perk: '2x leaderboard score weight' },
};

export function getTitleForLevel(level) {
  const titles = [
    [1, 'Wanderer'], [2, 'Seeker'], [3, 'Initiate'], [4, 'Scout'],
    [5, 'Apprentice'], [6, 'Journeyman'], [7, 'Adept'],
    [10, 'Champion'], [15, 'Master'], [20, 'Legend'],
  ];
  let title = 'Wanderer';
  for (const [threshold, name] of titles) {
    if (level >= threshold) title = name;
  }
  return title;
}

// ─── STREAK BONUSES ─────────────────────────────────────────────────────────

export function streakBonus(days, playerClass = 'scholar') {
  const cap = playerClass === 'monk' ? 2.0 : 1.5;
  if (playerClass === 'creator') return 1.0;
  if (days >= 30) return Math.min(cap, 1.5);
  if (days >= 7)  return Math.min(cap, 1.25);
  if (days >= 3)  return Math.min(cap, 1.1);
  return 1.0;
}

// ─── LEADERBOARD SCORE ──────────────────────────────────────────────────────

export function calcLeaderboardScore({ credits_earned, xp_earned, streak_days, level }) {
  const levelMult = level >= 20 ? 2.0 : 1.0;
  return Math.round(
    (credits_earned * 0.4 + xp_earned * 0.4 + streak_days * 20 * 0.2) * levelMult
  );
}

// ─── LOAN CONSTANTS ─────────────────────────────────────────────────────────

export const LOAN = {
  MIN_AMOUNT:       50,
  MAX_AMOUNT:       500,
  GRACE_DAYS:       3,       // 0% interest within grace period
  DAILY_INTEREST:   0.10,    // 10% per day after grace
  DEFAULT_MULT:     3.0,     // loan defaults when balance = 3× principal
  REPAY_FRACTION:   0.60,    // 60% of earned credits go to repayment
  STAT_PENALTY:     5,       // stat points lost on default
  MIN_LEVEL:        15,      // level required to take a loan
};

// ─── STAT DECAY ─────────────────────────────────────────────────────────────

export const DECAY = {
  INACTIVE_DAYS:  3,    // days before decay starts
  DECAY_AMOUNT:   1,    // points per decay tick
  MIN_VALUE:      0,
};

// ─── DAILY QUEST BONUSES ────────────────────────────────────────────────────

export const DAILY_QUEST = {
  FULL_CLEAR_XP:       100,
  FULL_CLEAR_CREDITS:  50,
  PARTIAL_XP:          30,   // for completing 4/6
  PARTIAL_CREDITS:     15,
  PARTIAL_THRESHOLD:   4,
  REROLL_COST:         30,
};
