import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as UserModel from '../models/user.model.js';

/**
 * Authenticate the request via Bearer access token (or httpOnly cookie).
 * Attaches `req.user = { id, name, email, role }` on success.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) throw ApiError.unauthorized('Authentication required.');

  const decoded = verifyAccessToken(token);
  const user = await UserModel.findById(decoded.sub);
  if (!user || user.status !== 'active' || user.deleted_at) {
    throw ApiError.unauthorized('Account is inactive or no longer exists.');
  }

  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  next();
});
