import 'dotenv/config';
import express       from 'express';
import cors          from 'cors';
import rateLimit     from 'express-rate-limit';

import { initFirebase, getDb } from './config/firebase.js';
import { errorHandler }     from './middleware/errorHandler.js';
import { authenticate }     from './middleware/auth.js';

import createUserRouter  from './routes/createUser.js';
import addTaskRouter     from './routes/addTask.js';
import loansRouter       from './routes/loans.js';
import leaderboardRouter from './routes/leaderboard.js';
import profileRouter     from './routes/profile.js';
import aiRouter          from './ai/routes.js';
import { createBotRoutes }  from './bot/routes.js';
import { createLoanRoutes } from './loan/routes.js';

// ─── INIT ────────────────────────────────────────────────────────────────────

initFirebase();

const app  = express();
app.set('trust proxy', 1); // v2
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

app.use('/createUser',   writeLimiter,  createUserRouter);
app.use('/addTask',      writeLimiter,  addTaskRouter);
app.use('/takeLoan',     writeLimiter,  loansRouter);
app.use('/repayLoan',    writeLimiter,  loansRouter);
app.use('/leaderboard',                leaderboardRouter);
app.use('/profile',                    profileRouter);
app.use('/ai',                         aiRouter);
app.use('/bot',  createBotRoutes(getDb(), authenticate));
app.use('/loan', createLoanRoutes(getDb(), authenticate));

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
