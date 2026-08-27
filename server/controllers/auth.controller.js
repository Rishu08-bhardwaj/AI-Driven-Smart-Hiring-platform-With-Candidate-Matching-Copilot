import ms from '../utils/ms.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { env } from '../config/env.js';
import { hashPassword, verifyPassword, randomToken } from '../utils/password.js';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';
import { clientInfo } from '../utils/requestContext.js';
import * as UserModel from '../models/user.model.js';
import * as TokenModel from '../models/token.model.js';
import { recordAudit } from '../services/audit.service.js';
import { sendMail } from '../services/mailer.service.js';

const REFRESH_COOKIE = 'refreshToken';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'strict' : 'lax',
    maxAge: ms(env.jwt.refreshExpires),
    path: '/api/auth',
  };
}

/** Issue access + refresh tokens and persist the refresh token. */
async function issueTokens(user, req, remember) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });
  const { ip, userAgent } = clientInfo(req);
  const expiresAt = new Date(Date.now() + ms(env.jwt.refreshExpires));
  await TokenModel.storeRefreshToken({
    userId: user.id,
    token: refreshToken,
    expiresAt: expiresAt.toISOString().slice(0, 19).replace('T', ' '),
    userAgent,
    ip,
  });
  return { accessToken, refreshToken, remember };
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status };
}

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password, remember = false } = req.body;
  const user = await UserModel.findByEmail(email);
  if (!user) throw ApiError.unauthorized('Invalid email or password.');
  if (user.status !== 'active') throw ApiError.forbidden('Your account is inactive.');

  const ok = await verifyPassword(password, user.password);
  if (!ok) throw ApiError.unauthorized('Invalid email or password.');

  const { accessToken, refreshToken } = await issueTokens(user, req, remember);
  await UserModel.touchLogin(user.id);
  await recordAudit({ req, userId: user.id, action: 'auth.login', entity: 'user', entityId: user.id });

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return sendSuccess(res, {
    message: 'Logged in successfully.',
    data: { user: publicUser(user), accessToken },
  });
});

// POST /api/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body.refreshToken;
  if (!token) throw ApiError.unauthorized('No refresh token provided.');

  const stored = await TokenModel.findLiveRefreshToken(token);
  if (!stored) throw ApiError.unauthorized('Session expired. Please log in again.');

  const user = await UserModel.findById(stored.user_id);
  if (!user || user.status !== 'active' || user.deleted_at) {
    throw ApiError.unauthorized('Account is inactive.');
  }

  // Rotate: revoke the old token, issue a fresh pair.
  await TokenModel.revokeRefreshToken(token);
  const { accessToken, refreshToken } = await issueTokens(user, req, true);

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return sendSuccess(res, {
    message: 'Token refreshed.',
    data: { user: publicUser(user), accessToken },
  });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body.refreshToken;
  if (token) await TokenModel.revokeRefreshToken(token);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  return sendSuccess(res, { message: 'Logged out successfully.' });
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  const user = await UserModel.getPublicById(req.user.id);
  if (!user) throw ApiError.notFound('User not found.');
  return sendSuccess(res, { data: { user } });
});

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await UserModel.findByEmail(email);

  // Always respond success to avoid leaking which emails exist.
  if (user) {
    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + ms('1h')).toISOString().slice(0, 19).replace('T', ' ');
    await TokenModel.createPasswordReset({ userId: user.id, token, expiresAt });
    const resetUrl = `${env.clientUrl}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your HRMS password',
      text: `Reset your password using this link (valid 1 hour): ${resetUrl}`,
      html: `<p>Reset your password using the link below (valid for 1 hour):</p>
             <p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }

  return sendSuccess(res, {
    message: 'If an account exists for that email, a reset link has been sent.',
  });
});

// POST /api/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const reset = await TokenModel.findLiveReset(token);
  if (!reset) throw ApiError.badRequest('Reset link is invalid or has expired.');

  const hash = await hashPassword(password);
  await UserModel.setPassword(reset.user_id, hash);
  await TokenModel.consumeReset(reset.id);
  await TokenModel.revokeAllForUser(reset.user_id); // force re-login everywhere
  await recordAudit({ userId: reset.user_id, action: 'auth.reset_password', entity: 'user', entityId: reset.user_id });

  return sendSuccess(res, { message: 'Password updated. Please log in with your new password.' });
});
