import test from 'node:test';
import assert from 'node:assert/strict';
import { createRedisRateLimitStore } from '../middleware/rateLimiter.js';

test('rate-limit Redis store rejects closed clients so requests can fall back safely', async () => {
  const store = createRedisRateLimitStore('test:', () => ({ status: 'end' }));

  await assert.rejects(
    store.sendCommand({ command: ['INCR', 'test:user'] }),
    /Redis rate-limit store is unavailable/
  );
});

test('rate-limit Redis store forwards commands and surfaces Redis command failures', async () => {
  const commandError = new Error('Connection is closed.');
  const client = {
    status: 'ready',
    call: async (...args) => {
      assert.deepEqual(args, ['INCR', 'test:user']);
      throw commandError;
    },
  };
  const store = createRedisRateLimitStore('test:', () => client);

  await assert.rejects(
    store.sendCommand({ command: ['INCR', 'test:user'] }),
    (error) => error === commandError
  );
});
