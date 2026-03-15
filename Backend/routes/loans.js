import { Router }                  from 'express';
import { body, validationResult }  from 'express-validator';
import admin                       from 'firebase-admin';
import { getDb, COLLECTIONS }      from '../config/firebase.js';
import { LOAN }                    from '../config/gameConstants.js';
import {
  ok, err,
  calcLoanBalance, buildCreditTxPayload,
} from '../utils/helpers.js';
import { authenticate }            from '../middleware/auth.js';
import { asyncHandler }            from '../middleware/errorHandler.js';

const router = Router();
const { FieldValue, Timestamp } = admin.firestore;

// ═══════════════════════════════════════════════════════════════════════════
// POST /takeLoan
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Issues a credit loan to the authenticated user.
 *
 * Rules:
 *  - User must be level 15+
 *  - No existing active or defaulted loan
 *  - Amount: 50–500 credits
 *  - 0% interest for 3 days, then 10%/day compounding
 *  - On default (balance reaches 3× principal): stat penalty + leaderboard badge
 *
 * Body: { amount, rewardDescription? }
 */

const takeLoanValidation = [
  body('amount')
    .isInt({ min: LOAN.MIN_AMOUNT, max: LOAN.MAX_AMOUNT })
    .withMessage(`Loan amount must be between ${LOAN.MIN_AMOUNT} and ${LOAN.MAX_AMOUNT} credits`),
  body('rewardDescription')
    .optional()
    .isString()
    .isLength({ max: 200 }),
];

router.post(
  '/takeLoan',
  authenticate,
  takeLoanValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return err(res, 'Validation failed', 400, errors.array());

    const uid    = req.user.uid;
    const db     = getDb();
    const { amount, rewardDescription = null } = req.body;

    const result = await db.runTransaction(async (tx) => {
      const [userSnap, creditsSnap] = await Promise.all([
        tx.get(db.collection(COLLECTIONS.USERS).doc(uid)),
        tx.get(db.collection(COLLECTIONS.CREDITS).doc(uid)),
      ]);

      if (!userSnap.exists)    throw Object.assign(new Error('User not found'), { status: 404 });
      if (!creditsSnap.exists) throw Object.assign(new Error('Credits not found'), { status: 404 });

      const user = userSnap.data();

      // Level gate
      if (user.level < LOAN.MIN_LEVEL) {
        throw Object.assign(
          new Error(`Loans unlock at level ${LOAN.MIN_LEVEL}. You are level ${user.level}.`),
          { status: 403 },
        );
      }

      // No duplicate active/defaulted loans
      const existingLoan = await tx.get(
        db.collection(COLLECTIONS.LOANS)
          .where('user_id', '==', uid)
          .where('status', 'in', ['active', 'defaulted'])
          .limit(1),
      );
      if (!existingLoan.empty) {
        throw Object.assign(
          new Error('You already have an open loan. Repay it before taking another.'),
          { status: 409 },
        );
      }

      const now     = Timestamp.now();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + LOAN.GRACE_DAYS);

      const loanRef = db.collection(COLLECTIONS.LOANS).doc();
      const txRef   = db.collection(COLLECTIONS.CREDIT_TRANSACTIONS).doc();

      // Create loan
      tx.set(loanRef, {
        id:               loanRef.id,
        user_id:          uid,
        principal:        amount,
        current_balance:  amount,
        interest_rate:    LOAN.DAILY_INTEREST,
        status:           'active',
        due_date:         Timestamp.fromDate(dueDate),
        days_overdue:     0,
        repaid_amount:    0,
        penalty_applied:  0,
        reward_description: rewardDescription,
        issued_at:        now,
        repaid_at:        null,
      });

      // Credit the user's balance immediately
      tx.update(db.collection(COLLECTIONS.CREDITS).doc(uid), {
        balance:          FieldValue.increment(amount),
        updated_at:       now,
      });

      // Ledger entry
      tx.set(txRef, buildCreditTxPayload({
        userId:      uid,
        type:        'loan_issued',
        amount:      amount,
        source:      'loan',
        referenceId: loanRef.id,
        note:        rewardDescription ?? `Loan of ${amount} credits`,
      }));

      return { loanId: loanRef.id, amount, dueDate };
    });

    return ok(res, {
      message:      `Loan granted. Repay ${result.amount} credits within ${LOAN.GRACE_DAYS} days to avoid interest.`,
      loan: {
        id:           result.loanId,
        principal:    result.amount,
        due_date:     result.dueDate,
        interest_rate: `${LOAN.DAILY_INTEREST * 100}%/day after grace period`,
        repay_fraction: `${LOAN.REPAY_FRACTION * 100}% of task earnings auto-deducted`,
      },
    }, 201);
  }),
);

// ═══════════════════════════════════════════════════════════════════════════
// POST /repayLoan
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Manual loan repayment (in addition to auto-deduction via task earnings).
 *
 * Body: { loanId, amount }  — amount cannot exceed current loan balance.
 */

const repayLoanValidation = [
  body('loanId')
    .isString()
    .notEmpty()
    .withMessage('loanId is required'),
  body('amount')
    .isInt({ min: 1 })
    .withMessage('Amount must be a positive integer'),
];

router.post(
  '/repayLoan',
  authenticate,
  repayLoanValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return err(res, 'Validation failed', 400, errors.array());

    const uid             = req.user.uid;
    const db              = getDb();
    const { loanId, amount } = req.body;

    const result = await db.runTransaction(async (tx) => {
      const [loanSnap, creditsSnap] = await Promise.all([
        tx.get(db.collection(COLLECTIONS.LOANS).doc(loanId)),
        tx.get(db.collection(COLLECTIONS.CREDITS).doc(uid)),
      ]);

      if (!loanSnap.exists)    throw Object.assign(new Error('Loan not found'), { status: 404 });
      if (!creditsSnap.exists) throw Object.assign(new Error('Credits not found'), { status: 404 });

      const loan    = loanSnap.data();
      const credits = creditsSnap.data();

      // Ownership check
      if (loan.user_id !== uid) {
        throw Object.assign(new Error('Forbidden — this loan belongs to another user'), { status: 403 });
      }

      // Status check
      if (loan.status === 'repaid') {
        throw Object.assign(new Error('This loan has already been repaid'), { status: 409 });
      }
      if (loan.status === 'defaulted') {
        throw Object.assign(new Error('This loan has defaulted. Contact support.'), { status: 409 });
      }

      // Apply current interest to get real balance
      const actualBalance = calcLoanBalance(loan.principal, loan.issued_at);
      const repayAmount   = Math.min(amount, actualBalance, credits.balance);

      if (repayAmount <= 0) {
        throw Object.assign(new Error('Insufficient credits to repay'), { status: 400 });
      }

      const newBalance = actualBalance - repayAmount;
      const isFullyRepaid = newBalance <= 0;
      const now = Timestamp.now();
      const txRef = db.collection(COLLECTIONS.CREDIT_TRANSACTIONS).doc();

      // Update loan
      tx.update(loanSnap.ref, {
        current_balance: Math.max(0, newBalance),
        repaid_amount:   FieldValue.increment(repayAmount),
        status:          isFullyRepaid ? 'repaid' : 'active',
        ...(isFullyRepaid && { repaid_at: now }),
      });

      // Deduct from credits
      tx.update(db.collection(COLLECTIONS.CREDITS).doc(uid), {
        balance:          FieldValue.increment(-repayAmount),
        lifetime_spent:   FieldValue.increment(repayAmount),
        updated_at:       now,
      });

      // Ledger entry
      tx.set(txRef, buildCreditTxPayload({
        userId:      uid,
        type:        'loan_repayment',
        amount:      -repayAmount,
        source:      'manual_repayment',
        referenceId: loanId,
        note:        `Manual repayment — ${isFullyRepaid ? 'LOAN CLEARED' : `${newBalance} remaining`}`,
      }));

      return { repayAmount, newBalance: Math.max(0, newBalance), isFullyRepaid };
    });

    return ok(res, {
      message:       result.isFullyRepaid
        ? '🎉 Loan fully repaid! Your debt is clear.'
        : `Repaid ${result.repayAmount} credits. ${result.newBalance} remaining.`,
      repaid:        result.repayAmount,
      remaining:     result.newBalance,
      loan_cleared:  result.isFullyRepaid,
    });
  }),
);

export default router;
