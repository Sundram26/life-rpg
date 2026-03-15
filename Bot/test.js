// ─── BOT SYSTEM TESTS ────────────────────────────────────────────────────────
// Run with: node src/test.js

import { generateBracket, buildLeaderboard, checkFinalChallenge, tickBotScores } from './botFactory.js'
import { calculateChallengeProgress, CHALLENGE_STAGES } from './finalChallenge.js'

let passed = 0, failed = 0

function assert(label, condition, got) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}  →  got: ${JSON.stringify(got)}`)
    failed++
  }
}

function section(title) {
  console.log(`\n${title}`)
}

// ─── 1. BOT GENERATION ───────────────────────────────────────────────────────
section('🤖 Bot generation')

const { bots: newcomerBots, bracketName: nb } = generateBracket(1, 500)
const { bots: legendBots,   bracketName: lb } = generateBracket(15, 8000)

assert('Newcomer bracket name is correct',    nb === 'newcomer', nb)
assert('Legend bracket name is correct',      lb === 'legend',   lb)
assert('Newcomer has 9 bots (8 + boss)',       newcomerBots.length === 9,  newcomerBots.length)
assert('Legend has 10 bots (9 + boss)',        legendBots.length === 10, legendBots.length)

const boss = newcomerBots.find(b => b.isBoss)
assert('Boss is always present',              !!boss, null)
assert('Boss username includes Olympus',       boss.username.includes('Olympus'), boss.username)
assert('Boss level is 99',                    boss.level === 99, boss.level)
assert('Boss is marked isBoss=true',          boss.isBoss === true, boss.isBoss)

// City-based names
const nonBoss = newcomerBots.filter(b => !b.isBoss)
assert('All non-boss bots have city in name', nonBoss.every(b => b.username.split(' ').length >= 2), nonBoss.map(b => b.username))
assert('All bots have valid class',           [...newcomerBots, ...legendBots]
  .filter(b => !b.isBoss)
  .every(b => ['scholar','warrior','monk','creator'].includes(b.playerClass)), null)
assert('All bots have an avatar emoji',       newcomerBots.every(b => b.avatar && b.avatar.length > 0), null)

// ─── 2. DETERMINISM ──────────────────────────────────────────────────────────
section('🔁 Determinism (same seed = same bots)')

const { bots: bots1 } = generateBracket(5, 1000)
const { bots: bots2 } = generateBracket(5, 1000)
assert('Same inputs → same bot names',     JSON.stringify(bots1.map(b => b.username)) === JSON.stringify(bots2.map(b => b.username)), null)
assert('Same inputs → same scores',        JSON.stringify(bots1.map(b => b.score))    === JSON.stringify(bots2.map(b => b.score)),    null)

// ─── 3. BOSS SCORE DOMINANCE ─────────────────────────────────────────────────
section('👑 Boss always leads')

for (const level of [1, 5, 10, 15]) {
  const playerScore = level * 500
  const { bots }    = generateBracket(level, playerScore)
  const boss        = bots.find(b => b.isBoss)
  const maxOther    = Math.max(...bots.filter(b => !b.isBoss).map(b => b.score), playerScore)
  assert(`Boss score (${boss.score}) > all others (${maxOther}) at level ${level}`,
    boss.score > maxOther, `boss=${boss.score} maxOther=${maxOther}`)
}

// ─── 4. LEADERBOARD BUILDING ─────────────────────────────────────────────────
section('📊 Leaderboard building & ranking')

const mockPlayer = {
  uid: 'player_123', username: 'TestHero', avatar_emoji: '⚔️',
  playerClass: 'scholar', level: 3, score: 1200,
  streakDays: 5, tasksCompleted: 20, weeklyCredits: 480, weeklyXp: 480,
}
const { bots: testBots }  = generateBracket(3, 1200)
const leaderboard         = buildLeaderboard(testBots, mockPlayer)

assert('Leaderboard has entries',           leaderboard.entries.length > 0, leaderboard.entries.length)
assert('All entries have a rank',           leaderboard.entries.every(e => e.rank > 0), null)
assert('Ranks are sequential starting at 1', leaderboard.entries[0].rank === 1, leaderboard.entries[0].rank)
assert('Ranks increase down the list',      leaderboard.entries.every((e, i) => i === 0 || e.rank > leaderboard.entries[i-1].rank), null)
assert('Player is in leaderboard',          leaderboard.playerRank !== null, leaderboard.playerRank)
assert('Boss is rank 1',                    leaderboard.bossRank === 1, leaderboard.bossRank)
assert('Entries sorted by score desc',      leaderboard.entries.every((e, i) => i === 0 || e.score <= leaderboard.entries[i-1].score), null)

// ─── 5. FINAL CHALLENGE TRIGGER ──────────────────────────────────────────────
section('⚔️  Final challenge trigger')

// Craft a leaderboard where player is rank 2
const lowScoreBots = testBots.map(b => {
  if (b.isBoss) return { ...b, score: 5000 }
  return { ...b, score: 100 }  // All bots much lower than player
})

const highPlayer = { ...mockPlayer, score: 4000 }
const lb2 = buildLeaderboard(lowScoreBots, highPlayer)

// Manually set ranks to simulate rank-2
lb2.entries.forEach((e, i) => { e.rank = i + 1 })
lb2.bossRank   = 1
lb2.playerRank = 2

const challenge = checkFinalChallenge(lb2)
assert('Final challenge triggers at rank 2',     challenge.triggered === true,  challenge.triggered)
assert('Challenge has score gap',                challenge.scoreGap > 0,         challenge.scoreGap)
assert('Challenge has tasks to win',             challenge.tasksToWin > 0,       challenge.tasksToWin)
assert('Challenge has reward XP',                challenge.rewards.xp === 5000,  challenge.rewards.xp)
assert('Challenge has boss reference',           !!challenge.boss,               challenge.boss)
assert('Challenge has 7-day time limit',         challenge.timeLimit === '7 days', challenge.timeLimit)

// No trigger if player is rank 3
const lb3 = buildLeaderboard(testBots, { ...mockPlayer, score: 50 })
lb3.bossRank   = 1
lb3.playerRank = 3
const noChallenge = checkFinalChallenge(lb3)
assert('No challenge at rank 3',                 noChallenge.triggered === false, noChallenge.triggered)

// No trigger if player is rank 1 (already beat boss somehow)
lb3.playerRank = 1
lb3.bossRank   = 2
const noChallenge2 = checkFinalChallenge(lb3)
assert('No challenge if player already rank 1',  noChallenge2.triggered === false, noChallenge2.triggered)

// ─── 6. CHALLENGE PROGRESS ───────────────────────────────────────────────────
section('📈 Challenge progress calculation')

const mockChallenge = { score_gap: 1000, boss_score_at_trigger: 5000 }

const prog0   = calculateChallengeProgress(mockChallenge, 4000, 5000)   // just started
const prog50  = calculateChallengeProgress(mockChallenge, 4500, 5000)   // halfway
const prog100 = calculateChallengeProgress(mockChallenge, 5001, 5000)   // won

assert('0% progress at start',               prog0.pct_closed   === 0,   prog0.pct_closed)
assert('50% progress halfway',               prog50.pct_closed  === 50,  prog50.pct_closed)
assert('100% progress on victory',           prog100.pct_closed === 100, prog100.pct_closed)
assert('Correct stage at 0%',                prog0.current_stage.id  === 'awakening', prog0.current_stage.id)
assert('Correct stage at 50%',               prog50.current_stage.id === 'pressure',  prog50.current_stage.id)
assert('Correct stage at 100% (victory)',    prog100.current_stage.id === 'victory',  prog100.current_stage.id)
assert('100% is complete',                   prog100.is_complete === true, prog100.is_complete)
assert('Tasks remaining decreases',          prog50.tasks_remaining < prog0.tasks_remaining, `${prog0.tasks_remaining} → ${prog50.tasks_remaining}`)

// All stages have required fields
CHALLENGE_STAGES.forEach(s => {
  assert(`Stage "${s.id}" has narrative`, typeof s.narrative === 'string' && s.narrative.length > 0, s.id)
  assert(`Stage "${s.id}" has reward`,    typeof s.reward === 'object', s.id)
})

// ─── 7. DAILY TICK ───────────────────────────────────────────────────────────
section('📅 Daily tick simulation')

const { bots: tickBots } = generateBracket(5, 1000)
const nonBossBefore = tickBots.filter(b => !b.isBoss)
const ticked        = tickBotScores(nonBossBefore)

assert('Tick returns same count',          ticked.length === nonBossBefore.length, ticked.length)
assert('Most bots gain score after tick',
  ticked.filter((b, i) => b.score >= nonBossBefore[i].score).length >= nonBossBefore.length * 0.6,
  ticked.map((b, i) => b.score - nonBossBefore[i].score))

// Tick is deterministic
const ticked2 = tickBotScores(nonBossBefore)
assert('Tick is deterministic',            JSON.stringify(ticked.map(b => b.score)) === JSON.stringify(ticked2.map(b => b.score)), null)

// ─── 8. BRACKET COMPOSITION ──────────────────────────────────────────────────
section('🎯 Bracket composition by player level')

const brackets = [
  [1,  'newcomer', 9  ],
  [5,  'rising',   10 ],
  [10, 'veteran',  10 ],
  [15, 'legend',   10 ],
]
for (const [level, expectedBracket, expectedCount] of brackets) {
  const { bots: b, bracketName: bn } = generateBracket(level, 0)
  assert(`Level ${level} → bracket=${expectedBracket}, bots=${expectedCount}`,
    bn === expectedBracket && b.length === expectedCount,
    `bracket=${bn} bots=${b.length}`)
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(52)}`)
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`)
console.log(failed === 0 ? '  🎉 All tests passed!\n' : '  ⚠️  Some tests failed\n')
process.exit(failed > 0 ? 1 : 0)
