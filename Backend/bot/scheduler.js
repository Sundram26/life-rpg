// ─── DAILY BOT SCHEDULER ─────────────────────────────────────────────────────
// Runs once per day (via cron or Cloud Scheduler).
// 1. Fetches all active bot leaderboard documents
// 2. Ticks their scores (daily activity simulation)
// 3. Re-checks every player's rank to trigger final challenges
// 4. Writes everything back to Firestore in a batch

import admin              from 'firebase-admin'
import { tickBotScores, buildLeaderboard, checkFinalChallenge, generateBracket } from './botFactory.js'

const { Timestamp, FieldValue } = admin.firestore

// ── Main scheduler function ───────────────────────────────────────────────────

export async function runDailyBotTick(db) {
  console.log(`[BotScheduler] Starting daily tick at ${new Date().toISOString()}`)
  const batch = db.batch()
  let  tickedBots = 0, challengesTriggered = 0

  // 1. Fetch all bot leaderboard entries
  const botSnap = await db
    .collection('leaderboard')
    .where('is_bot', '==', true)
    .where('period', '==', 'weekly')
    .get()

  if (botSnap.empty) {
    console.log('[BotScheduler] No bot entries found — seeding initial bots')
    await seedInitialBots(db)
    return
  }

  // 2. Group bots by bracket (each bracket ticks independently)
  const brackets = {}
  botSnap.docs.forEach(doc => {
    const data   = doc.data()
    const key    = data.bracket ?? 'newcomer'
    if (!brackets[key]) brackets[key] = []
    brackets[key].push({ ref: doc.ref, data })
  })

  // 3. Tick each bracket
  for (const [bracketName, botDocs] of Object.entries(brackets)) {
    const bots       = botDocs.map(d => d.data)
    const ticked     = tickBotScores(bots)
    const now        = Timestamp.now()

    ticked.forEach((bot, i) => {
      const ref = botDocs[i].ref
      batch.update(ref, {
        score:           bot.score,
        streak_days:     bot.streakDays,
        tasks_completed: bot.tasksCompleted,
        weekly_credits:  bot.weeklyCredits,
        is_bot:          true,
        updated_at:      now,
      })
      tickedBots++
    })
  }

  // 4. Check all real players for rank-2 trigger
  const playerSnap = await db
    .collection('leaderboard')
    .where('is_bot',  '==', false)
    .where('period', '==', 'weekly')
    .get()

  for (const playerDoc of playerSnap.docs) {
    const playerData = playerDoc.data()
    const uid        = playerData.user_id

    // Get this player's bracket bots
    const bracket    = playerData.bracket ?? 'newcomer'
    const bracketBots = botSnap.docs
      .filter(d => d.data().bracket === bracket)
      .map(d => d.data())

    const lb         = buildLeaderboard(bracketBots, {
      uid,
      username:       playerData.username,
      avatar_emoji:   playerData.avatar_emoji,
      playerClass:    playerData.class,
      level:          playerData.level,
      score:          playerData.score,
      streakDays:     playerData.streak_days,
      tasksCompleted: playerData.tasks_completed,
      weeklyCredits:  playerData.weekly_credits ?? 0,
      weeklyXp:       playerData.xp_earned      ?? 0,
    })

    const challenge = checkFinalChallenge(lb)

    if (challenge.triggered) {
      // Write challenge document if not already active
      const challengeRef = db.collection('final_challenges').doc(uid)
      const existing     = await challengeRef.get()

      if (!existing.exists || existing.data().status === 'completed') {
        batch.set(challengeRef, {
          user_id:        uid,
          username:       playerData.username,
          triggered_at:   Timestamp.now(),
          status:         'active',
          score_gap:      challenge.scoreGap,
          tasks_to_win:   challenge.tasksToWin,
          time_limit:     challenge.timeLimit,
          rewards:        challenge.rewards,
          boss_score_at_trigger: challenge.boss.score,
          expires_at:     Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        })
        challengesTriggered++
        console.log(`[BotScheduler] Final challenge triggered for ${playerData.username} (rank 2)`)
      }
    }

    // Update player's rank in their leaderboard doc
    batch.update(playerDoc.ref, {
      rank:       lb.playerRank,
      updated_at: Timestamp.now(),
    })
  }

  await batch.commit()
  console.log(`[BotScheduler] Done — ticked ${tickedBots} bots, triggered ${challengesTriggered} challenges`)
  return { tickedBots, challengesTriggered }
}

// ── Weekly reset ──────────────────────────────────────────────────────────────
// Resets weekly scores every Monday. Preserves all-time scores separately.

export async function runWeeklyReset(db) {
  console.log(`[BotScheduler] Running weekly reset at ${new Date().toISOString()}`)
  const batch = db.batch()

  const snap = await db
    .collection('leaderboard')
    .where('period', '==', 'weekly')
    .get()

  snap.docs.forEach(doc => {
    batch.update(doc.ref, {
      score:          0,
      weekly_credits: 0,
      xp_earned:      0,
      tasks_completed: 0,
      updated_at:     Timestamp.now(),
    })
  })

  // Re-seed bots from scratch with new week's seed
  await batch.commit()
  await seedInitialBots(db)
  console.log('[BotScheduler] Weekly reset complete')
}

// ── Seed initial bots for a new week ─────────────────────────────────────────

async function seedInitialBots(db) {
  const brackets = ['newcomer', 'rising', 'veteran', 'legend']
  const batch    = db.batch()
  const now      = Timestamp.now()

  for (const bracket of brackets) {
    // Use a dummy player level to generate the right bracket composition
    const playerLevel = { newcomer: 1, rising: 5, veteran: 10, legend: 15 }[bracket]
    const { bots }    = generateBracket(playerLevel, 0)

    bots.forEach(bot => {
      const ref = db.collection('leaderboard').doc(`${bot.id}_weekly`)
      batch.set(ref, {
        user_id:         bot.id,
        username:        bot.username,
        avatar_emoji:    bot.avatar,
        class:           bot.playerClass,
        tier:            bot.tier,
        level:           bot.level,
        period:          'weekly',
        bracket,
        score:           bot.score,
        rank:            0,         // assigned after merge with players
        streak_days:     bot.streakDays,
        tasks_completed: bot.tasksCompleted,
        weekly_credits:  bot.weeklyCredits,
        xp_earned:       bot.weeklyXp,
        is_bot:          true,
        is_boss:         bot.isBoss ?? false,
        updated_at:      now,
      }, { merge: true })
    })
  }

  await batch.commit()
  console.log('[BotScheduler] Initial bots seeded for all brackets')
}

// ── Express route helper (on-demand tick for dev/testing) ─────────────────────
export function createSchedulerRoutes(router, db) {
  router.post('/bots/tick', async (req, res) => {
    try {
      const result = await runDailyBotTick(db)
      res.json({ success: true, ...result })
    } catch (e) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  router.post('/bots/reset', async (req, res) => {
    try {
      await runWeeklyReset(db)
      res.json({ success: true, message: 'Weekly reset complete' })
    } catch (e) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  return router
}
