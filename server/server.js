process.env.UV_THREADPOOL_SIZE = '64';

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import os from 'os';
import mongoose from 'mongoose';

import connectDB from './config/db.js';
import { connectRedis, isRedisConnected } from './config/redis.js';
import logger from './config/logger.js';
import { errorHandler, notFound } from './middleware/error.js';
import { generalLimiter, authLimiter, adminLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import debuggingRoutes from './routes/debugging.js';
import { seedDebuggingProblems } from './services/debuggingProblemSeeder.js';

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason: String(reason) });
});

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));

app.use(compression({ level: 6, threshold: 1024 }));

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use((req, _res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.query) mongoSanitize.sanitize(req.query);
  next();
});

const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: { write: (message) => logger.http(message.trim()) },
  skip: (req) => req.url === '/api/health',
}));

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/admin', adminLimiter);
// NOTE: /api/coding deliberately does NOT get codeLimiter mounted here. Only
// /api/coding/run and /api/coding/submit consume sandbox quota and are limited
// (see routes/coding.js); the catalogue and leaderboard reads inherit the
// general limiter already applied to /api/ above.

const MONGOOSE_STATES = ['disconnected', 'connecting', 'connected', 'disconnecting'];

app.get('/api/health', (req, res) => {
  const memUsage = process.memoryUsage();
  const toMB = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    pid: process.pid,
    cpus: os.cpus().length,
    memory: {
      heapUsed: toMB(memUsage.heapUsed),
      heapTotal: toMB(memUsage.heapTotal),
      rss: toMB(memUsage.rss),
    },
    services: {
      mongodb: MONGOOSE_STATES[mongoose.connection.readyState] || 'unknown',
      redis: isRedisConnected() ? 'connected' : 'unavailable',
    },
    version: process.version,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/debugging', debuggingRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await seedDebuggingProblems();
  await connectRedis();

  const server = app.listen(PORT, () =>
    logger.info(`🚀 Synexia server running on port ${PORT} [PID: ${process.pid}]`)
  );

  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      logger.info('HTTP server closed');
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer().catch((err) => {
  logger.error('Server startup failed', { message: err.message, stack: err.stack });
  process.exit(1);
});
