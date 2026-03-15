// ─── LOAN PERSISTENCE (Firestore) ────────────────────────────────────────────
// All Firestore reads and writes for the loan system.
// Keeps loanEngine.js pure and the DB logic in one place.

import admin from 'firebase-admin'
import {
  issueLoan, completeRepaymentQuest, resolveLoan,
  defaultLoan, checkOverdueStatus, checkPartialGrace,
  applyPartialGrace, getLoanProgress,
} from './loanEngine.js'

const { Timestamp, FieldValue } = admin.firestore

// ─── CREATE LOAN ─────────────────────────────────────────────────────────────

export async function createLoan(db, userId, tierId) {
  // Fetch user + check for existing active loan
  const [userSnap, activeLoansSnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('loans')
      .where('user_id', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .get(),
  ])

  if (!userSnap.exists) throw Object.assign(new Error('User not found'), { status: 404 })

  const user         = userSnap.data()
  const hasActive    = !activeLoansSnap.empty
  const result       = issueLoan(userId, tierId, user.level ?? 1, hasActive)

  if (!result.ok) throw Object.assign(new Error(result.error), { status: 400 })

  const loanRef      = db.collection('loans').doc()
  const now          = Timestamp.now()

  // Write loan + credit the user's balance in a transaction
  await db.runTransaction(async tx => {
    // Persist loan
    tx.set(loanRef, {
      id:                    loanRef.id,
      ...result.loan,
      created_at:            now,
      updated_at:            now,
    })

    // Credit user balance
    tx.update(db.collection('credits').doc(userId), {
      balance:          FieldValue.increment(result.loan.credits_borrowed),
      updated_at:       now,
    })

    // Credit transaction record
    tx.set(db.collection('credit_transactions').doc(), {
      user_id:     userId,
      type:        'loan_issued',
      amount:      result.loan.credits_borrowed,
      source:      'loan',
      reference_id: loanRef.id,
      note:        `${result.loan.tier_label} — task repayment`,
      created_at:  now,
    })
  })

  return { loanId: loanRef.id, loan: result.loan }
}

// ─── COMPLETE A REPAYMENT QUEST ───────────────────────────────────────────────

export async function markRepaymentQuestDone(db, userId, loanId, questId) {
  const loanRef  = db.collection('loans').doc(loanId)
  const loanSnap = await loanRef.get()

  if (!loanSnap.exists) throw Object.assign(new Error('Loan not found'), { status: 404 })

  const loan = loanSnap.data()
  if (loan.user_id !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 })

  const result = completeRepaymentQuest(loan, questId)
  if (!result.ok) throw Object.assign(new Error(result.error), { status: 400 })

  const now = Timestamp.now()

  // If all required quests done — run resolve in the same transaction
  if (result.should_resolve) {
    const resolveResult = resolveLoan(result.loan)
    if (!resolveResult.ok) throw new Error(resolveResult.error)

    await db.runTransaction(async tx => {
      // Update loan to cleared
      tx.update(loanRef, {
        quests:          resolveResult.loan.quests,
        completed_count: result.loan.completed_count + 1,
        status:          'cleared',
        cleared_at:      now,
        updated_at:      now,
      })

      // Stat reward — discipline bonus for clearing
      tx.update(db.collection('stats').doc(userId), {
        discipline: FieldValue.increment(resolveResult.rewards.discipline_bonus),
        updated_at: now,
      })

      // XP reward from optional quests
      if (resolveResult.rewards.optional_xp > 0) {
        tx.update(db.collection('users').doc(userId), {
          xp:         FieldValue.increment(resolveResult.rewards.optional_xp),
          updated_at: now,
        })
      }

      // XP from this quest
      tx.update(db.collection('users').doc(userId), {
        xp:         FieldValue.increment(result.xp_earned),
        updated_at: now,
      })
    })

    return {
      quest_completed: result.quest_completed,
      xp_earned:       result.xp_earned + (resolveResult.rewards.optional_xp ?? 0),
      loan_cleared:    true,
      rewards:         resolveResult.rewards,
    }
  }

  // Normal quest completion (more quests remaining)
  await db.runTransaction(async tx => {
    tx.update(loanRef, {
      quests:          result.loan.quests,
      completed_count: result.loan.completed_count,
      updated_at:      now,
    })
    tx.update(db.collection('users').doc(userId), {
      xp:         FieldValue.increment(result.xp_earned),
      updated_at: now,
    })
  })

  return {
    quest_completed:    result.quest_completed,
    xp_earned:          result.xp_earned,
    loan_cleared:       false,
    required_remaining: result.required_remaining,
  }
}

// ─── GET ACTIVE LOAN ─────────────────────────────────────────────────────────

export async function getActiveLoan(db, userId) {
  const snap = await db.collection('loans')
    .where('user_id', '==', userId)
    .where('status',  '==', 'active')
    .orderBy('created_at', 'desc')
    .limit(1)
    .get()

  if (snap.empty) return null

  const loan     = snap.docs[0].data()
  const progress = getLoanProgress(loan)
  const overdue  = checkOverdueStatus(loan)

  return { ...progress, overdue }
}

// ─── APPLY DEFAULT (called by daily scheduler) ────────────────────────────────

export async function applyLoanDefault(db, loanId) {
  const loanRef  = db.collection('loans').doc(loanId)
  const loanSnap = await loanRef.get()
  if (!loanSnap.exists) return

  const loan     = loanSnap.data()
  const result   = defaultLoan(loan)
  if (!result.ok) return

  const userId = loan.user_id
  const now    = Timestamp.now()

  await db.runTransaction(async tx => {
    // Mark loan defaulted
    tx.update(loanRef, {
      status:                  'defaulted',
      overdue_penalty_applied: true,
      shop_locked_until:       result.loan.shop_locked_until,
      updated_at:              now,
    })

    // Apply stat penalty
    tx.update(db.collection('stats').doc(userId), {
      [result.penalties.stat]: FieldValue.increment(-result.penalties.stat_loss),
      updated_at:              now,
    })

    // Mark user as "in debt" on leaderboard
    tx.update(db.collection('leaderboard').doc(`${userId}_weekly`), {
      in_debt:    true,
      updated_at: now,
    })
  })

  return result
}

// ─── SETTLE PARTIAL ──────────────────────────────────────────────────────────

export async function settlePartialLoan(db, userId, loanId) {
  const [loanSnap, creditsSnap] = await Promise.all([
    db.collection('loans').doc(loanId).get(),
    db.collection('credits').doc(userId).get(),
  ])

  if (!loanSnap.exists)    throw Object.assign(new Error('Loan not found'),   { status: 404 })
  if (!creditsSnap.exists) throw Object.assign(new Error('Credits not found'), { status: 404 })

  const loan    = loanSnap.data()
  const credits = creditsSnap.data()

  if (loan.user_id !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 })

  const grace = checkPartialGrace(loan, credits.balance)
  if (!grace.eligible)  throw Object.assign(new Error(grace.message), { status: 400 })
  if (!grace.can_afford) throw Object.assign(new Error(grace.message), { status: 400 })

  const settlement = applyPartialGrace(loan)
  const now        = Timestamp.now()

  await db.runTransaction(async tx => {
    tx.update(db.collection('loans').doc(loanId), {
      status:     'partial',
      updated_at: now,
    })
    tx.update(db.collection('credits').doc(userId), {
      balance:        FieldValue.increment(-grace.credit_penalty),
      lifetime_spent: FieldValue.increment(grace.credit_penalty),
      updated_at:     now,
    })
    tx.update(db.collection('stats').doc(userId), {
      [settlement.settlement.stat]: FieldValue.increment(-settlement.settlement.stat_loss),
      updated_at:                   now,
    })
    tx.set(db.collection('credit_transactions').doc(), {
      user_id:     userId,
      type:        'loan_settlement',
      amount:      -grace.credit_penalty,
      source:      'partial_settlement',
      reference_id: loanId,
      note:        'Partial loan settlement',
      created_at:  now,
    })
  })

  return settlement
}

// ─── DAILY OVERDUE CHECK (scheduler) ─────────────────────────────────────────

export async function runLoanOverdueCheck(db) {
  const snap = await db.collection('loans')
    .where('status', '==', 'active')
    .get()

  let defaulted = 0
  const batch   = db.batch()

  for (const doc of snap.docs) {
    const loan   = doc.data()
    const status = checkOverdueStatus(loan)

    if (!status.overdue) continue

    // Auto-default if overdue ≥ 3 days with no completion progress
    if (status.days >= 3 && loan.completed_count === 0) {
      await applyLoanDefault(db, doc.id)
      defaulted++
    } else if (status.overdue) {
      // Just update days_overdue counter
      batch.update(doc.ref, {
        days_overdue: status.days,
        updated_at:   Timestamp.now(),
      })
    }
  }

  await batch.commit()
  return { checked: snap.size, defaulted }
}
