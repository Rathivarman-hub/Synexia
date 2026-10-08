import Redis from 'ioredis';
import logger from './logger.js';

let client = null;
let isConnected = false;

const createRedisClient = (redisUrl) => {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: (times) => {
      const delay = Math.min(times * 500, 5000);
      if (times <= 3 || times % 10 === 0) {
        logger.warn(`Redis: reconnecting in ${delay}ms (attempt ${times})`);
      }
      return delay;
    },
  });

  redis.on('ready', () => {
    isConnected = true;
    logger.info('✅ Redis connected');
  });

  redis.on('error', (err) => {
    isConnected = false;
    logger.warn(`Redis error: ${err.message}`);
  });

  redis.on('close', () => {
    isConnected = false;
    logger.warn('Redis connection closed');
  });

  redis.on('end', () => {
    isConnected = false;
    logger.warn('Redis connection ended');
  });

  return redis;
};

export const connectRedis = async () => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.info('Redis disabled: REDIS_URL is not configured. Caching disabled — app will still work.');
    isConnected = false;
    return;
  }

  try {
    client = createRedisClient(redisUrl);
    await client.connect();
  } catch (err) {
    logger.warn(`Redis unavailable: ${err.message}. Caching disabled — app will still work.`);
    isConnected = false;
  }
};

export const getRedisClient = () => client;
export const isRedisConnected = () => isConnected && client?.status === 'ready';

export default client;
