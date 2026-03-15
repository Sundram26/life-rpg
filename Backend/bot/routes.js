// ─── BOT LEADERBOARD ROUTES ──────────────────────────────────────────────────
// GET  /leaderboard/bots         — rendered leaderboard for the current player
// GET  /leaderboard/challenge    — active final challenge state
// POST /leaderboard/bots/tick    — dev: manually trigger daily tick
// POST /leaderboard/bots/reset   — dev: manually trigger weekly reset

import { Router }              from 'express'
import { generateBracket, buildLeaderboard, checkFinalChallenge } from './botFactory.js'
import { getChallengeState, updateChallengeState }                from './finalChallenge.js'
import { runDailyBotTick, runWeeklyReset }                        from './scheduler.js'

export function createBotRoutes(db, authenticate) {
  const router = Router()

  // ── GET /leaderboard/bots ────────────────────────────────────────────────────
  // Returns the full merged leaderboard (bots + player) for the calling user.
  // Query: period=weekly|alltime, limit=1-50, offset=0

  router.get('/bots', authenticate, async (req, res) => {
    try {
      const uid    = req.user.uid
      const period = req.query.period ?? 'weekly'
      const limit  = Math.min(50, parseInt(req.query.limit  ?? '25', 10))
      const offset = Math.max(0,  parseInt(req.query.offset ?? '0',  10))

      // Fetch player profile
      const [userSnap, credSnap, lbSnap] = await Promise.all([
        db.collection('users').doc(uid).get(),
        db.collection('credits').doc(uid).get(),
        db.collection('leaderboard').doc(`${uid}_weekly`).get(),
      ])

      if (!userSnap.exists) return res.status(404).json({ success: false, error: 'User not found' })

      const user    = userSnap.data()
      const credits = credSnap.exists ? credSnap.data() : {}
      const lbData  = lbSnap.exists   ? lbSnap.data()   : {}

      const playerScore = lbData.score ?? 0

      // Generate bracket for this player's level
      const { bots, bracketName } = generateBracket(user.level ?? 1, playerScore)

      // Build ranked leaderboard
      const lb = buildLeaderboard(bots, {
        uid,
        username:       user.username,
        avatar_emoji:   user.avatar_emoji,
        playerClass:    user.class,
        level:          user.level  ?? 1,
        score:          playerScore,
        streakDays:     user.streak_days    ?? 0,
        tasksCompleted: user.tasks_completed ?? 0,
        weeklyCredits:  credits.weekly_earned ?? 0,
        weeklyXp:       user.xp              ?? 0,
      })

      // Check for final challenge trigger
      const challenge  = checkFinalChallenge(lb)
      let   activeChallenge = null

      if (challenge.triggered) {
        // Fetch or create challenge state
        activeChallenge = await getChallengeState(db, uid)
        if (!activeChallenge || activeChallenge.status === 'expired') {
          // Will be created by the daily scheduler — return trigger notice
          activeChallenge = { triggered: true, ...challenge }
        }
      }

      // Paginate
      const page = lb.entries.slice(offset, offset + limit)

      return res.json({
        success:       true,
        period,
        bracket:       bracketName,
        total:         lb.totalEntries,
        offset,
        limit,
        entries:       page.map(e => ({
          rank:            e.rank,
          id:              e.id,
          username:        e.username,
          avatar:          e.avatar,
          class:           e.playerClass,
          tier:            e.tier,
          level:           e.level,
          score:           e.score,
          streak_days:     e.streakDays,
          tasks_completed: e.tasksCompleted,
          is_bot:          e.isBot,
          is_boss:         e.isBoss ?? false,
          is_you:          e.id === uid,
        })),
        your_rank:     lb.playerRank,
        boss_rank:     lb.bossRank,
        final_challenge: activeChallenge,
      })
    } catch (err) {
      console.error('[GET /leaderboard/bots]', err)
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ── GET /leaderboard/challenge ───────────────────────────────────────────────

  router.get('/challenge', authenticate, async (req, res) => {
    try {
      const uid   = req.user.uid
      const state = await getChallengeState(db, uid)

      if (!state) {
        return res.json({
          success:    true,
          active:     false,
          message:    'No active final challenge. Reach Rank 2 to trigger it.',
        })
      }

      return res.json({ success: true, active: true, challenge: state })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ── Dev routes (protect with admin check in production) ───────────────────

  router.post('/bots/tick',  authenticate, async (req, res) => {
    try {
      const result = await runDailyBotTick(db)
      res.json({ success: true, ...result })
    } catch (e) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  router.post('/bots/reset', authenticate, async (req, res) => {
    try {
      await runWeeklyReset(db)
      res.json({ success: true, message: 'Weekly reset complete' })
    } catch (e) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  return router
}
