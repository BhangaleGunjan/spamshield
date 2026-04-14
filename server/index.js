require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { rateLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const analyzeRoutes = require('./routes/analyze');
const resultRoutes = require('./routes/results');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10kb' })); // Limit payload size
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
app.use('/api/', rateLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', analyzeRoutes);
app.use('/api', resultRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDatabase();
    await connectRedis();
    app.listen(PORT, () => {
      logger.info(`SpamShield API running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
