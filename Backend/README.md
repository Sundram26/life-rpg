# Life RPG — Backend API

Node.js + Express + Firebase backend for the Life RPG productivity app.

## Project structure

```
life-rpg-api/
├── src/
│   ├── index.js                  # Express app entry point
│   ├── config/
│   │   ├── firebase.js           # Firebase init + collection constants
│   │   └── gameConstants.js      # XP curves, class multipliers, loan rules
│   ├── middleware/
│   │   ├── auth.js               # Firebase ID token verification
│   │   └── errorHandler.js       # Central error handler + asyncHandler
│   ├── routes/
│   │   ├── createUser.js         # POST /createUser
│   │   ├── addTask.js            # POST /addTask
│   │   ├── loans.js              # POST /takeLoan + POST /repayLoan
│   │   ├── leaderboard.js        # GET /leaderboard
│   │   └── profile.js            # GET /profile
│   └── utils/
│       └── helpers.js            # XP/credit calc, stat decay, loan math
├── .env.example
└── package.json
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in your Firebase credentials
cp .env.example .env

# 3. Run in development (auto-restarts on file change)
npm run dev

# 4. Run in production
npm start
```

## Firebase setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Firestore** (Native mode)
3. Enable **Firebase Authentication** (Email/Password + Google)
4. Go to Project Settings → Service Accounts → Generate new private key
5. Copy values into your `.env` file

## API reference

All authenticated endpoints require:
```
Authorization: Bearer <Firebase ID Token>
```

---

### POST /createUser

Creates a new player account.

**Body**
```json
{
  "username": "ShadowMonk",
  "email": "player@example.com",
  "password": "securepass123",
  "playerClass": "scholar",
  "avatarEmoji": "⚔️"
}
```

**Classes:** `scholar` | `warrior` | `monk` | `creator`

**Response 201**
```json
{
  "success": true,
  "message": "Character created! Your adventure begins.",
  "user": {
    "uid": "abc123",
    "username": "ShadowMonk",
    "class": "scholar",
    "level": 1,
    "xp": 0,
    "xp_to_next": 150,
    "streak_days": 0,
    "starting_credits": 100,
    "title": "Wanderer",
    "stats": { "intelligence": 10, "strength": 10, "discipline": 10, "social": 10 }
  }
}
```

---

### POST /addTask

Logs a completed real-life task. Requires auth.

**Body**
```json
{
  "name": "Studied organic chemistry for 2 hours",
  "statAffected": "intelligence",
  "difficulty": "hard",
  "source": "custom"
}
```

**Difficulties:** `easy` | `medium` | `hard` | `epic`  
**Stats:** `intelligence` | `strength` | `discipline` | `social`  
**Source:** `daily` | `custom` | `class`

**Response 200**
```json
{
  "success": true,
  "message": "Quest complete! Keep going.",
  "rewards": {
    "xp": 156,
    "credits": 144,
    "net_credits": 86,
    "loan_repaid": 58,
    "loan_cleared": false
  },
  "progress": {
    "level": 7,
    "levels_gained": 0,
    "title": "Adept",
    "xp": 716,
    "xp_to_next": 1000,
    "intelligence_after": 52
  }
}
```

---

### POST /takeLoan

Takes a credit loan. Requires auth. Requires level 15+.

**Body**
```json
{
  "amount": 150,
  "rewardDescription": "Gaming session tonight"
}
```

**Response 201**
```json
{
  "success": true,
  "message": "Loan granted. Repay 150 credits within 3 days to avoid interest.",
  "loan": {
    "id": "loan_xyz",
    "principal": 150,
    "due_date": "2026-03-18T...",
    "interest_rate": "10%/day after grace period",
    "repay_fraction": "60% of task earnings auto-deducted"
  }
}
```

---

### POST /repayLoan

Manual repayment toward an active loan. Requires auth.

**Body**
```json
{
  "loanId": "loan_xyz",
  "amount": 50
}
```

**Response 200**
```json
{
  "success": true,
  "message": "Repaid 50 credits. 100 remaining.",
  "repaid": 50,
  "remaining": 100,
  "loan_cleared": false
}
```

---

### GET /leaderboard

Public leaderboard. Auth optional (highlights your rank if provided).

**Query params**
| Param   | Default   | Options             |
|---------|-----------|---------------------|
| period  | `weekly`  | `weekly`, `alltime` |
| limit   | `20`      | 1–50                |
| offset  | `0`       | integer             |

**Response 200**
```json
{
  "success": true,
  "period": "weekly",
  "total": 18,
  "entries": [
    {
      "rank": 1,
      "username": "IronNova",
      "avatar_emoji": "🛡️",
      "class": "warrior",
      "level": 12,
      "score": 4280,
      "streak_days": 14,
      "tasks_completed": 42,
      "is_bot": true,
      "is_you": false
    }
  ],
  "your_rank": {
    "rank": 3,
    "score": 3540,
    "username": "ShadowMonk",
    "level": 7,
    "streak_days": 6
  }
}
```

---

### GET /profile

Full profile snapshot. Requires auth.

**Response 200**
```json
{
  "success": true,
  "character": {
    "uid": "abc123",
    "username": "ShadowMonk",
    "class": "scholar",
    "level": 7,
    "xp": 716,
    "xp_to_next_level": 1000,
    "xp_progress_pct": 71,
    "title": "Adept",
    "streak_days": 6,
    "tasks_completed": 34,
    "decay_warning": null
  },
  "stats": {
    "intelligence": 52, "strength": 18,
    "discipline": 33,   "social": 14
  },
  "credits": {
    "balance": 280, "lifetime_earned": 1420,
    "weekly_earned": 340
  },
  "active_loan": null,
  "recent_tasks": [...],
  "leaderboard": { "weekly_score": 3540, "weekly_rank": 3 }
}
```

---

## Error responses

All errors follow this shape:
```json
{
  "success": false,
  "error": "Human-readable message"
}
```

| Status | Meaning                        |
|--------|--------------------------------|
| 400    | Validation failed              |
| 401    | Missing or invalid auth token  |
| 403    | Forbidden (level gate, etc.)   |
| 404    | Resource not found             |
| 409    | Conflict (duplicate, open loan)|
| 429    | Rate limited                   |
| 500    | Internal server error          |
