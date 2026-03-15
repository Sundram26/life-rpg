# Life RPG — Frontend

React + Vite frontend for the Life RPG productivity app.

## Project structure

```
life-rpg-frontend/
├── index.html
├── vite.config.js
├── package.json
├── .env.example
└── src/
    ├── main.jsx                  # React entry point
    ├── App.jsx                   # Router + providers
    ├── index.css                 # Global styles, tokens, animations
    ├── context/
    │   ├── AuthContext.jsx       # Firebase Auth state + login/logout
    │   └── GameContext.jsx       # Profile, leaderboard, game actions
    ├── services/
    │   ├── firebase.js           # Firebase client init
    │   └── api.js                # All API calls to the backend
    ├── components/
    │   ├── AppShell.jsx          # Layout wrapper (sidebar + outlet)
    │   ├── Sidebar.jsx           # Desktop navigation + character mini-card
    │   ├── ProtectedRoute.jsx    # Redirects unauthenticated users
    │   ├── StatBar.jsx           # Reusable stat progress bar
    │   └── Toast.jsx             # Notification toasts
    └── pages/
        ├── LoginPage.jsx         # Login + Register with class/avatar picker
        ├── DashboardPage.jsx     # Character overview, XP bar, stats, tasks
        ├── TasksPage.jsx         # Quest submission form + quick presets
        ├── LeaderboardPage.jsx   # Ranked table, weekly/alltime toggle
        ├── LoansPage.jsx         # Take loan, repay, reward ideas
        └── AchievementsPage.jsx  # 26 achievements with progress tracking
```

## Setup

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env
# Fill in your Firebase web config values

# 3. Start dev server
npm run dev
# → http://localhost:5173

# 4. Build for production
npm run build
```

## Environment variables

| Variable                    | Description                        |
|-----------------------------|------------------------------------|
| `VITE_API_URL`              | Backend API base URL               |
| `VITE_FIREBASE_API_KEY`     | Firebase Web API key               |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain               |
| `VITE_FIREBASE_PROJECT_ID`  | Firebase project ID                |
| `VITE_FIREBASE_APP_ID`      | Firebase App ID                    |

## Pages

### Login / Register (`/login`)
- Toggle between login and character creation
- Avatar emoji picker (10 options)
- Class selector: Scholar, Warrior, Monk, Creator
- Firebase Auth integration

### Dashboard (`/dashboard`)
- Character header with avatar, class badge, title, streak
- Full-width XP progress bar with level display
- 4 stat cards: Credits, Tasks Done, Weekly Rank, Weekly Earned
- Side-by-side: stat bars + recent quests
- Active loan banner with repayment progress

### Quests (`/tasks`)
- Custom quest form: name, stat selector, difficulty picker
- Difficulty locked above Hard until Level 5
- Result card on submit: XP, credits, level-up notice
- Quick quest presets panel (10 common tasks, click to prefill)

### Leaderboard (`/leaderboard`)
- Weekly / All-time toggle
- Your rank banner (if authenticated)
- Full ranked table: rank icon, avatar, name, class, score, streak, level
- Bot entries labeled with AI badge
- Score formula displayed in footer

### Loans (`/loans`)
- Level 15 gate with progress message
- Active loan panel: balance, repay progress bar, manual repay form
- Danger level indicators (ok / warning / critical)
- Take loan form: preset amounts, custom amount, reward description
- Reward ideas panel (click to prefill form)

### Achievements (`/achievements`)
- 26 achievements across 6 categories
- Overall completion progress bar
- Category filter pills
- Per-achievement: icon, name, description, progress bar, XP/credit rewards
- Unlocked achievements highlighted with color accent

## Design system

- **Fonts**: Cinzel (headings/logo) + Rajdhani (body)
- **Theme**: Deep dark purple (`#0A0812`) + gold accents (`#F0B429`)
- **Stat colors**: INT=blue, STR=red, DIS=purple, SOC=green
- **Animations**: `fadeUp` with staggered delays for page loads
- **Mobile**: Sidebar hidden, bottom tab bar shown on ≤768px
