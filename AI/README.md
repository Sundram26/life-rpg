# Life RPG — AI Task Evaluator

Standalone microservice that evaluates whether a task description is productive or unproductive, assigns a stat category, and calculates XP + credit rewards.

## How it works

```
User input
    │
    ▼
┌─────────────────────────────┐
│   1. Input sanitisation     │  validates description + minutesSpent
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│   2. Rule engine            │  instant, free, keyword-based
│   ~50 patterns across 4     │  returns high/medium confidence or null
│   stats + unproductive list │
└─────────────┬───────────────┘
              │
    high conf?├──YES──► return rule result (no API call)
              │
              NO
              ▼
┌─────────────────────────────┐
│   3. Gemini AI              │  ~300ms, costs API quota
│   gemini-2.0-flash          │  structured JSON prompt
│   temperature 0.2           │  returns category/stat/xp/credits/tip
└─────────────┬───────────────┘
              │
    AI fails? ├──YES──► fallback (neutral, small reward)
              │
              NO
              ▼
┌─────────────────────────────┐
│   4. Time multiplier        │  scales rewards by minutes spent
│   15min=0.7× → 180min=2.0×  │  capped at 2×
└─────────────┬───────────────┘
              │
              ▼
        EvaluationResult
```

## Project structure

```
life-rpg-ai/
├── src/
│   ├── index.js         # Express server (port 3001)
│   ├── routes.js        # POST /evaluate + POST /evaluate/batch
│   ├── evaluator.js     # Orchestrator: rules → AI → fallback + cache
│   ├── ruleEngine.js    # Keyword pattern matching + time helpers
│   ├── aiEvaluator.js   # Gemini API call + response parser
│   └── test.js          # 56-test suite (runs without API key)
├── package.json
└── .env.example
```

## Setup

```bash
npm install

cp .env.example .env
# Add your Gemini API key (free at aistudio.google.com)

npm run dev     # development with auto-reload
npm start       # production
npm test        # run test suite (no API key needed)
```

## API

### POST /evaluate

Evaluate a single task.

**Request**
```json
{
  "description": "Studied calculus for 1 hour",
  "minutesSpent": 60
}
```

**Response — productive**
```json
{
  "success": true,
  "result": {
    "input": {
      "description": "Studied calculus for 1 hour",
      "minutes_spent": 60
    },
    "evaluation": {
      "source": "rules",
      "category": "productive",
      "confidence": "high"
    },
    "stat": {
      "primary": "intelligence",
      "secondary": null,
      "gain": 4
    },
    "rewards": {
      "xp": 91,
      "credits": 78,
      "difficulty": "hard",
      "is_reward": true
    },
    "feedback": {
      "reasoning": "Matched 3 intelligence pattern(s) in description.",
      "tip": null
    },
    "meta": {
      "model": null,
      "evaluated_at": "2026-03-15T10:30:00.000Z"
    }
  }
}
```

**Response — unproductive**
```json
{
  "success": true,
  "result": {
    "evaluation": {
      "source": "rules",
      "category": "unproductive",
      "confidence": "high"
    },
    "stat": { "primary": null, "secondary": null, "gain": 0 },
    "rewards": {
      "xp": 0,
      "credits": -47,
      "difficulty": "hard",
      "is_reward": false
    },
    "feedback": {
      "reasoning": "Matched unproductive keyword patterns in description.",
      "tip": null
    }
  }
}
```

---

### POST /evaluate/batch

Evaluate up to 20 tasks at once.

**Request**
```json
{
  "tasks": [
    { "description": "Morning workout", "minutesSpent": 45 },
    { "description": "Read a book chapter", "minutesSpent": 30 },
    { "description": "Scrolled Instagram", "minutesSpent": 60 }
  ]
}
```

**Response**
```json
{
  "success": true,
  "results": [
    { "index": 0, "success": true, "result": { ... } },
    { "index": 1, "success": true, "result": { ... } },
    { "index": 2, "success": true, "result": { ... } }
  ],
  "summary": {
    "total_tasks": 3,
    "successful": 3,
    "total_xp": 142,
    "total_credits": 45,
    "productive_count": 2,
    "unproductive_count": 1
  }
}
```

---

## Rule engine patterns

| Stat           | Example triggers                                    |
|----------------|-----------------------------------------------------|
| Intelligence   | study, read, course, coding, research, tutorial     |
| Strength       | workout, run, gym, yoga, cycling, swim, walk        |
| Discipline     | journal, plan, no-phone, meditate, morning routine  |
| Social         | call, network, meeting, present, mentor, volunteer  |
| Unproductive   | scroll, Netflix, TikTok, procrastinate, mindless    |

## Time multipliers

| Duration   | Multiplier | Difficulty |
|------------|------------|------------|
| ≤ 15 min   | 0.7×       | Easy       |
| 16–30 min  | 1.0×       | Easy/Med   |
| 31–60 min  | 1.3×       | Medium     |
| 61–90 min  | 1.5×       | Hard       |
| 91–120 min | 1.7×       | Hard/Epic  |
| 121–179min | 1.9×       | Epic       |
| 180+ min   | 2.0×       | Epic       |

## Integration with Life RPG backend

In `life-rpg-api/src/routes/addTask.js`, call this service when `source === 'custom'`:

```js
// In addTask route, before the Firestore transaction:
if (source === 'custom') {
  const evalRes = await fetch(`${process.env.AI_EVALUATOR_URL}/evaluate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: name, minutesSpent }),
  })
  const { result } = await evalRes.json()

  // Override caller-supplied values with AI-evaluated ones
  baseXp      = result.rewards.xp
  baseCredits = result.rewards.credits
  statAffected = result.stat.primary ?? statAffected
  aiNotes      = result.feedback.reasoning
  aiEvaluated  = true
}
```

Add to `.env`:
```
AI_EVALUATOR_URL=http://localhost:3001
```
