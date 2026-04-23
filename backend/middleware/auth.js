const jwt = require('jsonwebtoken');
const User = require('../models/User');

const userCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedUser(id) {
  const entry = userCache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { userCache.delete(id); return null; }
  return entry.user;
}

exports.clearUserCache = (id) => userCache.delete(String(id));

exports.protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const cached = getCachedUser(decoded.id);
    if (cached) {
      req.user = cached;
    } else {
      const user = await User.findById(decoded.id).select('-password -__v').lean();
      if (!user) return res.status(401).json({ message: 'User not found. Please log in again.' });
      userCache.set(decoded.id, { user, expiresAt: Date.now() + CACHE_TTL_MS });
      req.user = user;
    }
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid' });
  }
};

// Blocks pending and revoked users from accessing any content
exports.requireActive = (req, res, next) => {
  const { role } = req.user;
  if (role === 'pending') return res.status(403).json({ message: 'Your account is pending admin approval.', code: 'PENDING' });
  if (role === 'revoked') return res.status(403).json({ message: 'Your access has been revoked. Contact an admin.', code: 'REVOKED' });
  next();
};

// Only write + admin can create/edit
exports.requireWrite = (req, res, next) => {
  const { role } = req.user;
  if (role !== 'write' && role !== 'admin')
    return res.status(403).json({ message: 'You have read-only access.' });
  next();
};

// Only admin can delete
exports.requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Admin access required.' });
  next();
};
