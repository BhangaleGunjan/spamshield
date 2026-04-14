const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error:', { message: err.message, stack: err.stack });

  const statusCode = err.statusCode || 500;
  const message = statusCode < 500 ? err.message : 'An internal server error occurred.';

  res.status(statusCode).json({ error: message });
}

module.exports = { errorHandler };
