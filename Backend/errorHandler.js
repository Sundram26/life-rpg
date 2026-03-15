/**
 * Central error handler — must be registered LAST with app.use()
 */
export function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);

  // Firestore errors
  if (err.code?.startsWith('firestore/')) {
    return res.status(503).json({ success: false, error: 'Database error', detail: err.message });
  }

  // Validation errors from express-validator
  if (err.type === 'validation') {
    return res.status(400).json({ success: false, error: 'Validation failed', errors: err.errors });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error:   err.message || 'Internal server error',
  });
}

/**
 * Wraps an async route handler and forwards errors to errorHandler.
 * Eliminates try/catch boilerplate in every route.
 *
 * Usage: router.post('/path', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
