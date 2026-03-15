// ─── LOAN ROUTES ─────────────────────────────────────────────────────────────

import { Router }                from 'express'
import { body, validationResult } from 'express-validator'
import { LOAN_TIERS }            from './loanConstants.js'
import { getLoanProgress, checkPartialGrace, checkOverdueStatus } from './loanEngine.js'
import {
  createLoan, markRepaymentQuestDone, getActiveLoan,
  settlePartialLoan, runLoanOverdueCheck,
} from './loanStore.js'

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

const ok  = (res, data, status = 200) => res.status(status).json({ success: true, ...data })
const err = (res, msg,  status = 400) => res.status(status).json({ success: false, error: msg })

export function createLoanRoutes(db, authenticate) {
  const router = Router()

  // ── GET /loans/tiers ──────────────────────────────────────────────────────
  // Returns all available loan tiers with their repayment quests

  router.get('/tiers', asyncHandler(async (req, res) => {
    const tiers = Object.values(LOAN_TIERS).map(t => ({
      id:           t.id,
      label:        t.label,
      icon:         t.icon,
      credits:      t.credits,
      deadline:     t.deadline,
      description:  t.description,
      min_level:    t.min_level,
      penalty:      t.penalty,
    }))
    return ok(res, { tiers })
  }))

  // ── POST /loans/take ──────────────────────────────────────────────────────
  // Borrow credits and receive a repayment quest bundle

  router.post(
    '/take',
    authenticate,
    [
      body('tierId')
        .isIn(Object.keys(LOAN_TIERS))
        .withMessage(`tierId must be one of: ${Object.keys(LOAN_TIERS).join(', ')}`),
    ],
    asyncHandler(async (req, res) => {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return err(res, errors.array()[0].msg)

      const uid = req.user.uid
      const { loanId, loan } = await createLoan(db, uid, req.body.tierId)

      const progress = getLoanProgress(loan)

      return ok(res, {
        message:  `${loan.tier_label} issued — ${loan.credits_borrowed} credits added to your balance.`,
        loan_id:  loanId,
        credits_borrowed: loan.credits_borrowed,
        deadline: loan.due_at,
        quests:   progress.quests,
        summary:  `Complete all ${progress.required.total} required quests within ${LOAN_TIERS[req.body.tierId].deadline} days.`,
      }, 201)
    }),
  )

  // ── GET /loans/active ─────────────────────────────────────────────────────
  // Returns the player's current active loan with full progress

  router.get('/active', authenticate, asyncHandler(async (req, res) => {
    const loan = await getActiveLoan(db, req.user.uid)

    if (!loan) {
      return ok(res, {
        active: false,
        message: 'No active loan. Take a loan to get started.',
      })
    }

    return ok(res, { active: true, loan })
  }))

  // ── POST /loans/quest/complete ────────────────────────────────────────────
  // Mark a repayment quest as done

  router.post(
    '/quest/complete',
    authenticate,
    [
      body('loanId').isString().notEmpty().withMessage('loanId is required'),
      body('questId').isString().notEmpty().withMessage('questId is required'),
    ],
    asyncHandler(async (req, res) => {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return err(res, errors.array()[0].msg)

      const result = await markRepaymentQuestDone(
        db, req.user.uid, req.body.loanId, req.body.questId,
      )

      return ok(res, {
        message: result.loan_cleared
          ? result.rewards.message
          : `Quest complete! ${result.required_remaining} required quest(s) remaining.`,
        ...result,
      })
    }),
  )

  // ── POST /loans/settle/partial ────────────────────────────────────────────
  // Settle a partially-completed loan with a credit penalty

  router.post(
    '/settle/partial',
    authenticate,
    [
      body('loanId').isString().notEmpty().withMessage('loanId is required'),
    ],
    asyncHandler(async (req, res) => {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return err(res, errors.array()[0].msg)

      const result = await settlePartialLoan(db, req.user.uid, req.body.loanId)
      return ok(res, { message: result.settlement.message, ...result.settlement })
    }),
  )

  // ── GET /loans/partial-grace ──────────────────────────────────────────────
  // Check whether partial grace is available (non-destructive)

  router.get('/partial-grace/:loanId', authenticate, asyncHandler(async (req, res) => {
    const loanSnap   = await db.collection('loans').doc(req.params.loanId).get()
    const credSnap   = await db.collection('credits').doc(req.user.uid).get()

    if (!loanSnap.exists) return err(res, 'Loan not found', 404)

    const loan   = loanSnap.data()
    const grace  = checkPartialGrace(loan, credSnap.data()?.balance ?? 0)
    const overdue = checkOverdueStatus(loan)

    return ok(res, { grace, overdue })
  }))

  // ── POST /loans/cron/overdue-check ────────────────────────────────────────
  // Called daily by scheduler — checks and defaults overdue loans

  router.post('/cron/overdue-check', asyncHandler(async (req, res) => {
    const result = await runLoanOverdueCheck(db)
    return ok(res, result)
  }))

  return router
}
