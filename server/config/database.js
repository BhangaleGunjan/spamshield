const mongoose = require('mongoose');
const logger = require('../utils/logger');

let isConnected = false;

async function connectDatabase() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/spamshield';

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
    isConnected = true;
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
    isConnected = false;
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10,
  });
}

async function disconnectDatabase() {
  if (!isConnected) return;
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };
