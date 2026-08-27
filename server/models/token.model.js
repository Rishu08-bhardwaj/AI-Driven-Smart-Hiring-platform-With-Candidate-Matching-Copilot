import { pool } from '../config/db.js';
import { sha256 } from '../utils/password.js';

// ── Refresh tokens ─────────────────────────────────────────

/** Store a refresh token (hashed) with metadata. */
export async function storeRefreshToken({ userId, token, expiresAt, userAgent, ip }) {
  await pool.execute(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES (:userId, :hash, :expiresAt, :ua, :ip)`,
    { userId, hash: sha256(token), expiresAt, ua: userAgent?.slice(0, 255) || null, ip: ip || null }
  );
}

/** Look up a live (non-revoked, non-expired) refresh token by raw value. */
export async function findLiveRefreshToken(token) {
  const [rows] = await pool.query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = :hash AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    { hash: sha256(token) }
  );
  return rows[0] || null;
}

/** Revoke a single refresh token by raw value. */
export async function revokeRefreshToken(token) {
  await pool.execute(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = :hash AND revoked_at IS NULL`,
    { hash: sha256(token) }
  );
}

/** Revoke all of a user's refresh tokens (e.g. on password reset). */
export async function revokeAllForUser(userId) {
  await pool.execute(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = :userId AND revoked_at IS NULL`,
    { userId }
  );
}

// ── Password resets ────────────────────────────────────────

/** Create a password-reset record. */
export async function createPasswordReset({ userId, token, expiresAt }) {
  await pool.execute(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES (:userId, :hash, :expiresAt)`,
    { userId, hash: sha256(token), expiresAt }
  );
}

/** Find a usable reset token. */
export async function findLiveReset(token) {
  const [rows] = await pool.query(
    `SELECT * FROM password_resets
     WHERE token_hash = :hash AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    { hash: sha256(token) }
  );
  return rows[0] || null;
}

/** Mark a reset token consumed. */
export async function consumeReset(id) {
  await pool.execute('UPDATE password_resets SET used_at = NOW() WHERE id = :id', { id });
}
