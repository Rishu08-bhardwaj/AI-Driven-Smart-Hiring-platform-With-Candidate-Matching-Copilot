import { pool } from '../config/db.js';

/** Paginated, filterable audit-log list with the actor's name joined in. */
export async function list({ search = '', action = '', entity = '', userId = '', from = '', to = '', page = 1, limit = 25 } = {}) {
  const where = [];
  const params = {};
  if (action) { where.push('a.action = :action'); params.action = action; }
  if (entity) { where.push('a.entity = :entity'); params.entity = entity; }
  if (userId) { where.push('a.user_id = :userId'); params.userId = userId; }
  if (from) { where.push('a.created_at >= :from'); params.from = `${from} 00:00:00`; }
  if (to) { where.push('a.created_at <= :to'); params.to = `${to} 23:59:59`; }
  if (search) {
    where.push('(a.description LIKE :s OR a.action LIKE :s OR u.name LIKE :s)');
    params.s = `%${search}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const offset = (safePage - 1) * safeLimit;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ${whereSql}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT a.id, a.user_id, u.name AS user_name, u.role AS user_role,
            a.action, a.entity, a.entity_id, a.description, a.ip_address, a.created_at
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${whereSql}
     ORDER BY a.created_at DESC
     LIMIT :limit OFFSET :offset`,
    { ...params, limit: safeLimit, offset }
  );
  return { rows, total: countRows[0].c, page: safePage, limit: safeLimit };
}

/** Distinct action names, for a filter dropdown. */
export async function actions() {
  const [rows] = await pool.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  return rows.map((r) => r.action);
}
