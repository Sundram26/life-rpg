import { Router }                 from 'express'
import { body, validationResult } from 'express-validator'
import { evaluateTask, evaluateBatch } from './evaluator.js'

const router = Router()

// ── Shared response helpers ────────────────────────────────────────────────────
const ok  = (res, data) => res.json({ success: true,  ...data })
const err = (res, msg, status = 400) => res.status(status).json({ success: false, error: msg })

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

// ─────────────────────────────────────────────────────────────────────────────
// POST /evaluate
// Evaluate a single task description + time
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/evaluate',
  [
    body('description')
      .trim()
      .isLength({ min: 3, max: 300 })
      .withMessage('description must be 3–300 characters'),
    body('minutesSpent')
      .isInt({ min: 1, max: 1440 })
      .withMessage('minutesSpent must be 1–1440'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return err(res, errors.array()[0].msg)

    const { description, minutesSpent } = req.body
    const result = await evaluateTask(description, minutesSpent)
    return ok(res, { result })
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// POST /evaluate/batch
// Evaluate up to 20 tasks at once
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/evaluate/batch',
  [
    body('tasks')
      .isArray({ min: 1, max: 20 })
      .withMessage('tasks must be an array of 1–20 items'),
    body('tasks.*.description')
      .trim()
      .isLength({ min: 3, max: 300 })
      .withMessage('Each task description must be 3–300 characters'),
    body('tasks.*.minutesSpent')
      .isInt({ min: 1, max: 1440 })
      .withMessage('Each minutesSpent must be 1–1440'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return err(res, errors.array()[0].msg)

    const data = await evaluateBatch(req.body.tasks)
    return ok(res, data)
  }),
)

export default router
