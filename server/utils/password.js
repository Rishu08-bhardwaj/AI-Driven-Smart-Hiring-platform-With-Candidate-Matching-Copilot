import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

/** Hash a plaintext password. */
export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Compare a plaintext password against a stored hash. */
export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/** Generate a cryptographically-random token (hex) for resets / refresh. */
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** SHA-256 hash of a token for at-rest storage (never store raw tokens). */
export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
