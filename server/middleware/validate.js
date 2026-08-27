import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

/**
 * Run after a chain of express-validator rules. Collects failures into the
 * ApiError `details` shape and throws a 422.
 */
export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map((e) => ({
    field: e.path ?? e.param,
    message: e.msg,
  }));
  throw ApiError.unprocessable('Validation failed.', details);
}
