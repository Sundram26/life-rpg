// ─── BOT FACTORY ─────────────────────────────────────────────────────────────
// Generates deterministic bots from a numeric seed.
// Same seed → same bots → consistent week-over-week experience.
// Seed changes weekly so bots slowly evolve.

import {
  CITIES, SUFFIXES, CLASSES, AVATARS,
  TIER_CONFIG, BRACKET_COMPOSITION, getBracket,
  FINAL_BOSS,
} from './botData.js'

// ── Seeded pseudo-random (no external deps) ────────────────────────────────────
function seededRng(seed) {
  let s = seed
  return {
    next() {
      s = (s * 1664525 + 1013904223) & 0xffffffff
      return (s >>> 0) / 0xffffffff
    },
    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min
    },
    pick(arr) {
      return arr[this.int(0, arr.length - 1)]
    },
    float(min, max) {
      return this.next() * (max - min) + min
    },
  }
}

function weekSeed() {
  const d    = new Date()
  const week = Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000))
  return week * 1000
}

function daySeed() {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

// ── Generate a single bot ──────────────────────────────────────────────────────

export function createBot(id, tier, rng) {
  const cfg         = TIER_CONFIG[tier]
  const playerClass = rng.pick(CLASSES)
  const city        = rng.pick(CITIES)
  const suffix      = rng.pick(SUFFIXES[playerClass])
  const avatar      = rng.pick(AVATARS[playerClass])
  const level       = rng.int(cfg.level.min, cfg.level.max)

  // Deterministic start score — varies per bot within tier range
  const startScore  = rng.int(cfg.startScore.min, cfg.startScore.max)

  // Days active this week (1-7), used to compute weekly score
  const daysActive  = Math.max(1, 7 - Math.floor(rng.next() / cfg.skipDayChance))

  // Simulate daily gains across active days
  let weeklyScore = startScore
  for (let d = 0; d < Math.min(daysActive, 7); d++) {
    if (rng.next() > cfg.skipDayChance) {
      weeklyScore += rng.int(cfg.dailyGain.min, cfg.dailyGain.max)
    }
  }

  const streakDays = rng.int(0, cfg.streakMax)
  const tasksCompleted = rng.int(cfg.tasksPerDay.min * 7, cfg.tasksPerDay.max * 7)

  return {
    id:              `bot_${id}`,
    username:        `${city.adj} ${suffix}`,
    avatar,
    playerClass,
    tier,
    level,
    isBot:           true,
    isBoss:          false,
    score:           weeklyScore,
    streakDays,
    tasksCompleted,
    weeklyCredits:   Math.round(weeklyScore * 0.4),
    weeklyXp:        Math.round(weeklyScore * 0.4),
  }
}

// ── Generate a full bracket ────────────────────────────────────────────────────

export function generateBracket(playerLevel, playerScore = 0) {
  const bracketName = getBracket(playerLevel)
  const composition = BRACKET_COMPOSITION[bracketName]
  const seed        = weekSeed()
  const rng         = seededRng(seed)
  const bots        = []

  let idCounter = 1
  for (const [tier, count] of Object.entries(composition)) {
    for (let i = 0; i < count; i++) {
      bots.push(createBot(`${bracketName}_${idCounter++}`, tier, rng))
    }
  }

  // Inject the final boss — score is always 15% above second place
  const sortedBots    = [...bots].sort((a, b) => b.score - a.score)
  const secondPlace   = sortedBots[0]?.score ?? playerScore ?? 1000
  const bossScore     = Math.round(Math.max(secondPlace, playerScore) * 1.15) + rng.int(200, 600)

  const boss = {
    ...FINAL_BOSS,
    score:         bossScore,
    weeklyCredits: Math.round(bossScore * 0.4),
    weeklyXp:      Math.round(bossScore * 0.4),
    tasksCompleted: rng.int(55, 70),
  }

  return { bots: [...bots, boss], bracketName }
}

// ── Daily score tick ───────────────────────────────────────────────────────────
// Simulates one day of bot activity. Called by the scheduler or on-demand.
// Returns updated scores for all bots.

export function tickBotScores(bots, dayIndex = 0) {
  const rng = seededRng(daySeed() + dayIndex * 777)

  return bots.map(bot => {
    if (bot.isBoss) return bot  // Boss is handled separately

    const cfg = TIER_CONFIG[bot.tier]
    if (!cfg) return bot

    // Skip day?
    if (rng.next() < cfg.skipDayChance) {
      return { ...bot, streakDays: 0 }  // missed day breaks streak
    }

    const gain = rng.int(cfg.dailyGain.min, cfg.dailyGain.max)
    const newScore = bot.score + gain

    return {
      ...bot,
      score:         newScore,
      streakDays:    bot.streakDays + 1,
      tasksCompleted: bot.tasksCompleted + rng.int(cfg.tasksPerDay.min, cfg.tasksPerDay.max),
      weeklyCredits: Math.round(newScore * 0.4),
      weeklyXp:      Math.round(newScore * 0.4),
    }
  })
}

// ── Rank + inject player ───────────────────────────────────────────────────────
// Merges the player's real data into the bot bracket and assigns ranks.

export function buildLeaderboard(bots, player) {
  const entries = [
    ...bots,
    {
      id:            player.uid,
      username:      player.username,
      avatar:        player.avatar_emoji,
      playerClass:   player.playerClass,
      tier:          'player',
      level:         player.level,
      isBot:         false,
      isBoss:        false,
      score:         player.score,
      streakDays:    player.streakDays,
      tasksCompleted: player.tasksCompleted,
      weeklyCredits: player.weeklyCredits,
      weeklyXp:      player.weeklyXp,
    },
  ]

  // Sort descending by score
  const sorted = entries.sort((a, b) => b.score - a.score)

  // Assign ranks
  sorted.forEach((e, i) => { e.rank = i + 1 })

  const playerEntry = sorted.find(e => e.id === player.uid)
  const bossEntry   = sorted.find(e => e.isBoss)

  return {
    entries:        sorted,
    playerRank:     playerEntry?.rank ?? null,
    bossRank:       bossEntry?.rank   ?? 1,
    totalEntries:   sorted.length,
  }
}

// ── Check final challenge trigger ─────────────────────────────────────────────

export function checkFinalChallenge(leaderboard) {
  const { playerRank, bossRank } = leaderboard

  // Player must be rank 2 AND boss must be rank 1
  const triggered = playerRank === 2 && bossRank === 1

  if (!triggered) return { triggered: false }

  const boss      = leaderboard.entries.find(e => e.isBoss)
  const player    = leaderboard.entries.find(e => !e.isBot)
  const gap       = boss.score - player.score

  return {
    triggered:     true,
    type:          'final_challenge',
    boss,
    player,
    scoreGap:      gap,
    // How many hard tasks the player needs to close the gap
    tasksToWin:    Math.ceil(gap / 300),
    message:       `⚔️ You've reached Rank 2. APEX // Olympus awaits. Close the gap of ${gap.toLocaleString()} points to claim the throne.`,
    rewards: {
      xp:          5000,
      credits:     2000,
      title:       'Olympus Slayer',
      badge:       '👑',
    },
    timeLimit:     '7 days',
  }
}
