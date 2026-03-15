// ─── TEST SUITE ───────────────────────────────────────────────────────────────
// Runs without a Gemini API key — tests rule engine + fallback paths.
// Run with:  node src/test.js

import { runRuleEngine, timeMultiplier, timeToDifficulty } from './ruleEngine.js'
import { evaluateTask, evaluateBatch }                     from './evaluator.js'

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

// ─── 1. TIME HELPERS ──────────────────────────────────────────────────────────
console.log('\n📐 Time helpers')
assert('15 min → easy',    timeToDifficulty(15)  === 'easy',   timeToDifficulty(15))
assert('30 min → medium',  timeToDifficulty(30)  === 'medium', timeToDifficulty(30))
assert('60 min → hard',    timeToDifficulty(60)  === 'hard',   timeToDifficulty(60))
assert('120 min → epic',   timeToDifficulty(120) === 'epic',   timeToDifficulty(120))
assert('0 min mult → 0.5', timeMultiplier(0)   === 0.5, timeMultiplier(0))
assert('30 min mult → 1',  timeMultiplier(30)  === 1.0, timeMultiplier(30))
assert('180 min mult → 2', timeMultiplier(180) === 2.0, timeMultiplier(180))

// ─── 2. RULE ENGINE — PRODUCTIVE ─────────────────────────────────────────────
console.log('\n📘 Rule engine: productive')

const productiveCases = [
  ['Studied organic chemistry for 30 minutes', 30, 'intelligence'],
  ['Read a chapter of Atomic Habits', 20, 'intelligence'],
  ['Completed a Python coding tutorial', 45, 'intelligence'],
  ['Morning workout at the gym', 60, 'strength'],
  ['Went for a 5km run', 40, 'strength'],
  ['Did yoga for 20 minutes', 20, 'strength'],
  ['Journaled about my goals', 15, 'discipline'],
  ['Planned my week and made a to-do list', 30, 'discipline'],
  ['No phone for 2 hours while working', 120, 'discipline'],
  ['Called my parents and caught up', 30, 'social'],
  ['Attended a networking meetup', 90, 'social'],
  ['Presented a project to my team', 45, 'social'],
]

for (const [desc, mins, expectedStat] of productiveCases) {
  const r = runRuleEngine(desc, mins)
  assert(
    `"${desc.slice(0, 40)}..." → ${expectedStat}`,
    r !== null && r.category === 'productive' && r.stat === expectedStat,
    r ? `cat=${r.category} stat=${r.stat}` : 'null',
  )
}

// ─── 3. RULE ENGINE — UNPRODUCTIVE ───────────────────────────────────────────
console.log('\n📵 Rule engine: unproductive')

const unproductiveCases = [
  ['Scrolled Instagram for 30 minutes', 30],
  ['Watched Netflix for 2 hours', 120],
  ['Played video games mindlessly for hours', 90],
  ['Spent time browsing TikTok', 45],
  ['Wasted time doing nothing', 60],
  ['Procrastinated on all my work', 60],
]

for (const [desc, mins] of unproductiveCases) {
  const r = runRuleEngine(desc, mins)
  assert(
    `"${desc.slice(0, 40)}..." → unproductive, negative credits`,
    r !== null && r.category === 'unproductive' && r.credits < 0,
    r ? `cat=${r.category} credits=${r.credits}` : 'null',
  )
}

// ─── 4. RULE ENGINE — UNCERTAIN (returns null → AI path) ─────────────────────
console.log('\n🤔 Rule engine: uncertain → returns null')

const uncertainCases = [
  ['Cooked dinner',         20],
  ['Had a long shower',     30],
  ['Did some thinking',     45],
  ['Hung out with friends', 120],
  ['Just chilling',         60],
]

for (const [desc, mins] of uncertainCases) {
  const r = runRuleEngine(desc, mins)
  assert(
    `"${desc}" → null (uncertain)`,
    r === null,
    r,
  )
}

// ─── 5. REWARD SCALING ───────────────────────────────────────────────────────
console.log('\n💰 Reward scaling with time')

const short  = runRuleEngine('studied chemistry', 15)
const medium = runRuleEngine('studied chemistry', 45)
const long   = runRuleEngine('studied chemistry', 120)

assert('Longer study → more XP', long.xp_awarded > medium.xp_awarded && medium.xp_awarded > short.xp_awarded,
  `${short.xp_awarded} < ${medium.xp_awarded} < ${long.xp_awarded}`)
assert('Longer study → more credits', long.credits > medium.credits && medium.credits > short.credits,
  `${short.credits} < ${medium.credits} < ${long.credits}`)
assert('Short study is easy difficulty', short.difficulty === 'easy', short.difficulty)
assert('Long study is epic difficulty',  long.difficulty  === 'epic', long.difficulty)

// ─── 6. COST SCALING FOR UNPRODUCTIVE ────────────────────────────────────────
console.log('\n💸 Cost scaling for unproductive')

const shortScroll  = runRuleEngine('scrolled instagram', 10)
const longScroll   = runRuleEngine('scrolled instagram', 120)
assert('Longer scrolling → bigger credit cost',
  longScroll.credits < shortScroll.credits,
  `${longScroll.credits} < ${shortScroll.credits}`)
assert('Unproductive has no XP', shortScroll.xp_awarded === 0, shortScroll.xp_awarded)
assert('Unproductive credits are negative', longScroll.credits < 0, longScroll.credits)

// ─── 7. FULL EVALUATOR — FALLBACK (no API key) ───────────────────────────────
console.log('\n🔄 Full evaluator: fallback when AI unavailable')

// Clear the env key to force fallback path
const originalKey = process.env.GEMINI_API_KEY
delete process.env.GEMINI_API_KEY

try {
  // High-confidence rule match — should NOT need AI
  const r1 = await evaluateTask('Studied calculus', 60)
  assert('Rule-match bypasses AI entirely', r1.evaluation.source === 'rules', r1.evaluation.source)
  assert('Calculus → intelligence', r1.stat.primary === 'intelligence', r1.stat.primary)
  assert('60 min → hard', r1.rewards.difficulty === 'hard', r1.rewards.difficulty)
  assert('Productive earns credits', r1.rewards.credits > 0, r1.rewards.credits)
  assert('Productive earns XP', r1.rewards.xp > 0, r1.rewards.xp)
  assert('Has reasoning text', typeof r1.feedback.reasoning === 'string', r1.feedback.reasoning)

  // Unproductive rule match
  const r2 = await evaluateTask('Watched Netflix for ages', 90)
  assert('Netflix → unproductive', r2.evaluation.category === 'unproductive', r2.evaluation.category)
  assert('Netflix costs credits',  r2.rewards.credits < 0, r2.rewards.credits)
  assert('Netflix earns no XP',    r2.rewards.xp === 0,    r2.rewards.xp)

  // Uncertain → fallback (no AI key)
  const r3 = await evaluateTask('Did some cooking', 30)
  assert('Uncertain falls back gracefully',  r3.evaluation.source !== 'ai', r3.evaluation.source)
  assert('Fallback result has all fields',
    r3.rewards.xp !== undefined && r3.stat.primary !== undefined,
    r3)

  // Cache test — call same thing twice
  const r4a = await evaluateTask('Studied calculus', 60)
  const r4b = await evaluateTask('Studied calculus', 60)
  assert('Second call hits cache', r4b.meta.from_cache === true, r4b.meta)

} catch (e) {
  console.log('  ❌ Evaluator threw:', e.message)
  failed++
}

// ─── 8. BATCH EVALUATOR ───────────────────────────────────────────────────────
console.log('\n📦 Batch evaluator')

try {
  const batch = await evaluateBatch([
    { description: 'Morning workout', minutesSpent: 45 },
    { description: 'Read a book chapter', minutesSpent: 30 },
    { description: 'Scrolled Instagram', minutesSpent: 60 },
  ])
  assert('Batch returns 3 results', batch.results.length === 3, batch.results.length)
  assert('Batch summary has total_xp', typeof batch.summary.total_xp === 'number', batch.summary)
  assert('Batch counts productive', batch.summary.productive_count >= 2, batch.summary.productive_count)
  assert('Batch counts unproductive', batch.summary.unproductive_count >= 1, batch.summary.unproductive_count)
} catch (e) {
  console.log('  ❌ Batch threw:', e.message)
  failed++
}

// ─── 9. INPUT VALIDATION ──────────────────────────────────────────────────────
console.log('\n🛡️  Input validation')

try {
  await evaluateTask('', 30)
  assert('Empty description throws', false, 'no error thrown')
} catch (e) {
  assert('Empty description throws', e.message.includes('short') || e.message.includes('string'), e.message)
}

try {
  await evaluateTask('Valid description', 0)
  assert('Zero minutes throws', false, 'no error thrown')
} catch (e) {
  assert('Zero minutes throws', e.message.includes('positive'), e.message)
}

try {
  await evaluateTask('x'.repeat(301), 30)
  assert('Too-long description throws', false, 'no error thrown')
} catch (e) {
  assert('Too-long description throws', e.message.includes('long'), e.message)
}

// ─── RESTORE ENV ─────────────────────────────────────────────────────────────
if (originalKey) process.env.GEMINI_API_KEY = originalKey

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`)
console.log(failed === 0 ? '  🎉 All tests passed!\n' : '  ⚠️  Some tests failed\n')
process.exit(failed > 0 ? 1 : 0)
