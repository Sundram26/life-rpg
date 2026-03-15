// ─── BOT DATA ─────────────────────────────────────────────────────────────────
// All city-based names. Format: <city adjective/demonym> + <role/title>
// Organised by tier so harder brackets feel progressively more intimidating.

export const CITIES = [
  // Tier 1 — Casual (slow, beatable quickly)
  { city: 'Mumbai',    adj: 'Mumbai'    }, { city: 'Lagos',     adj: 'Lagos'     },
  { city: 'Nairobi',   adj: 'Nairobi'   }, { city: 'Cairo',     adj: 'Cairo'     },
  { city: 'Bangkok',   adj: 'Bangkok'   }, { city: 'Lima',      adj: 'Lima'      },
  { city: 'Hanoi',     adj: 'Hanoi'     }, { city: 'Accra',     adj: 'Accra'     },
  { city: 'Karachi',   adj: 'Karachi'   }, { city: 'Dhaka',     adj: 'Dhaka'     },

  // Tier 2 — Regular (competitive, require consistent effort)
  { city: 'Berlin',    adj: 'Berlin'    }, { city: 'Sydney',    adj: 'Sydney'    },
  { city: 'Toronto',   adj: 'Toronto'   }, { city: 'Seoul',     adj: 'Seoul'     },
  { city: 'Madrid',    adj: 'Madrid'    }, { city: 'Chicago',   adj: 'Chicago'   },
  { city: 'Amsterdam', adj: 'Amsterdam' }, { city: 'Vienna',    adj: 'Vienna'    },
  { city: 'Dubai',     adj: 'Dubai'     }, { city: 'Singapore', adj: 'Singapore' },

  // Tier 3 — Elite (require streaks + daily clears to beat)
  { city: 'Tokyo',     adj: 'Tokyo'     }, { city: 'London',    adj: 'London'    },
  { city: 'Paris',     adj: 'Paris'     }, { city: 'New York',  adj: 'NYC'       },
  { city: 'Zurich',    adj: 'Zurich'    }, { city: 'Stockholm', adj: 'Stockholm' },
  { city: 'Oslo',      adj: 'Oslo'      }, { city: 'Helsinki',  adj: 'Helsinki'  },
  { city: 'Geneva',    adj: 'Geneva'    }, { city: 'Reykjavik', adj: 'Reykjavik' },
]

export const SUFFIXES = {
  scholar:  ['Scholar', 'Reader', 'Mind', 'Sage', 'Coder', 'Student', 'Thinker'],
  warrior:  ['Runner', 'Lifter', 'Athlete', 'Fighter', 'Sprinter', 'Champion'],
  monk:     ['Monk', 'Meditator', 'Focused', 'Stoic', 'Disciplined', 'Zen'],
  creator:  ['Builder', 'Maker', 'Creator', 'Artist', 'Crafter', 'Visionary'],
}

export const CLASSES = ['scholar', 'warrior', 'monk', 'creator']

export const AVATARS = {
  scholar:  ['📚', '🧠', '💡', '🔬', '🎓'],
  warrior:  ['🛡️', '💪', '🏋️', '🏃', '⚔️'],
  monk:     ['🧘', '🌿', '🕯️', '☯️', '🌸'],
  creator:  ['🎨', '🔮', '✨', '🎭', '🎯'],
}

// ── The Final Boss ─────────────────────────────────────────────────────────────
export const FINAL_BOSS = {
  id:           'boss_apex',
  username:     'APEX // Olympus',
  avatar:       '👑',
  playerClass:  'monk',
  tier:         'boss',
  level:        99,
  isBot:        true,
  isBoss:       true,
  // Boss score: always sits ~15% above whoever is rank 2
  // Re-calculated each time so it's never catchable — until the final challenge
  scoreStrategy: 'dynamic_leader',
  dailyGain:    { min: 800, max: 1200 },
  streakDays:   365,
  lore: `APEX // Olympus has been undefeated for 312 days.
No city has ever claimed the throne.
Legend says they never sleep. Never skip. Never break.
They are the benchmark the world is measured against.`,
}

// ── Tier config ────────────────────────────────────────────────────────────────
export const TIER_CONFIG = {
  casual: {
    level:          { min: 2,  max: 6  },
    streakMax:      5,
    tasksPerDay:    { min: 2, max: 4  },
    skipDayChance:  0.30,   // 30% chance bot skips a day entirely
    dailyGain:      { min: 60,  max: 180 },
    startScore:     { min: 200,  max: 800  },
  },
  regular: {
    level:          { min: 5,  max: 12 },
    streakMax:      14,
    tasksPerDay:    { min: 4, max: 7  },
    skipDayChance:  0.12,
    dailyGain:      { min: 200, max: 500 },
    startScore:     { min: 800,  max: 2500 },
  },
  elite: {
    level:          { min: 10, max: 20 },
    streakMax:      30,
    tasksPerDay:    { min: 6, max: 9  },
    skipDayChance:  0.04,
    dailyGain:      { min: 500, max: 900 },
    startScore:     { min: 2500, max: 5000 },
  },
}

// ── Bracket composition ────────────────────────────────────────────────────────
// How many bots of each tier appear on the leaderboard
export const BRACKET_COMPOSITION = {
  newcomer: { casual: 6, regular: 2, elite: 0 },  // Lv 1-4
  rising:   { casual: 3, regular: 5, elite: 1 },  // Lv 5-9
  veteran:  { casual: 1, regular: 4, elite: 4 },  // Lv 10-14
  legend:   { casual: 0, regular: 2, elite: 7 },  // Lv 15+
}

export function getBracket(playerLevel) {
  if (playerLevel >= 15) return 'legend'
  if (playerLevel >= 10) return 'veteran'
  if (playerLevel >= 5)  return 'rising'
  return 'newcomer'
}
