import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const windowMs = env.rateLimit.windowMin * 60 * 1000;

const jsonMessage = (msg) => (req, res) =>
  res.status(429).json({ success: false, message: msg });

/** General API limiter applied to all routes. */
export const apiLimiter = rateLimit({
  windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonMessage('Too many requests. Please slow down and try again later.'),
});

/** Stricter limiter for auth endpoints (brute-force protection). */
export const authLimiter = rateLimit({
  windowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonMessage('Too many attempts. Please wait before trying again.'),
});
