// ─── LOAN SYSTEM CONSTANTS ────────────────────────────────────────────────────

// ── Loan tiers ────────────────────────────────────────────────────────────────
// Each tier has a fixed credit amount, a repayment quest bundle,
// a deadline in days, and escalating penalties for failure.

export const LOAN_TIERS = {
  small: {
    id:          'small',
    label:       'Small Loan',
    credits:     50,
    icon:        '🪙',
    deadline:    3,      // days to complete all quests
    description: 'A quick boost. Easy to clear.',
    penalty: {
      stat:   'discipline',
      amount: 3,
      label:  '-3 Discipline',
    },
    min_level: 1,        // available from the start
  },
  medium: {
    id:          'medium',
    label:       'Medium Loan',
    credits:     150,
    icon:        '💰',
    deadline:    5,
    description: 'A meaningful reward — requires real effort to repay.',
    penalty: {
      stat:   'discipline',
      amount: 6,
      label:  '-6 Discipline',
    },
    min_level: 5,
  },
  large: {
    id:          'large',
    label:       'Large Loan',
    credits:     400,
    icon:        '💎',
    deadline:    7,
    description: 'Major reward, major commitment.',
    penalty: {
      stat:   'discipline',
      amount: 10,
      label:  '-10 Discipline',
    },
    min_level: 10,
  },
  epic: {
    id:          'epic',
    label:       'Epic Loan',
    credits:     1000,
    icon:        '👑',
    deadline:    14,
    description: 'Reserved for legends. The price of failure is steep.',
    penalty: {
      stat:   'discipline',
      amount: 20,
      label:  '-20 Discipline',
    },
    min_level: 15,
  },
}

// ── Quest templates ────────────────────────────────────────────────────────────
// The building blocks repayment quests are assembled from.
// Each template maps to a stat category and has flexible duration thresholds.

export const QUEST_TEMPLATES = {
  // ── Intelligence ────────────────────────────────────────────────────────────
  study_30: {
    id:       'study_30',
    name:     'Study for 30 minutes',
    stat:     'intelligence',
    icon:     '📖',
    minutes:  30,
    xp:       30,
    weight:   1.0,   // relative difficulty weight for quest bundle assembly
  },
  study_60: {
    id:       'study_60',
    name:     'Study for 1 hour',
    stat:     'intelligence',
    icon:     '📚',
    minutes:  60,
    xp:       60,
    weight:   2.0,
  },
  read_chapter: {
    id:       'read_chapter',
    name:     'Read a full chapter',
    stat:     'intelligence',
    icon:     '📖',
    minutes:  20,
    xp:       20,
    weight:   0.8,
  },
  online_lesson: {
    id:       'online_lesson',
    name:     'Complete an online lesson',
    stat:     'intelligence',
    icon:     '💻',
    minutes:  45,
    xp:       45,
    weight:   1.5,
  },

  // ── Strength ─────────────────────────────────────────────────────────────────
  workout_20: {
    id:       'workout_20',
    name:     'Workout for 20 minutes',
    stat:     'strength',
    icon:     '💪',
    minutes:  20,
    xp:       25,
    weight:   1.0,
  },
  workout_45: {
    id:       'workout_45',
    name:     'Workout for 45 minutes',
    stat:     'strength',
    icon:     '🏋️',
    minutes:  45,
    xp:       55,
    weight:   1.8,
  },
  run_5k: {
    id:       'run_5k',
    name:     'Go for a 5km run',
    stat:     'strength',
    icon:     '🏃',
    minutes:  30,
    xp:       50,
    weight:   1.5,
  },
  walk_30: {
    id:       'walk_30',
    name:     'Walk for 30 minutes',
    stat:     'strength',
    icon:     '🚶',
    minutes:  30,
    xp:       20,
    weight:   0.7,
  },

  // ── Discipline ───────────────────────────────────────────────────────────────
  no_phone_2h: {
    id:       'no_phone_2h',
    name:     'No phone for 2 hours',
    stat:     'discipline',
    icon:     '📵',
    minutes:  120,
    xp:       40,
    weight:   1.8,
  },
  journal: {
    id:       'journal',
    name:     'Write in your journal',
    stat:     'discipline',
    icon:     '📓',
    minutes:  15,
    xp:       20,
    weight:   0.6,
  },
  plan_day: {
    id:       'plan_day',
    name:     'Plan tomorrow in full',
    stat:     'discipline',
    icon:     '📅',
    minutes:  20,
    xp:       25,
    weight:   0.8,
  },
  meditate: {
    id:       'meditate',
    name:     'Meditate for 15 minutes',
    stat:     'discipline',
    icon:     '🧘',
    minutes:  15,
    xp:       25,
    weight:   0.7,
  },
  wake_early: {
    id:       'wake_early',
    name:     'Wake up before 7 AM',
    stat:     'discipline',
    icon:     '🌅',
    minutes:  0,
    xp:       30,
    weight:   1.0,
  },

  // ── Social ───────────────────────────────────────────────────────────────────
  call_friend: {
    id:       'call_friend',
    name:     'Call a friend or family member',
    stat:     'social',
    icon:     '📞',
    minutes:  15,
    xp:       20,
    weight:   0.8,
  },
  attend_event: {
    id:       'attend_event',
    name:     'Attend a social event or meetup',
    stat:     'social',
    icon:     '🎭',
    minutes:  60,
    xp:       60,
    weight:   2.0,
  },
}

// ── Repayment quest bundles ────────────────────────────────────────────────────
// Fixed quest sets assigned per loan tier.
// Bundles are stat-balanced — they always span 2+ stat categories so
// the player can't just grind one skill to clear a loan.

export const REPAYMENT_BUNDLES = {
  small: {
    total_weight: 2.8,
    quests: [
      { template: 'study_30',   required: true  },
      { template: 'workout_20', required: true  },
    ],
    description: 'Study 30 min + Workout 20 min',
  },
  medium: {
    total_weight: 6.6,
    quests: [
      { template: 'study_60',   required: true  },
      { template: 'workout_45', required: true  },
      { template: 'no_phone_2h',required: false },  // bonus — clears 2 days faster
      { template: 'journal',    required: true  },
    ],
    description: 'Study 1hr + Workout 45min + Journal',
  },
  large: {
    total_weight: 10.5,
    quests: [
      { template: 'study_60',    required: true  },
      { template: 'online_lesson',required: true  },
      { template: 'run_5k',      required: true  },
      { template: 'no_phone_2h', required: true  },
      { template: 'plan_day',    required: true  },
      { template: 'call_friend', required: false },
    ],
    description: 'Study 1hr + Online lesson + 5km run + No phone 2hr + Plan day',
  },
  epic: {
    total_weight: 18.0,
    quests: [
      { template: 'study_60',    required: true  },
      { template: 'online_lesson',required: true  },
      { template: 'workout_45',  required: true  },
      { template: 'run_5k',      required: true  },
      { template: 'no_phone_2h', required: true  },
      { template: 'wake_early',  required: true  },
      { template: 'meditate',    required: true  },
      { template: 'journal',     required: true  },
      { template: 'attend_event',required: false },
    ],
    description: '8 quests across all stats — a true challenge',
  },
}

// ── Penalty escalation ────────────────────────────────────────────────────────
// Extra penalties applied per day overdue BEYOND the initial deadline

export const OVERDUE_ESCALATION = {
  stat_loss_per_day: 1,         // additional -1 discipline per day overdue
  max_extra_loss:    10,        // cap at -10 additional
  leaderboard_badge: true,      // "In Debt" badge shows on leaderboard
  shop_locked_days:  1,         // shop access locked per day overdue
  max_shop_lock:     7,         // max 7 days shop lock
}

// ── Partial completion grace ───────────────────────────────────────────────────
// If the user completes most quests, they get a partial forgiveness option

export const PARTIAL_GRACE = {
  threshold:       0.75,        // completing 75% of required quests = grace eligible
  credit_penalty:  0.25,        // pay back 25% of the loan in credits instead
  stat_reduction:  0.50,        // only 50% of the normal stat penalty
}
