import 'dotenv/config';
import express       from 'express';
import cors          from 'cors';
import rateLimit     from 'express-rate-limit';

import { initFirebase }     from './config/firebase.js';
import { errorHandler }     from './middleware/errorHandler.js';

import createUserRouter  from './routes/createUser.js';
import addTaskRouter     from './routes/addTask.js';
import loansRouter       from './routes/loans.js';
import leaderboardRouter from './routes/leaderboard.js';
import profileRouter     from './routes/profile.js';

// ─── INIT ────────────────────────────────────────────────────────────────────

initFirebase();

const app  = express();
const PORT = process.env.PORT ?? 3000;

// ─── GLOBAL MIDDLEWARE ───────────────────────────────────────────────────────

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false }));

// ─── RATE LIMITING ───────────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max:      200,
  message:  { success: false, error: 'Too many requests — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders:   false,
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max:      20,
  message:  { success: false, error: 'Too many write requests — slow down a little' },
});

app.use(globalLimiter);

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'life-rpg-api',
    version: '1.0.0',
    time:    new Date().toISOString(),
  });
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────

app.post('/createUser',      writeLimiter,  createUserRouter);
app.post('/addTask',         writeLimiter,  addTaskRouter);
app.post('/takeLoan',        writeLimiter,  loansRouter);
app.post('/repayLoan',       writeLimiter,  loansRouter);
app.get('/leaderboard',                    leaderboardRouter);
app.get('/profile',                        profileRouter);

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error:   `Route not found: ${req.method} ${req.path}`,
    available_routes: [
      'POST /createUser',
      'POST /addTask',
      'POST /takeLoan',
      'POST /repayLoan',
      'GET  /leaderboard',
      'GET  /profile',
    ],
  });
});

// ─── ERROR HANDLER (must be last) ────────────────────────────────────────────

app.use(errorHandler);

// ─── START ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🗡️  Life RPG API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`   Health:      http://localhost:${PORT}/health\n`);
});

export default app;
