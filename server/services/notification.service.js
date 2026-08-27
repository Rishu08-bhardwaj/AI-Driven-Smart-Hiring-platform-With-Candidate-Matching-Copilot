import { pool } from '../config/db.js';

/**
 * Create a notification. If `userId` is null the notification is broadcast
 * (visible to all admins in the UI). Non-throwing by design.
 */
export async function notify({ title, description = null, userId = null, type = null }) {
  try {
    await pool.execute(
      `INSERT INTO notifications (title, description, user_id, type)
       VALUES (:title, :description, :userId, :type)`,
      { title, description, userId, type }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notification] failed:', err.message);
  }
}

/** List notifications for a user (their own + broadcast). */
export async function listForUser(userId, { limit = 20 } = {}) {
  const [rows] = await pool.query(
    `SELECT * FROM notifications
     WHERE user_id = :userId OR user_id IS NULL
     ORDER BY created_at DESC
     LIMIT :limit`,
    { userId, limit: Number(limit) }
  );
  return rows;
}

/** Mark a single notification read. */
export async function markRead(id, userId) {
  await pool.execute(
    `UPDATE notifications SET is_read = 1
     WHERE id = :id AND (user_id = :userId OR user_id IS NULL)`,
    { id, userId }
  );
}

/** Mark all of a user's notifications read. */
export async function markAllRead(userId) {
  await pool.execute(
    `UPDATE notifications SET is_read = 1 WHERE user_id = :userId OR user_id IS NULL`,
    { userId }
  );
}
