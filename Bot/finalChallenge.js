// ─── FINAL CHALLENGE SYSTEM ──────────────────────────────────────────────────
// Manages the multi-stage boss battle triggered when player reaches Rank 2.
// The challenge is purely score-based — the player must out-grind APEX.
// Stages add narrative and escalating rewards as the gap closes.

// Firebase Timestamp helper — falls back gracefully when running tests without firebase-admin
let Timestamp
try {
  const admin = (await import('firebase-admin')).default
  Timestamp = admin.firestore.Timestamp
} catch {
  Timestamp = { now: () => ({ toMillis: () => Date.now() }), fromDate: (d) => ({ toMillis: () => d.getTime() }) }
}

// ── Challenge stages (based on % of gap closed) ───────────────────────────────

export const CHALLENGE_STAGES = [
  {
    id:         'awakening',
    pct:        0,    // triggered at 0% (challenge start)
    title:      'The Throne Beckons',
    narrative:  `APEX // Olympus stirs. After 312 days unchallenged, they have
noticed you. For the first time in months, their daily output increases.
The city-bots whisper your name in fear and awe.
The final ascent begins.`,
    boss_message: `"You've come further than most. But most didn't face me at full strength."`,
    reward:     { xp: 200, credits: 100 },
  },
  {
    id:         'pursuit',
    pct:        25,   // 25% of gap closed
    title:      'The Gap Narrows',
    narrative:  `You've proven you're not another pretender. APEX increases their
daily training. The scoreboard trembles. Tokyo Scholar and London Monk
fall back — the top is thinning out. Only you and APEX remain in focus.`,
    boss_message: `"Impressive. But consistency is where challengers always break. Prove me wrong."`,
    reward:     { xp: 500, credits: 250 },
  },
  {
    id:         'pressure',
    pct:        50,   // 50% of gap closed
    title:      'Equal Footing',
    narrative:  `Halfway there. APEX activates maximum output — every streak bonus,
every epic quest, every discipline task pushed to the limit. The leaderboard
has never seen a race like this. The city-bots are watching.`,
    boss_message: `"You've earned my full attention. Now face what that means."`,
    reward:     { xp: 1000, credits: 500 },
    specialEffect: 'boss_rage',  // Boss daily gain increases 25% in this stage
  },
  {
    id:         'edge',
    pct:        80,   // 80% of gap closed
    title:      'The Edge of Olympus',
    narrative:  `You're within striking distance. APEX has not missed a single
task in 312 days. Their legend is about to be tested for the first time.
The world is watching. Do not blink.`,
    boss_message: `"This is where every challenger has turned back. The throne demands everything."`,
    reward:     { xp: 1500, credits: 750 },
  },
  {
    id:         'victory',
    pct:        100,  // gap fully closed — player overtakes
    title:      '👑 Olympus Falls',
    narrative:  `IMPOSSIBLE. For the first time in 312 days, APEX // Olympus has
been overtaken. The leaderboard refreshes. The city-bots go silent.
YOUR name sits at Rank 1.
A new legend is written — and it belongs to you.`,
    boss_message: `"...You've earned it. The throne is yours. For now."`,
    reward:     { xp: 5000, credits: 2000, title: 'Olympus Slayer', badge: '👑' },
    specialEffect: 'throne_claimed',
  },
]

// ── Stage calculator ───────────────────────────────────────────────────────────

export function calculateChallengeProgress(challenge, currentPlayerScore, currentBossScore) {
  const originalGap  = challenge.boss_score_at_trigger - (currentPlayerScore - (currentBossScore - challenge.boss_score_at_trigger))
  const currentGap   = Math.max(0, currentBossScore - currentPlayerScore)
  const closedAmount = Math.max(0, challenge.score_gap - currentGap)
  const pctClosed    = Math.min(100, Math.round((closedAmount / challenge.score_gap) * 100))

  // Find the highest stage that has been reached
  const currentStage = CHALLENGE_STAGES
    .filter(s => pctClosed >= s.pct)
    .at(-1) ?? CHALLENGE_STAGES[0]

  // Find the next upcoming stage
  const nextStage = CHALLENGE_STAGES.find(s => s.pct > pctClosed) ?? null

  return {
    pct_closed:     pctClosed,
    score_gap:      currentGap,
    original_gap:   challenge.score_gap,
    current_stage:  currentStage,
    next_stage:     nextStage,
    is_complete:    pctClosed >= 100,
    tasks_remaining: Math.ceil(currentGap / 300),
  }
}

// ── Check and update challenge state ──────────────────────────────────────────

export async function updateChallengeState(db, uid, playerScore, bossScore) {
  const challengeRef  = db.collection('final_challenges').doc(uid)
  const challengeSnap = await challengeRef.get()

  if (!challengeSnap.exists) return null

  const challenge = challengeSnap.data()
  if (challenge.status !== 'active') return challenge

  // Check expiry
  if (challenge.expires_at.toMillis() < Date.now()) {
    await challengeRef.update({ status: 'expired', updated_at: Timestamp.now() })
    return { ...challenge, status: 'expired' }
  }

  const progress = calculateChallengeProgress(challenge, playerScore, bossScore)

  // Check for newly reached stages
  const reachedStages    = challenge.reached_stages ?? []
  const newlyReached     = CHALLENGE_STAGES.filter(
    s => progress.pct_closed >= s.pct && !reachedStages.includes(s.id)
  )

  const updates = {
    pct_closed:      progress.pct_closed,
    current_stage:   progress.current_stage.id,
    tasks_remaining: progress.tasks_remaining,
    updated_at:      Timestamp.now(),
  }

  if (newlyReached.length > 0) {
    updates.reached_stages = [...reachedStages, ...newlyReached.map(s => s.id)]

    // Check for victory
    if (newlyReached.some(s => s.id === 'victory')) {
      updates.status        = 'completed'
      updates.completed_at  = Timestamp.now()
    }
  }

  await challengeRef.update(updates)

  return {
    ...challenge,
    ...updates,
    progress,
    newly_reached_stages: newlyReached,
  }
}

// ── Get challenge state for profile ───────────────────────────────────────────

export async function getChallengeState(db, uid) {
  const snap = await db.collection('final_challenges').doc(uid).get()
  if (!snap.exists) return null

  const data = snap.data()
  return {
    id:             snap.id,
    status:         data.status,           // 'active' | 'completed' | 'expired'
    triggered_at:   data.triggered_at?.toDate(),
    expires_at:     data.expires_at?.toDate(),
    pct_closed:     data.pct_closed    ?? 0,
    score_gap:      data.score_gap,
    tasks_remaining: data.tasks_remaining,
    current_stage:  CHALLENGE_STAGES.find(s => s.id === data.current_stage) ?? CHALLENGE_STAGES[0],
    reached_stages: data.reached_stages ?? [],
    rewards:        data.rewards,
    is_complete:    data.status === 'completed',
  }
}
