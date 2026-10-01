import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import { getCache, setCache } from '../utils/cache.js';

// ─── protect ──────────────────────────────────────────────────────────────────
// WHY: Without caching, every single authenticated API call hits MongoDB to
// look up the user. At 1000 req/s that's 1000 DB reads/s just for auth.
// With Redis caching the user doc for 60s, >99% of those reads are eliminated.
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const cacheKey = `user:${decoded.id}`;

    // 1. Try Redis cache first
    const cached = await getCache(cacheKey);
    if (cached) {
      req.user = cached;
      return next();
    }

    // 2. Cache miss — fetch from MongoDB
    const user = await User.findById(decoded.id).select('-password').lean();
    if (!user) {
      res.status(401);
      throw new Error('User not found');
    }

    // 3. Cache for 60 seconds (invalidated on profile update)
    await setCache(cacheKey, user, 60);
    req.user = user;
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, token failed');
  }
});

export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403);
    throw new Error('Admin access required');
  }
};

export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};
