const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const readToken = (req) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
};

// Verify any logged-in user
const authMiddleware = (req, res, next) => {
  if (!req.headers.authorization) return res.status(401).json({ message: 'No token provided' });
  const decoded = readToken(req);
  if (!decoded) return res.status(401).json({ message: 'Invalid token' });
  req.user = decoded;
  next();
};

// Logged-in user if a valid token is sent, guest otherwise (never rejects)
const optionalAuth = (req, res, next) => {
  const decoded = readToken(req);
  if (decoded) req.user = decoded;
  next();
};

// Verify admin only. The role is read from the database, not from the token:
// a token stays valid for 90 days, and an admin who was demoted or deleted
// must lose access right away.
const adminMiddleware = (req, res, next) => {
  authMiddleware(req, res, async () => {
    try {
      const user = await User.findById(req.user.id).select('role').lean();
      if (!user) return res.status(401).json({ message: 'Invalid token' });
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      req.user.role = user.role;
      next();
    } catch {
      res.status(401).json({ message: 'Invalid token' });
    }
  });
};

module.exports = { authMiddleware, adminMiddleware, optionalAuth };
