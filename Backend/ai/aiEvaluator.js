// ─── GEMINI AI EVALUATOR ─────────────────────────────────────────────────────
// Called when the rule engine returns null (ambiguous input).
// Uses Gemini Flash (free tier: 1,500 req/day) for nuanced evaluation.

import { timeMultiplier, timeToDifficulty } from './ruleEngine.js'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(description, minutesSpent) {
  return `You are an evaluator for a productivity RPG game called Life RPG.
A user just logged this activity:

Activity: "${description}"
Time spent: ${minutesSpent} minutes

Your job is to evaluate whether this activity is productive or unproductive for real-life growth.

RULES:
- "productive" = genuinely improves the user's life (learning, fitness, relationships, discipline)
- "unproductive" = wastes time with no real benefit (mindless scrolling, excessive gaming, bingeing)
- "neutral" = necessary but not growth-focused (eating, hygiene, commuting)
- "mixed" = has some productive and some unproductive qualities (e.g. casual gaming with friends for social bonding)

STAT CATEGORIES:
- intelligence: studying, reading, coding, learning, research, problem-solving
- strength: exercise, sports, cooking healthy food, physical activity
- discipline: journaling, planning, avoiding distractions, meditation, routines
- social: networking, calling friends/family, group activities, mentoring, presenting

Respond ONLY with valid JSON, no markdown, no explanation outside the JSON:
{
  "category": "productive" | "unproductive" | "neutral" | "mixed",
  "stat": "intelligence" | "strength" | "discipline" | "social" | null,
  "stat_secondary": "intelligence" | "strength" | "discipline" | "social" | null,
  "difficulty": "easy" | "medium" | "hard" | "epic",
  "xp_awarded": <integer 0-200>,
  "credits": <integer, positive if productive reward, negative if unproductive cost>,
  "stat_gain": <integer 0-8>,
  "confidence": "high" | "medium" | "low",
  "reasoning": "<1-2 sentence explanation for the user>",
  "tip": "<1 sentence motivational tip or improvement suggestion>"
}`
}

// ── Response parser + validator ───────────────────────────────────────────────

function parseGeminiResponse(raw) {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed  = JSON.parse(cleaned)

  // Validate required fields
  const VALID_CATEGORIES  = ['productive', 'unproductive', 'neutral', 'mixed']
  const VALID_STATS       = ['intelligence', 'strength', 'discipline', 'social', null]
  const VALID_DIFFS       = ['easy', 'medium', 'hard', 'epic']
  const VALID_CONF        = ['high', 'medium', 'low']

  if (!VALID_CATEGORIES.includes(parsed.category))     throw new Error(`Invalid category: ${parsed.category}`)
  if (!VALID_STATS.includes(parsed.stat))               throw new Error(`Invalid stat: ${parsed.stat}`)
  if (!VALID_DIFFS.includes(parsed.difficulty))         throw new Error(`Invalid difficulty: ${parsed.difficulty}`)
  if (!VALID_CONF.includes(parsed.confidence))          throw new Error(`Invalid confidence: ${parsed.confidence}`)
  if (typeof parsed.xp_awarded !== 'number')            throw new Error('xp_awarded must be a number')
  if (typeof parsed.credits    !== 'number')            throw new Error('credits must be a number')

  // Clamp values to sane ranges
  parsed.xp_awarded = Math.max(0,    Math.min(300, parsed.xp_awarded))
  parsed.credits    = Math.max(-200, Math.min(300, parsed.credits))
  parsed.stat_gain  = Math.max(0,    Math.min(8,   parsed.stat_gain ?? 0))

  // Unproductive things should never give XP
  if (parsed.category === 'unproductive') {
    parsed.xp_awarded = 0
    parsed.stat_gain  = 0
    if (parsed.credits > 0) parsed.credits = -parsed.credits
  }

  return parsed
}

// ── Main AI evaluator ─────────────────────────────────────────────────────────

export async function evaluateWithAI(description, minutesSpent) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment')

  const prompt = buildPrompt(description, minutesSpent)

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     0.2,   // low temperature = consistent, structured output
        maxOutputTokens: 400,
        topP:            0.8,
      },
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errBody}`)
  }

  const data       = await response.json()
  const rawText    = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!rawText) throw new Error('Empty response from Gemini')

  const result     = parseGeminiResponse(rawText)

  // Apply time multiplier on top of AI base values
  const timeMult   = timeMultiplier(minutesSpent)
  result.xp_awarded = Math.round(result.xp_awarded * timeMult)
  result.credits    = result.credits > 0
    ? Math.round(result.credits * timeMult)
    : Math.round(result.credits * timeMult)   // costs also scale with time

  result.source     = 'ai'
  result.model      = 'gemini-2.0-flash'
  return result
}
