import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

/** 404 handler for unmatched routes. */
export function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Global error handler. Translates known error shapes (ApiError, MySQL,
 * Multer, JWT) into a consistent JSON envelope and hides internals in prod.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || [];

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'A record with these details already exists.';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    statusCode = 400;
    message = 'Referenced record does not exist.';
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    statusCode = 409;
    message = 'This record is referenced by other data and cannot be removed.';
  }

  // JWT
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired. Please log in again.';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token.';
  }

  // Multer
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'Uploaded file exceeds the maximum allowed size.';
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field in upload.';
  }

  if (statusCode >= 500 && !env.isProd) {
    // Surface server errors during development.
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  const body = { success: false, message };
  if (details.length) body.errors = details;
  if (!env.isProd && statusCode >= 500) body.stack = err.stack;

  res.status(statusCode).json(body);
}
