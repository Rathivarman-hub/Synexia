import logger from '../config/logger.js';

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Log all 5xx errors as errors, 4xx as warnings
  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} — ${err.message}`, {
      statusCode,
      stack: err.stack,
      ip: req.ip,
    });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} — ${err.message}`, {
      statusCode,
      ip: req.ip,
    });
  }

  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};
