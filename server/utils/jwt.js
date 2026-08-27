import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/** Sign a short-lived access token. */
export function signAccessToken(payload) {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpires });
}

/** Sign a long-lived refresh token. */
export function signRefreshToken(payload) {
  return jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpires });
}

/** Verify an access token; throws on invalid/expired. */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

/** Verify a refresh token; throws on invalid/expired. */
export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}
