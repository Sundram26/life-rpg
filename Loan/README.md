# Life RPG — Task-Based Loan Repayment System

Credits borrowed must be repaid through real-life tasks — not money.
Miss your quests and your discipline stat takes the hit.

---

## How it works

```
Player takes loan (e.g. 150 credits)
        │
        ▼
System assigns repayment quest bundle:
  ✅ Study for 1 hour          (required)
  ✅ Workout 45 min            (required)
  ✅ Journal                   (required)
  ⚪ No phone for 2 hours      (optional bonus)
        │
    3-5 days to complete
        │
   ┌────┴─────────────────────┐
   │ All required done?       │
   └──┬──────────────────┬────┘
     YES                 NO
      │                  │
   Loan cleared      Overdue?
   +Discipline bonus    │
   +Optional XP      ┌──┴──────────────────┐
                      │ 75%+ done?          │
                      └──┬──────────────────┘
                        YES                 NO
                         │                  │
                    Partial grace        Default
                    (pay 25% credits     (-Discipline)
                     + reduced penalty)   (shop lock)
```

---

## Loan tiers

| Tier   | Credits | Deadline | Quests | Min Level | Default Penalty  |
|--------|---------|----------|--------|-----------|------------------|
| Small  | 50      | 3 days   | 2      | 1         | -3 Discipline    |
| Medium | 150     | 5 days   | 3+1    | 5         | -6 Discipline    |
| Large  | 400     | 7 days   | 5+1    | 10        | -10 Discipline   |
| Epic   | 1,000   | 14 days  | 8+1    | 15        | -20 Discipline   |

*+1 = one optional bonus quest*

---

## Repayment quest bundles

### Small (50 cr) — 3 days
- 📖 Study for 30 minutes *(required)*
- 💪 Workout for 20 minutes *(required)*

### Medium (150 cr) — 5 days
- 📚 Study for 1 hour *(required)*
- 🏋️ Workout for 45 minutes *(required)*
- 📓 Write in your journal *(required)*
- 📵 No phone for 2 hours *(optional)*

### Large (400 cr) — 7 days
- 📚 Study for 1 hour *(required)*
- 💻 Complete an online lesson *(required)*
- 🏃 Go for a 5km run *(required)*
- 📵 No phone for 2 hours *(required)*
- 📅 Plan tomorrow in full *(required)*
- 📞 Call a friend or family *(optional)*

### Epic (1,000 cr) — 14 days
- 📚 Study for 1 hour + 💻 Online lesson
- 🏋️ Workout 45min + 🏃 5km run
- 📵 No phone 2hr + 🌅 Wake before 7 AM
- 🧘 Meditate 15min + 📓 Journal
- 🎭 Attend a social event *(optional)*

Every bundle covers **2+ stat categories** — you can't just grind one skill.

---

## Penalties

### On-time clearance
- Full discipline bonus: +2 / +4 / +8 / +15 per tier
- Optional quest XP on top
- "Debt Slayer" badge

### Overdue (deadline missed)
- -1 extra Discipline per day overdue (capped at -10)
- Shop access locked: 1 day per overdue day (max 7)
- "In Debt" badge on leaderboard

### Default (3+ days overdue with no progress)
- Full tier penalty + all accumulated overdue penalties
- Leaderboard badge until cleared

### Partial grace (≥75% complete, missed deadline)
- Pay 25% of loan in credits
- Only 50% of normal stat penalty
- No shop lock

---

## Discipline bonus (clearance reward)

| Tier   | Discipline Bonus |
|--------|-----------------|
| Small  | +2              |
| Medium | +4              |
| Large  | +8              |
| Epic   | +15             |

---

## API

### GET /loans/tiers
Returns all loan tiers with quest descriptions.

### POST /loans/take
```json
{ "tierId": "small" }
```
Returns the loan document with all repayment quests assigned.

### GET /loans/active
Returns the current active loan with quest progress.

### POST /loans/quest/complete
```json
{ "loanId": "abc123", "questId": "small_0" }
```
Marks a repayment quest done. If last required quest — loan auto-clears.

### POST /loans/settle/partial
```json
{ "loanId": "abc123" }
```
Pays the partial grace penalty (credits + reduced stat loss).

### GET /loans/partial-grace/:loanId
Checks partial grace eligibility without applying it.

---

## File structure

```
life-rpg-loans/
├── src/
│   ├── loanConstants.js   Tier config, quest templates, repayment bundles
│   ├── loanEngine.js      Pure functions: issue, complete, resolve, default, grace
│   ├── loanStore.js       Firestore read/write layer
│   ├── routes.js          Express routes
│   └── test.js            115-test suite (no Firebase needed)
└── package.json
```

## Running tests

```bash
node src/test.js
# 115 tests, no Firebase or API key needed
```

## Integration

```js
import { createLoanRoutes } from './life-rpg-loans/src/routes.js'
app.use('/loans', createLoanRoutes(getDb(), authenticate))
```

Daily scheduler (check overdue loans):
```js
import { runLoanOverdueCheck } from './life-rpg-loans/src/loanStore.js'
// Call once per day
await runLoanOverdueCheck(db)
```
