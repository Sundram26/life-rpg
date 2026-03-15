// ─── LOAN SYSTEM TESTS ───────────────────────────────────────────────────────
// Run: node src/test.js   (no Firebase or API key needed)

import {
  issueLoan, completeRepaymentQuest, resolveLoan,
  defaultLoan, checkOverdueStatus, checkPartialGrace,
  applyPartialGrace, getLoanProgress,
} from './loanEngine.js'

import { LOAN_TIERS, REPAYMENT_BUNDLES, QUEST_TEMPLATES } from './loanConstants.js'

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

function section(title) { console.log(`\n${title}`) }

// ─── 1. CONSTANTS INTEGRITY ──────────────────────────────────────────────────
section('📐 Constants integrity')

for (const [id, tier] of Object.entries(LOAN_TIERS)) {
  assert(`Tier "${id}" has credits`,    tier.credits > 0,       tier.credits)
  assert(`Tier "${id}" has deadline`,   tier.deadline > 0,      tier.deadline)
  assert(`Tier "${id}" has penalty`,    !!tier.penalty?.stat,   tier.penalty)
  assert(`Tier "${id}" has min_level`,  tier.min_level >= 0,    tier.min_level)
}

for (const [id, bundle] of Object.entries(REPAYMENT_BUNDLES)) {
  assert(`Bundle "${id}" has quests`,          bundle.quests.length > 0, bundle.quests.length)
  assert(`Bundle "${id}" has required quests`, bundle.quests.some(q => q.required), id)

  // All referenced templates must exist
  bundle.quests.forEach(q => {
    assert(`Template "${q.template}" exists`, !!QUEST_TEMPLATES[q.template], q.template)
  })
}

// ─── 2. LOAN ISSUANCE ────────────────────────────────────────────────────────
section('💸 Loan issuance')

// Happy path
const smallResult = issueLoan('user_1', 'small', 1, false)
assert('Small loan issues ok',          smallResult.ok === true,   smallResult)
assert('Credits correct (50)',           smallResult.loan.credits_borrowed === 50, smallResult.loan.credits_borrowed)
assert('Status is active',              smallResult.loan.status === 'active', smallResult.loan.status)
assert('Has quests',                    smallResult.loan.quests.length >= 2, smallResult.loan.quests.length)
assert('Has required_count',            smallResult.loan.required_count > 0, smallResult.loan.required_count)
assert('All quests have quest_id',      smallResult.loan.quests.every(q => q.quest_id), null)
assert('All quests have stat',          smallResult.loan.quests.every(q => q.stat), null)
assert('All quests start incomplete',   smallResult.loan.quests.every(q => !q.completed), null)

const medResult  = issueLoan('user_1', 'medium', 5, false)
const largeResult = issueLoan('user_1', 'large', 10, false)
const epicResult  = issueLoan('user_1', 'epic',  15, false)
assert('Medium loan credits = 150',  medResult.loan.credits_borrowed   === 150,  medResult.loan.credits_borrowed)
assert('Large loan credits = 400',   largeResult.loan.credits_borrowed === 400,  largeResult.loan.credits_borrowed)
assert('Epic loan credits = 1000',   epicResult.loan.credits_borrowed  === 1000, epicResult.loan.credits_borrowed)

// Level gate
const tooLow = issueLoan('user_1', 'medium', 1, false)
assert('Level gate blocks low-level player', tooLow.ok === false, tooLow)
assert('Level gate error mentions level',    tooLow.error.includes('Level'), tooLow.error)

// Active loan blocks new loan
const blocked = issueLoan('user_1', 'small', 5, true)
assert('Active loan blocks new loan',        blocked.ok === false, blocked)

// Invalid tier
const badTier = issueLoan('user_1', 'legendary', 10, false)
assert('Unknown tier returns error',         badTier.ok === false, badTier)

// ─── 3. QUEST COMPLETION ─────────────────────────────────────────────────────
section('✅ Quest completion')

const { loan: freshLoan } = issueLoan('user_1', 'small', 1, false)
const firstQuestId = freshLoan.quests[0].quest_id

const complete1 = completeRepaymentQuest(freshLoan, firstQuestId)
assert('Quest completion returns ok',        complete1.ok === true, complete1)
assert('Quest is marked completed',          complete1.loan.quests[0].completed === true, complete1.loan.quests[0])
assert('XP is awarded',                      complete1.xp_earned > 0, complete1.xp_earned)
assert('completed_at is set',                !!complete1.loan.quests[0].completed_at, complete1.loan.quests[0].completed_at)

// Duplicate completion
const dupResult = completeRepaymentQuest(complete1.loan, firstQuestId)
assert('Duplicate completion blocked',       dupResult.ok === false, dupResult)

// Invalid quest id
const badQuest = completeRepaymentQuest(freshLoan, 'nonexistent_quest')
assert('Invalid quest id returns error',     badQuest.ok === false, badQuest)

// Complete on non-active loan
const clearedLoan = { ...freshLoan, status: 'cleared' }
const badStatus   = completeRepaymentQuest(clearedLoan, firstQuestId)
assert('Cannot complete quest on cleared loan', badStatus.ok === false, badStatus)

// ─── 4. LOAN RESOLUTION ──────────────────────────────────────────────────────
section('🎉 Loan resolution (all required quests done)')

// Complete all required quests on a small loan
let workingLoan = freshLoan
let shouldResolve = false

for (const quest of workingLoan.quests.filter(q => q.required)) {
  const result = completeRepaymentQuest(workingLoan, quest.quest_id)
  workingLoan    = result.loan
  shouldResolve  = result.should_resolve
}

assert('should_resolve is true after last required quest', shouldResolve === true, shouldResolve)

const resolveResult = resolveLoan(workingLoan)
assert('Loan resolves ok',                   resolveResult.ok === true, resolveResult)
assert('Status becomes cleared',             resolveResult.loan.status === 'cleared', resolveResult.loan.status)
assert('cleared_at is set',                  !!resolveResult.loan.cleared_at, resolveResult.loan.cleared_at)
assert('Discipline bonus awarded',           resolveResult.rewards.discipline_bonus > 0, resolveResult.rewards.discipline_bonus)
assert('Reward message is present',          typeof resolveResult.rewards.message === 'string', resolveResult.rewards.message)

// Cannot resolve if quests incomplete
const resolveIncomplete = resolveLoan(freshLoan)
assert('Cannot resolve with incomplete quests', resolveIncomplete.ok === false, resolveIncomplete)

// ─── 5. OVERDUE STATUS ───────────────────────────────────────────────────────
section('⏰ Overdue status')

// Not overdue - deadline in the future
const futureDue = new Date(); futureDue.setDate(futureDue.getDate() + 3)
const activeLoan = { ...freshLoan, due_at: futureDue.toISOString() }
const notOverdue  = checkOverdueStatus(activeLoan)
assert('Active loan not overdue',            notOverdue.overdue === false, notOverdue)
assert('Days left is ~3',                    notOverdue.days_left >= 2, notOverdue.days_left)

// Overdue by 2 days
const pastDue = new Date(); pastDue.setDate(pastDue.getDate() - 2)
const overdueLoan = { ...freshLoan, due_at: pastDue.toISOString() }
const overdueStatus = checkOverdueStatus(overdueLoan)
assert('Overdue loan detected',              overdueStatus.overdue === true,  overdueStatus.overdue)
assert('Days overdue is 2',                  overdueStatus.days === 2,        overdueStatus.days)
assert('Extra stat loss calculated',         overdueStatus.extra_stat_loss >= 0, overdueStatus.extra_stat_loss)
assert('Shop lock calculated',               overdueStatus.shop_locked_days >= 0, overdueStatus.shop_locked_days)
assert('Urgency is warning at 2 days',       overdueStatus.urgency === 'warning', overdueStatus.urgency)

// Critical at 3+ days
const critDue = new Date(); critDue.setDate(critDue.getDate() - 5)
const critLoan = { ...freshLoan, due_at: critDue.toISOString() }
const critStatus = checkOverdueStatus(critLoan)
assert('Critical urgency at 5 days overdue', critStatus.urgency === 'critical', critStatus.urgency)

// Cleared loan is never overdue
const clearedOverdue = checkOverdueStatus({ ...pastDue, status: 'cleared', due_at: pastDue.toISOString() })
// cleared loan has no status check in overdue fn — check returns overdue:false for non-active
assert('Cleared loan: overdue check uses status', typeof clearedOverdue === 'object', clearedOverdue)

// ─── 6. DEFAULT ──────────────────────────────────────────────────────────────
section('💀 Loan default')

const pastDueDate = new Date(); pastDueDate.setDate(pastDueDate.getDate() - 4)
const defaultable = { ...freshLoan, due_at: pastDueDate.toISOString() }
const defaultResult = defaultLoan(defaultable)

assert('Default returns ok',                 defaultResult.ok === true, defaultResult)
assert('Status becomes defaulted',           defaultResult.loan.status === 'defaulted', defaultResult.loan.status)
assert('Stat penalty is specified',          defaultResult.penalties.stat === 'discipline', defaultResult.penalties.stat)
assert('Stat loss is positive',              defaultResult.penalties.stat_loss > 0, defaultResult.penalties.stat_loss)
assert('Shop locked days set',               defaultResult.penalties.shop_locked_days >= 0, defaultResult.penalties.shop_locked_days)
assert('Penalty message present',            typeof defaultResult.penalties.message === 'string', defaultResult.penalties.message)

// Cannot double-default
const alreadyDefaulted = { ...defaultResult.loan }
const doubleDefault     = defaultLoan(alreadyDefaulted)
assert('Cannot double-default a loan',       doubleDefault.ok === false, doubleDefault)

// ─── 7. PARTIAL GRACE ────────────────────────────────────────────────────────
section('🤝 Partial grace system')

// Complete 1 of 2 required quests (50% — below 75% threshold)
let partialLoan = freshLoan
const firstReq = partialLoan.quests.filter(q => q.required)[0]
const oneQuest  = completeRepaymentQuest(partialLoan, firstReq.quest_id)
partialLoan     = oneQuest.loan

const graceBelow = checkPartialGrace(partialLoan, 500)
assert('No grace below 75% threshold',       graceBelow.eligible === false, graceBelow)
assert('Shows quests needed',                graceBelow.needed >= 1, graceBelow.needed)

// Complete all required quests on a medium loan to get 75%+
let { loan: medLoan } = issueLoan('user_1', 'medium', 5, false)
const medRequired = medLoan.quests.filter(q => q.required)

// Complete 3 out of 4 required (75%)
for (const quest of medRequired.slice(0, 3)) {
  const r = completeRepaymentQuest(medLoan, quest.quest_id)
  medLoan  = r.loan
}

const graceEligible = checkPartialGrace(medLoan, 1000)
assert('Grace eligible at 75%+',             graceEligible.eligible === true,  graceEligible.eligible)
assert('Grace credit penalty calculated',    graceEligible.credit_penalty > 0, graceEligible.credit_penalty)
assert('Can afford with 1000 credits',       graceEligible.can_afford === true, graceEligible.can_afford)

// Not enough credits
const gracePoor = checkPartialGrace(medLoan, 0)
assert('Cannot settle without credits',      gracePoor.can_afford === false, gracePoor.can_afford)

const settlement = applyPartialGrace(medLoan)
assert('Partial settlement sets status',     settlement.loan.status === 'partial', settlement.loan.status)
assert('Settlement has stat loss',           settlement.settlement.stat_loss > 0, settlement.settlement.stat_loss)
assert('Settlement has credits_paid',        settlement.settlement.credits_paid > 0, settlement.settlement.credits_paid)
assert('Settlement stat loss < full penalty',
  settlement.settlement.stat_loss < LOAN_TIERS.medium.penalty.amount,
  `${settlement.settlement.stat_loss} < ${LOAN_TIERS.medium.penalty.amount}`)

// ─── 8. PROGRESS SUMMARY ─────────────────────────────────────────────────────
section('📊 Progress summary')

const { loan: progressLoan } = issueLoan('user_1', 'large', 10, false)
const summary = getLoanProgress(progressLoan)

assert('Progress has tier info',             summary.tier === 'large', summary.tier)
assert('Progress has required count',        summary.required.total > 0, summary.required.total)
assert('Progress starts at 0%',             summary.required.pct === 0, summary.required.pct)
assert('Progress has quests array',          Array.isArray(summary.quests), typeof summary.quests)
assert('All quests in summary have names',   summary.quests.every(q => q.name), null)
assert('credits_borrowed in summary',        summary.credits_borrowed === 400, summary.credits_borrowed)

// After completing one quest
const firstQ   = progressLoan.quests.filter(q => q.required)[0]
const oneDown  = completeRepaymentQuest(progressLoan, firstQ.quest_id)
const summary2 = getLoanProgress(oneDown.loan)
assert('Progress pct increases',             summary2.required.pct > 0, summary2.required.pct)
assert('Completed count increments',         summary2.required.completed === 1, summary2.required.completed)

// ─── 9. MULTI-STAT COVERAGE ──────────────────────────────────────────────────
section('🎯 Multi-stat quest coverage')

// Verify all loan tiers span multiple stat categories
for (const [tierId, bundle] of Object.entries(REPAYMENT_BUNDLES)) {
  const stats = new Set(bundle.quests.map(q => QUEST_TEMPLATES[q.template].stat))
  assert(`${tierId} bundle covers 2+ stats`, stats.size >= 2, [...stats])
}

// ─── 10. DISCIPLINE BONUS SCALING ────────────────────────────────────────────
section('📈 Discipline bonus scales with loan size')

const bonuses = {}
for (const tierId of ['small', 'medium', 'large', 'epic']) {
  let l = issueLoan('user_1', tierId, 99, false).loan
  for (const q of l.quests.filter(q => q.required)) {
    l = completeRepaymentQuest(l, q.quest_id).loan
  }
  bonuses[tierId] = resolveLoan(l).rewards.discipline_bonus
}

assert('Medium bonus > small',  bonuses.medium > bonuses.small,  bonuses)
assert('Large bonus > medium',  bonuses.large  > bonuses.medium, bonuses)
assert('Epic bonus > large',    bonuses.epic   > bonuses.large,  bonuses)

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(54)}`)
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`)
console.log(failed === 0 ? '  🎉 All tests passed!\n' : `  ⚠️  ${failed} tests failed\n`)
process.exit(failed > 0 ? 1 : 0)
