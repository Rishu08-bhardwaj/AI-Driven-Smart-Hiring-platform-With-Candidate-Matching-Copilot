import { ApiError } from '../utils/ApiError.js';
import { roleHasPermission } from '../utils/permissions.js';

/**
 * Gate a route by one or more permissions. The authenticated user's role
 * must hold AT LEAST ONE of the listed permissions.
 * @param {...string} required
 */
export function authorize(...required) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const allowed = required.some((perm) => roleHasPermission(req.user.role, perm));
    if (!allowed) {
      return next(ApiError.forbidden('You do not have permission to perform this action.'));
    }
    next();
  };
}

/** Restrict a route to specific roles. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Your role cannot access this resource.'));
    }
    next();
  };
}
