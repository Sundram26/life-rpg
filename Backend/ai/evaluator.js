// ─── TASK EVALUATOR ORCHESTRATOR ─────────────────────────────────────────────
// Pipeline:
//   1. Input sanitisation
//   2. Rule engine (instant, free)
//   3. If uncertain → Gemini AI (300ms, costs API quota)
//   4. If AI fails  → safe fallback (neutral, small reward)
//
// Returns a fully-formed EvaluationResult in all code paths.

import { runRuleEngine, timeMultiplier, timeToDifficulty } from './ruleEngine.js'
import { evaluateWithAI }                                   from './aiEvaluator.js'

// ── In-memory cache (avoids duplicate AI calls for identical inputs) ──────────
// In production, replace with Redis: ttl = 1 hour
const cache = new Map()

function cacheKey(desc, minutes) {
  return `${desc.toLowerCase().trim()}::${minutes}`
}

// ── Sanitise inputs ───────────────────────────────────────────────────────────

function sanitise(description, minutesSpent) {
  if (!description || typeof description !== 'string') {
    throw Object.assign(new Error('description must be a non-empty string'), { status: 400 })
  }

  const desc = description.trim()
  if (desc.length < 3)   throw Object.assign(new Error('Description too short (min 3 chars)'), { status: 400 })
  if (desc.length > 300) throw Object.assign(new Error('Description too long (max 300 chars)'), { status: 400 })

  const mins = parseInt(minutesSpent, 10)
  if (isNaN(mins) || mins < 1)   throw Object.assign(new Error('minutesSpent must be a positive integer'), { status: 400 })
  if (mins > 1440)               throw Object.assign(new Error('minutesSpent cannot exceed 1440 (24 hours)'), { status: 400 })

  return { desc, mins }
}

// ── Neutral fallback (used when AI is unavailable) ────────────────────────────

function neutralFallback(desc, mins) {
  const difficulty = timeToDifficulty(mins)
  const timeMult   = timeMultiplier(mins)
  return {
    source:       'fallback',
    category:     'neutral',
    stat:         'discipline',  // effort deserves something
    difficulty,
    xp_awarded:   Math.round(10 * timeMult),
    credits:      Math.round(8  * timeMult),
    stat_gain:    1,
    confidence:   'low',
    reasoning:    'Could not fully evaluate this task — awarded a small neutral reward for your effort.',
    tip:          'Try describing your activity in more detail next time for a more accurate score.',
  }
}

// ── Format final result ───────────────────────────────────────────────────────

function formatResult(raw, desc, mins) {
  return {
    // ── Input echo ────────────────────────────────────────────────────
    input: {
      description:   desc,
      minutes_spent: mins,
    },
    // ── Classification ────────────────────────────────────────────────
    evaluation: {
      source:     raw.source,        // 'rules' | 'ai' | 'fallback'
      category:   raw.category,      // 'productive' | 'unproductive' | 'neutral' | 'mixed'
      confidence: raw.confidence,
    },
    // ── Stat assignment ───────────────────────────────────────────────
    stat: {
      primary:    raw.stat           ?? null,
      secondary:  raw.stat_secondary ?? null,
      gain:       raw.stat_gain      ?? 0,
    },
    // ── Rewards / costs ───────────────────────────────────────────────
    rewards: {
      xp:           raw.xp_awarded,
      credits:      raw.credits,     // positive = earn, negative = cost
      difficulty:   raw.difficulty,
      is_reward:    raw.credits >= 0,
    },
    // ── Feedback ──────────────────────────────────────────────────────
    feedback: {
      reasoning: raw.reasoning,
      tip:       raw.tip ?? null,
    },
    // ── Meta ──────────────────────────────────────────────────────────
    meta: {
      model:         raw.model      ?? null,
      evaluated_at:  new Date().toISOString(),
    },
  }
}

// ── Main exported function ────────────────────────────────────────────────────

export async function evaluateTask(description, minutesSpent) {
  const { desc, mins } = sanitise(description, minutesSpent)

  // Cache check
  const key = cacheKey(desc, mins)
  if (cache.has(key)) {
    const cached = cache.get(key)
    cached.meta.from_cache = true
    return cached
  }

  // Step 1: Rule engine
  const ruleResult = runRuleEngine(desc, mins)

  let raw
  if (ruleResult && ruleResult.confidence === 'high') {
    // High-confidence rule match — skip AI entirely
    raw = ruleResult
  } else {
    // Step 2: AI evaluation (rule was null or medium confidence)
    try {
      raw = await evaluateWithAI(desc, mins)

      // If rule engine had a medium-confidence answer, blend it in as a hint
      if (ruleResult && raw.confidence === 'low') {
        raw.stat       = raw.stat ?? ruleResult.stat
        raw.confidence = 'medium'
        raw.reasoning  = `${raw.reasoning} (Rule hint: ${ruleResult.reasoning})`
      }
    } catch (aiError) {
      console.error('[evaluateTask] AI call failed:', aiError.message)

      if (ruleResult) {
        // Degrade to medium-confidence rule result
        raw              = ruleResult
        raw.confidence   = 'medium'
        raw.reasoning   += ' (AI unavailable — using rule-based estimate.)'
      } else {
        // Full fallback
        raw = neutralFallback(desc, mins)
      }
    }
  }

  const result = formatResult(raw, desc, mins)

  // Cache for 60 minutes (simple time-based expiry)
  cache.set(key, result)
  setTimeout(() => cache.delete(key), 60 * 60 * 1000)

  return result
}

// ── Batch evaluator ───────────────────────────────────────────────────────────
// Evaluate multiple tasks at once (e.g. end-of-day log)

export async function evaluateBatch(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw Object.assign(new Error('tasks must be a non-empty array'), { status: 400 })
  }
  if (tasks.length > 20) {
    throw Object.assign(new Error('Maximum 20 tasks per batch'), { status: 400 })
  }

  const results = await Promise.allSettled(
    tasks.map(t => evaluateTask(t.description, t.minutesSpent))
  )

  let totalXp = 0, totalCredits = 0

  const evaluated = results.map((r, i) => {
    if (r.status === 'fulfilled') {
      totalXp      += r.value.rewards.xp
      totalCredits += r.value.rewards.credits
      return { index: i, success: true,  result: r.value }
    }
    return { index: i, success: false, error: r.reason.message }
  })

  return {
    results:        evaluated,
    summary: {
      total_tasks:       tasks.length,
      successful:        evaluated.filter(e => e.success).length,
      total_xp:          totalXp,
      total_credits:     totalCredits,
      productive_count:  evaluated.filter(e => e.success && e.result.evaluation.category === 'productive').length,
      unproductive_count:evaluated.filter(e => e.success && e.result.evaluation.category === 'unproductive').length,
    },
  }
}
