import { pool } from '../config/db.js';

export async function list({ year = '', type = '', includeDeleted = false } = {}) {
  const where = [];
  const params = {};
  if (!includeDeleted) where.push('deleted_at IS NULL');
  if (year) { where.push('YEAR(holiday_date) = :year'); params.year = year; }
  if (type) { where.push('holiday_type = :type'); params.type = type; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM holidays ${whereSql} ORDER BY holiday_date`, params);
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM holidays WHERE id = :id LIMIT 1', { id });
  return rows[0] || null;
}

export async function create(data) {
  const [res] = await pool.execute(
    `INSERT INTO holidays (name, holiday_date, description, holiday_type, recurring, applicable_departments, status)
     VALUES (:name, :date, :description, :type, :recurring, :depts, :status)`,
    {
      name: data.name,
      date: data.holiday_date,
      description: data.description || null,
      type: data.holiday_type || 'company',
      recurring: data.recurring ? 1 : 0,
      depts: Array.isArray(data.applicable_departments) ? data.applicable_departments.join(',') : data.applicable_departments || null,
      status: data.status || 'active',
    }
  );
  return findById(res.insertId);
}

export async function update(id, data) {
  await pool.execute(
    `UPDATE holidays SET name=:name, holiday_date=:date, description=:description,
       holiday_type=:type, recurring=:recurring, applicable_departments=:depts, status=:status
     WHERE id=:id AND deleted_at IS NULL`,
    {
      id,
      name: data.name,
      date: data.holiday_date,
      description: data.description || null,
      type: data.holiday_type || 'company',
      recurring: data.recurring ? 1 : 0,
      depts: Array.isArray(data.applicable_departments) ? data.applicable_departments.join(',') : data.applicable_departments || null,
      status: data.status || 'active',
    }
  );
  return findById(id);
}

export async function softDelete(id) {
  await pool.execute('UPDATE holidays SET deleted_at = NOW(), status = "inactive" WHERE id = :id', { id });
}
