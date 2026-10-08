import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient, isRedisConnected } from '../config/redis.js';
import logger from '../config/logger.js';

/**
 * Build a rate limiter, using Redis store if available (shared across PM2 workers),
 * falling back to in-memory store in dev or when Redis is unavailable.
 */
const buildLimiter = ({ windowMs, max, message, prefix, skipSuccessfulRequests = false, keyGenerator, useRedis = isRedisConnected() }) => {
  const options = {
    windowMs,
    max,
    standardHeaders: true,  // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,
    skipSuccessfulRequests,
    // WHY: caller-supplied keyGenerator wins, otherwise default to the IP.
    // Express-rate-limit v8 requires ipKeyGenerator() for any custom IPv6-aware
    // key function, which is why callers compose it rather than raw req.ip.
    keyGenerator: keyGenerator || ((req) => ipKeyGenerator(req.ip || 'unknown')),
    handler: (req, res) => {
      logger.warn(`Rate limit hit: ${req.ip} on ${req.originalUrl}`);
      res.status(429).json({
        success: false,
        message,
      });
    },
  };

  if (useRedis && isRedisConnected()) {
    options.store = new RedisStore({
      sendCommand: (...args) => getRedisClient().call(...args),
      prefix,
    });
  }

  return rateLimit(options);
};

// ─── Auth limiter ─────────────────────────────────────────────────────────────
// Prevents brute-force while allowing concurrent legitimate logins from shared networks/proxies
export const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skipSuccessfulRequests: true,
  message: 'Too many failed login attempts from this IP. Please try again after 15 minutes.',
  prefix: 'rl:auth:',
});

// ─── General API limiter ──────────────────────────────────────────────────────
// General protection against DDoS: 200 requests per minute per IP
export const generalLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP. Please slow down.',
  prefix: 'rl:api:',
});

// ─── Admin limiter ────────────────────────────────────────────────────────────
// Admin routes are sensitive — tighter limit
export const adminLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Admin rate limit exceeded. Please slow down.',
  prefix: 'rl:admin:',
});

// ─── Code execution limiter ───────────────────────────────────────────────────
// WHY a dedicated budget: /coding/run and /coding/submit are the ONLY endpoints
// that burn third-party sandbox quota, so they must not be able to exhaust it via
// the general 200/min IP allowance. 30 runs/min per user is generous for genuine
// iteration while capping the blast radius of a scripted submit loop.
//
// Use an in-memory limiter during module initialization, then replace it during
// server startup if Redis connected. Constructing a limiter in request middleware
// triggers express-rate-limit's request-time initialization warning.
const CODE_LIMIT_WINDOW_MS = 60 * 1000;
const CODE_LIMIT_MAX = 30;

const createCodeLimiter = (useRedis) => buildLimiter({
  windowMs: CODE_LIMIT_WINDOW_MS,
  max: CODE_LIMIT_MAX,
  message: 'You are submitting code too quickly. Please wait a moment before running or submitting again.',
  prefix: 'rl:code:',
  // Key on userId to avoid locking out everyone behind a shared campus NAT.
  keyGenerator: (req) => req.user?._id || ipKeyGenerator(req.ip || 'unknown'),
  useRedis,
});

let codeLimiterInstance = createCodeLimiter(false);

export const initializeCodeLimiter = () => {
  if (isRedisConnected()) {
    codeLimiterInstance = createCodeLimiter(true);
  }
};

export const codeLimiter = (req, res, next) => codeLimiterInstance(req, res, next);
