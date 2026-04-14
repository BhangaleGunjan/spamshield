const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '50', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please wait before submitting more URLs for analysis.',
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

// Stricter limiter for the analyze endpoint specifically
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,              // Max 5 analysis requests per minute per IP
  message: {
    error: 'Too many analysis requests. Please wait 1 minute before submitting more URLs.',
  },
});

module.exports = { rateLimiter, analyzeLimiter };
