import admin from 'firebase-admin';

/**
 * Middleware: verifies Firebase ID token from Authorization header.
 * Attaches decoded token to req.user.
 *
 * Usage: router.get('/profile', authenticate, handler)
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error:   'Missing or malformed Authorization header. Expected: Bearer <token>',
    });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;  // { uid, email, name, ... }
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error:   'Invalid or expired token',
      detail:  err.message,
    });
  }
}

/**
 * Optional auth — attaches user if token present, continues either way.
 * Used for public routes that optionally personalise for logged-in users.
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.split('Bearer ')[1];
    req.user = await admin.auth().verifyIdToken(token);
  } catch {
    // ignore — user stays undefined
  }
  next();
}
