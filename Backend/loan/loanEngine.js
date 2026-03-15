// ─── LOAN ENGINE ─────────────────────────────────────────────────────────────
// Core logic for the task-based repayment system.
// Pure functions — no Firestore imports here so the engine is fully testable.

import {
  LOAN_TIERS, QUEST_TEMPLATES, REPAYMENT_BUNDLES,
  OVERDUE_ESCALATION, PARTIAL_GRACE,
} from './loanConstants.js'

// ─── ISSUE A LOAN ─────────────────────────────────────────────────────────────

/**
 * Validate and build a new loan document.
 * Does NOT write to Firestore — returns a plain object for the caller to persist.
 *
 * @param {string}  userId
 * @param {string}  tierId        — 'small' | 'medium' | 'large' | 'epic'
 * @param {number}  playerLevel
 * @param {boolean} hasActiveLoan — true if the player already has an open loan
 * @returns {{ ok: true, loan: LoanDoc } | { ok: false, error: string }}
 */
export function issueLoan(userId, tierId, playerLevel, hasActiveLoan) {
  const tier = LOAN_TIERS[tierId]
  if (!tier) return { ok: false, error: `Unknown loan tier: "${tierId}"` }
  if (playerLevel < tier.min_level) {
    return { ok: false, error: `Level ${tier.min_level} required for ${tier.label}. You are level ${playerLevel}.` }
  }
  if (hasActiveLoan) {
    return { ok: false, error: 'You already have an active loan. Complete its quests before taking another.' }
  }

  const bundle = REPAYMENT_BUNDLES[tierId]
  const now    = new Date()
  const due    = new Date(now)
  due.setDate(due.getDate() + tier.deadline)

  // Build the quest list from templates
  const quests = bundle.quests.map((q, i) => ({
    quest_id:      `${tierId}_${i}`,
    template_id:   q.template,
    name:          QUEST_TEMPLATES[q.template].name,
    stat:          QUEST_TEMPLATES[q.template].stat,
    icon:          QUEST_TEMPLATES[q.template].icon,
    minutes:       QUEST_TEMPLATES[q.template].minutes,
    xp_reward:     QUEST_TEMPLATES[q.template].xp,
    required:      q.required,
    completed:     false,
    completed_at:  null,
  }))

  return {
    ok: true,
    loan: {
      user_id:           userId,
      tier_id:           tierId,
      tier_label:        tier.label,
      credits_borrowed:  tier.credits,
      status:            'active',          // 'active' | 'cleared' | 'defaulted' | 'partial'
      quests,
      required_count:    quests.filter(q => q.required).length,
      completed_count:   0,
      issued_at:         now.toISOString(),
      due_at:            due.toISOString(),
      cleared_at:        null,
      penalty:           tier.penalty,
      days_overdue:      0,
      overdue_penalty_applied: false,
      shop_locked_until: null,
    },
  }
}

// ─── COMPLETE A QUEST ─────────────────────────────────────────────────────────

/**
 * Mark a single repayment quest as completed.
 * Returns the updated loan + a result summary.
 */
export function completeRepaymentQuest(loan, questId) {
  if (loan.status !== 'active') {
    return { ok: false, error: `Loan is ${loan.status} — cannot complete quests on it.` }
  }

  const quest = loan.quests.find(q => q.quest_id === questId)
  if (!quest)    return { ok: false, error: `Quest "${questId}" not found in this loan.` }
  if (quest.completed) return { ok: false, error: 'Quest already completed.' }

  // Mark quest done
  const updatedQuests = loan.quests.map(q =>
    q.quest_id === questId
      ? { ...q, completed: true, completed_at: new Date().toISOString() }
      : q
  )

  const completedCount   = updatedQuests.filter(q => q.completed).length
  const requiredCompleted = updatedQuests.filter(q => q.required && q.completed).length
  const totalRequired     = updatedQuests.filter(q => q.required).length
  const allRequiredDone   = requiredCompleted === totalRequired

  const updatedLoan = {
    ...loan,
    quests:          updatedQuests,
    completed_count: completedCount,
  }

  return {
    ok:                  true,
    loan:                updatedLoan,
    quest_completed:     quest,
    xp_earned:           quest.xp_reward,
    all_required_done:   allRequiredDone,
    required_remaining:  totalRequired - requiredCompleted,
    // Trigger resolve if all required quests are done
    should_resolve:      allRequiredDone,
  }
}

// ─── RESOLVE A LOAN (cleared) ─────────────────────────────────────────────────

/**
 * Mark the loan as cleared when all required quests are complete.
 * Returns stat bonuses (clearing a loan earns a discipline bonus).
 */
export function resolveLoan(loan) {
  if (loan.status !== 'active') {
    return { ok: false, error: `Cannot resolve a ${loan.status} loan.` }
  }

  const requiredDone = loan.quests.filter(q => q.required && q.completed).length
  const totalReq     = loan.quests.filter(q => q.required).length

  if (requiredDone < totalReq) {
    return { ok: false, error: `${totalReq - requiredDone} required quests still incomplete.` }
  }

  // Bonus XP from optional quests completed
  const optionalXp = loan.quests
    .filter(q => !q.required && q.completed)
    .reduce((sum, q) => sum + q.xp_reward, 0)

  // Discipline bonus for clearing a loan — reward the behaviour
  const disciplineBonus = { small: 2, medium: 4, large: 8, epic: 15 }[loan.tier_id] ?? 2

  return {
    ok:                true,
    loan: {
      ...loan,
      status:     'cleared',
      cleared_at: new Date().toISOString(),
    },
    rewards: {
      discipline_bonus: disciplineBonus,
      optional_xp:      optionalXp,
      badge:            'Debt Slayer',
      message:          `🎉 Loan cleared! +${disciplineBonus} Discipline for keeping your word.`,
    },
  }
}

// ─── CHECK OVERDUE STATUS ─────────────────────────────────────────────────────

/**
 * Calculate how overdue the loan is and what penalties apply.
 * Pure function — call this on every profile load to keep state current.
 */
export function checkOverdueStatus(loan) {
  if (loan.status !== 'active') return { overdue: false, days: 0 }

  const due      = new Date(loan.due_at)
  const now      = new Date()
  const msPerDay = 86_400_000
  const daysOver = Math.max(0, Math.floor((now - due) / msPerDay))

  if (daysOver === 0) {
    const daysLeft = Math.max(0, Math.ceil((due - now) / msPerDay))
    return { overdue: false, days: 0, days_left: daysLeft }
  }

  // Escalating stat penalty
  const extraStatLoss = Math.min(
    daysOver * OVERDUE_ESCALATION.stat_loss_per_day,
    OVERDUE_ESCALATION.max_extra_loss,
  )

  // Shop lock duration
  const shopLockDays = Math.min(daysOver, OVERDUE_ESCALATION.max_shop_lock)
  const shopLockedUntil = new Date(now)
  shopLockedUntil.setDate(shopLockedUntil.getDate() + shopLockDays)

  return {
    overdue:          true,
    days:             daysOver,
    days_left:        0,
    extra_stat_loss:  extraStatLoss,
    shop_locked_days: shopLockDays,
    shop_locked_until: shopLockedUntil.toISOString(),
    leaderboard_badge: OVERDUE_ESCALATION.leaderboard_badge,
    urgency:          daysOver >= 3 ? 'critical' : daysOver >= 1 ? 'warning' : 'ok',
  }
}

// ─── DEFAULT A LOAN ───────────────────────────────────────────────────────────

/**
 * Apply full default penalty when deadline is missed.
 * Called by the daily scheduler when overdue + no progress for 3+ days.
 */
export function defaultLoan(loan) {
  if (loan.status !== 'active') {
    return { ok: false, error: `Cannot default a ${loan.status} loan.` }
  }

  const tier      = LOAN_TIERS[loan.tier_id]
  const overdue   = checkOverdueStatus(loan)
  const totalLoss = tier.penalty.amount + overdue.extra_stat_loss

  return {
    ok:   true,
    loan: {
      ...loan,
      status:                 'defaulted',
      overdue_penalty_applied: true,
      shop_locked_until:       overdue.shop_locked_until,
    },
    penalties: {
      stat:             tier.penalty.stat,
      stat_loss:        totalLoss,
      shop_locked_days: overdue.shop_locked_days,
      leaderboard_badge: 'In Debt',
      message:          `⚠️ Loan defaulted. -${totalLoss} ${tier.penalty.stat}. Shop locked for ${overdue.shop_locked_days} days.`,
    },
  }
}

// ─── PARTIAL COMPLETION ───────────────────────────────────────────────────────

/**
 * Offers a grace deal if the player completed ≥75% of required quests
 * but missed the deadline.
 * Returns whether grace is available and what the terms are.
 */
export function checkPartialGrace(loan, userCredits) {
  if (loan.status !== 'active') return { eligible: false }

  const required  = loan.quests.filter(q => q.required)
  const done      = required.filter(q => q.completed).length
  const total     = required.length
  const ratio     = done / total

  if (ratio < PARTIAL_GRACE.threshold) {
    return {
      eligible:    false,
      done,
      total,
      ratio:       Math.round(ratio * 100),
      needed:      Math.ceil(total * PARTIAL_GRACE.threshold) - done,
      message:     `Complete ${Math.ceil(total * PARTIAL_GRACE.threshold) - done} more required quests to unlock partial grace.`,
    }
  }

  const creditPenalty = Math.round(loan.credits_borrowed * PARTIAL_GRACE.credit_penalty)
  const canAfford     = userCredits >= creditPenalty
  const tier          = LOAN_TIERS[loan.tier_id]
  const reducedLoss   = Math.round(tier.penalty.amount * PARTIAL_GRACE.stat_reduction)

  return {
    eligible:       true,
    done,
    total,
    ratio:          Math.round(ratio * 100),
    credit_penalty: creditPenalty,
    can_afford:     canAfford,
    stat_loss:      reducedLoss,
    message: canAfford
      ? `You completed ${Math.round(ratio * 100)}% of quests. Pay ${creditPenalty} credits to settle with reduced penalties.`
      : `You completed ${Math.round(ratio * 100)}% of quests but need ${creditPenalty} credits for partial settlement (you have ${userCredits}).`,
  }
}

/**
 * Apply the partial grace settlement.
 */
export function applyPartialGrace(loan) {
  const tier       = LOAN_TIERS[loan.tier_id]
  const reducedLoss = Math.round(tier.penalty.amount * PARTIAL_GRACE.stat_reduction)
  const creditCost  = Math.round(loan.credits_borrowed * PARTIAL_GRACE.credit_penalty)

  return {
    ok: true,
    loan: { ...loan, status: 'partial' },
    settlement: {
      stat:          tier.penalty.stat,
      stat_loss:     reducedLoss,
      credits_paid:  creditCost,
      message:       `Settled. -${reducedLoss} ${tier.penalty.stat} and -${creditCost} credits.`,
    },
  }
}

// ─── PROGRESS SUMMARY ─────────────────────────────────────────────────────────

/**
 * Returns a formatted summary of current loan progress for the UI.
 */
export function getLoanProgress(loan) {
  const required     = loan.quests.filter(q => q.required)
  const optional     = loan.quests.filter(q => !q.required)
  const reqDone      = required.filter(q => q.completed).length
  const optDone      = optional.filter(q => q.completed).length
  const overdue      = checkOverdueStatus(loan)

  const pct = required.length > 0
    ? Math.round((reqDone / required.length) * 100)
    : 0

  return {
    loan_id:          loan.id ?? 'pending',
    tier:             loan.tier_id,
    tier_label:       loan.tier_label,
    credits_borrowed: loan.credits_borrowed,
    status:           loan.status,

    required: {
      total:     required.length,
      completed: reqDone,
      remaining: required.length - reqDone,
      pct,
    },
    optional: {
      total:     optional.length,
      completed: optDone,
    },

    due_at:    loan.due_at,
    overdue,

    quests:    loan.quests.map(q => ({
      quest_id:  q.quest_id,
      name:      q.name,
      stat:      q.stat,
      icon:      q.icon,
      minutes:   q.minutes,
      required:  q.required,
      completed: q.completed,
      xp_reward: q.xp_reward,
    })),
  }
}
