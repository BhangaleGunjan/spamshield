const { createClient } = require('redis');
const logger = require('../utils/logger');

let client = null;

async function connectRedis() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  client = createClient({ url });

  client.on('error', (err) => logger.error('Redis error:', err));
  client.on('connect', () => logger.info('Redis connected'));
  client.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  await client.connect();
  return client;
}

function getRedisClient() {
  if (!client) throw new Error('Redis not initialized. Call connectRedis() first.');
  return client;
}

module.exports = { connectRedis, getRedisClient };
