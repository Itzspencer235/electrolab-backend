const rateLimit = require('express-rate-limit');

// ── Body sanitizer ────────────────────────────────────────────────────────────
// Removes keys that start with "$" (MongoDB operators such as {"$regex": ...}
// or {"$ne": ...}) and prototype keys from JSON bodies, so a client can never
// turn a value it sends into a query operator.
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function clean(value, depth = 0) {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => clean(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('$') || BAD_KEYS.has(k)) continue;
    out[k] = clean(v, depth + 1);
  }
  return out;
}

const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  next();
};

// ── Rate limits (per IP) ──────────────────────────────────────────────────────
const limiter = (windowMin, max, message) => rateLimit({
  windowMs: windowMin * 60 * 1000,
  limit: max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message },
});

module.exports = {
  sanitizeBody,
  // Everything under /api — generous, just stops floods
  apiLimiter:   limiter(15, 600, 'Too many requests, please try again later.'),
  // Login / register / OAuth — slows down password guessing
  authLimiter:  limiter(15, 20,  'Trop de tentatives. Réessayez dans 15 minutes.'),
  // Orders — stops order spam
  orderLimiter: limiter(60, 20,  'Trop de commandes. Réessayez plus tard.'),
  // AI chat — every message costs Gemini credits
  chatLimiter:  limiter(10, 30,  'Trop de messages. Patientez quelques minutes.'),
};
