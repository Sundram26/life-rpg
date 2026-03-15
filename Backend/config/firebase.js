import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let db;

export function initFirebase() {
  if (admin.apps.length > 0) return admin.apps[0];

  const app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });

  db = admin.firestore();

  // Firestore settings
  db.settings({ ignoreUndefinedProperties: true });

  console.log('✅ Firebase initialised');
  return app;
}

export function getDb() {
  if (!db) throw new Error('Firebase not initialised — call initFirebase() first');
  return db;
}

// Collection name constants — single source of truth
export const COLLECTIONS = {
  USERS:               'users',
  STATS:               'stats',
  TASKS:               'tasks',
  CREDITS:             'credits',
  CREDIT_TRANSACTIONS: 'credit_transactions',
  LOANS:               'loans',
  LEADERBOARD:         'leaderboard',
  ACHIEVEMENTS:        'achievements',
  USER_ACHIEVEMENTS:   'user_achievements',
  DAILY_QUESTS:        'daily_quests',
};
