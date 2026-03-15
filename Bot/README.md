# Life RPG — Bot Leaderboard System

Generates a living, city-named bot leaderboard with a permanent Final Boss and a narrative challenge system when the player reaches Rank 2.

---

## Architecture

```
botData.js          City names, tier config, bracket composition, Final Boss definition
botFactory.js       Generates bots from a seed, builds ranked leaderboard, triggers challenge
finalChallenge.js   5-stage narrative boss battle, progress tracking, rewards
scheduler.js        Daily tick (scores) + weekly reset (Firestore batch writes)
routes.js           Express routes: GET /leaderboard/bots, GET /leaderboard/challenge
test.js             57-test suite (no Firebase needed)
```

---

## File structure

```
life-rpg-bots/
├── src/
│   ├── botData.js           City names, tier data, FINAL_BOSS constant
│   ├── botFactory.js        Bot generation, leaderboard building, challenge check
│   ├── finalChallenge.js    5-stage challenge: Awakening → Pursuit → Pressure → Edge → Victory
│   ├── scheduler.js         Daily/weekly Firestore batch updates
│   ├── routes.js            Express API routes
│   └── test.js              57 automated tests
└── package.json
```

---

## How bots work

### City-based names
Every bot name is `<City> <Role>`, e.g. **Tokyo Scholar**, **Berlin Runner**, **Oslo Monk**. Cities are drawn from a pool of 30 real world cities organised by tier.

### Deterministic generation
Bots are generated from a weekly seed — same week, same bots. The seed rolls over every Monday, slowly evolving the leaderboard. Two players on the same bracket see identical bots.

### Tiers
| Tier     | Daily gain    | Skip chance | Level range |
|----------|---------------|-------------|-------------|
| Casual   | 60–180 pts    | 30%         | 2–6         |
| Regular  | 200–500 pts   | 12%         | 5–12        |
| Elite    | 500–900 pts   | 4%          | 10–20       |

### Brackets
Players are placed in a bracket based on their level. Higher levels face harder bot compositions:

| Bracket  | Player level | Casual | Regular | Elite |
|----------|-------------|--------|---------|-------|
| Newcomer | 1–4         | 6      | 2       | 0     |
| Rising   | 5–9         | 3      | 5       | 1     |
| Veteran  | 10–14       | 1      | 4       | 4     |
| Legend   | 15+         | 0      | 2       | 7     |

### The Final Boss — APEX // Olympus
- **Always Rank 1.** Score is dynamically set to 15% above whoever is second place.
- **Level 99.** Streak of 365 days. Daily gain: 800–1,200 points.
- **Cannot be caught by normal play** — only the Final Challenge allows victory.
- Has lore text explaining their undefeated history.

---

## Final Challenge

### Trigger
When a real player reaches **Rank 2** with **APEX at Rank 1**, the Final Challenge activates.

### 5 Stages (by % of score gap closed)

| Stage       | % closed | Bonus reward          | Boss message |
|-------------|----------|-----------------------|--------------|
| Awakening   | 0%       | +200 XP / +100 cr     | "You've come further than most…" |
| Pursuit     | 25%      | +500 XP / +250 cr     | "Consistency is where challengers break…" |
| Pressure    | 50%      | +1,000 XP / +500 cr   | "You've earned my full attention…" *(boss rage: +25% daily gain)* |
| Edge        | 80%      | +1,500 XP / +750 cr   | "The throne demands everything…" |
| Victory     | 100%     | +5,000 XP / +2,000 cr | "The throne is yours. For now." |

### Victory reward
- **+5,000 XP** and **+2,000 credits**
- Title: **"Olympus Slayer"**
- Badge: **👑**
- Challenge resets after 7 days — APEX returns with a higher baseline

### Time limit
**7 days** to close the gap. If expired, the challenge resets. The player must reach Rank 2 again to re-trigger it.

---

## API

### GET /leaderboard/bots
Returns the full ranked leaderboard merged with the real player.

**Headers:** `Authorization: Bearer <token>`

```json
{
  "success": true,
  "bracket": "rising",
  "total": 11,
  "entries": [
    {
      "rank": 1,
      "username": "APEX // Olympus",
      "avatar": "👑",
      "class": "monk",
      "level": 99,
      "score": 9840,
      "streak_days": 365,
      "is_bot": true,
      "is_boss": true
    },
    {
      "rank": 2,
      "username": "ShadowMonk",
      "is_bot": false,
      "is_you": true,
      "score": 8560
    }
  ],
  "your_rank": 2,
  "boss_rank": 1,
  "final_challenge": {
    "triggered": true,
    "scoreGap": 1280,
    "tasksToWin": 5,
    "message": "⚔️ You've reached Rank 2. APEX // Olympus awaits...",
    "timeLimit": "7 days"
  }
}
```

### GET /leaderboard/challenge
Returns the current challenge state for the authenticated player.

```json
{
  "success": true,
  "active": true,
  "challenge": {
    "status": "active",
    "pct_closed": 47,
    "score_gap": 680,
    "tasks_remaining": 3,
    "current_stage": {
      "id": "pursuit",
      "title": "The Gap Narrows",
      "narrative": "...",
      "boss_message": "..."
    }
  }
}
```

---

## Integration with life-rpg-api

In `src/index.js`:

```js
import { createBotRoutes } from '../life-rpg-bots/src/routes.js'
import { authenticate }    from './middleware/auth.js'
import { getDb }           from './config/firebase.js'

// Mount bot leaderboard routes
app.use('/leaderboard', createBotRoutes(getDb(), authenticate))
```

Add daily scheduler (e.g. via Cloud Scheduler or a cron job):
```js
import { runDailyBotTick, runWeeklyReset } from '../life-rpg-bots/src/scheduler.js'

// Daily at 00:00 UTC
app.post('/internal/cron/daily',  (req, res) => runDailyBotTick(getDb()).then(r => res.json(r)))
// Weekly on Monday at 00:00 UTC  
app.post('/internal/cron/weekly', (req, res) => runWeeklyReset(getDb()).then(() => res.json({ ok: true })))
```

---

## Running tests

```bash
node src/test.js
# 57 tests, no Firebase or API key needed
```
