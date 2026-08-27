import { pool } from '../config/db.js';

export async function list({ status = '', includeDeleted = false } = {}) {
  const where = [];
  const params = {};
  if (!includeDeleted) where.push('deleted_at IS NULL');
  if (status) { where.push('status = :status'); params.status = status; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM leave_types ${whereSql} ORDER BY name`, params);
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM leave_types WHERE id = :id LIMIT 1', { id });
  return rows[0] || null;
}

export async function create(data) {
  const [res] = await pool.execute(
    `INSERT INTO leave_types (name, code, default_days, is_paid, status)
     VALUES (:name, :code, :defaultDays, :isPaid, :status)`,
    {
      name: data.name,
      code: data.code,
      defaultDays: data.default_days ?? 0,
      isPaid: data.is_paid ? 1 : 0,
      status: data.status || 'active',
    }
  );
  return findById(res.insertId);
}

export async function update(id, data) {
  await pool.execute(
    `UPDATE leave_types SET name=:name, code=:code, default_days=:defaultDays,
       is_paid=:isPaid, status=:status
     WHERE id=:id AND deleted_at IS NULL`,
    {
      id,
      name: data.name,
      code: data.code,
      defaultDays: data.default_days ?? 0,
      isPaid: data.is_paid ? 1 : 0,
      status: data.status || 'active',
    }
  );
  return findById(id);
}

export async function softDelete(id) {
  await pool.execute('UPDATE leave_types SET deleted_at = NOW(), status = "inactive" WHERE id = :id', { id });
}
