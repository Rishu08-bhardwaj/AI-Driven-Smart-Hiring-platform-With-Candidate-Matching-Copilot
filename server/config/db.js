import mysql from 'mysql2/promise';
import { env } from './env.js';

/**
 * Shared MySQL/MariaDB connection pool.
 * Use `pool.query` / `pool.execute` for single statements and
 * `withTransaction` for multi-statement atomic operations (payroll, etc.).
 */
export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  namedPlaceholders: true,
  dateStrings: true,
  charset: 'utf8mb4_general_ci',
});

/**
 * Run a set of queries inside a single transaction.
 * The callback receives a dedicated connection; commit/rollback is automatic.
 * @template T
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Verify the database is reachable; throws on failure. */
export async function assertDbConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}
