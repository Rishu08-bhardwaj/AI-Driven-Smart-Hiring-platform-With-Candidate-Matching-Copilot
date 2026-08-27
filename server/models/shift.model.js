import { pool } from '../config/db.js';

export async function list({ status = '', includeDeleted = false } = {}) {
  const where = [];
  const params = {};
  if (!includeDeleted) where.push('deleted_at IS NULL');
  if (status) { where.push('status = :status'); params.status = status; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM employees e WHERE e.shift_id = s.id AND e.deleted_at IS NULL) AS employees_count
     FROM shifts s ${whereSql} ORDER BY s.shift_name`,
    params
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM shifts WHERE id = :id LIMIT 1', { id });
  return rows[0] || null;
}

export async function create(data) {
  const [res] = await pool.execute(
    `INSERT INTO shifts (shift_name, start_time, end_time, break_minutes, grace_minutes, weekly_off, status)
     VALUES (:name, :start, :end, :brk, :grace, :off, :status)`,
    {
      name: data.shift_name,
      start: data.start_time,
      end: data.end_time,
      brk: data.break_minutes ?? 0,
      grace: data.grace_minutes ?? 0,
      off: data.weekly_off || null,
      status: data.status || 'active',
    }
  );
  return findById(res.insertId);
}

export async function update(id, data) {
  await pool.execute(
    `UPDATE shifts SET shift_name=:name, start_time=:start, end_time=:end,
       break_minutes=:brk, grace_minutes=:grace, weekly_off=:off, status=:status
     WHERE id=:id AND deleted_at IS NULL`,
    {
      id,
      name: data.shift_name,
      start: data.start_time,
      end: data.end_time,
      brk: data.break_minutes ?? 0,
      grace: data.grace_minutes ?? 0,
      off: data.weekly_off || null,
      status: data.status || 'active',
    }
  );
  return findById(id);
}

export async function softDelete(id) {
  await pool.execute('UPDATE shifts SET deleted_at = NOW(), status = "inactive" WHERE id = :id', { id });
}

export async function assignEmployees(shiftId, employeeIds) {
  if (!employeeIds.length) return 0;
  const [res] = await pool.query(
    'UPDATE employees SET shift_id = :shiftId WHERE id IN (:ids) AND deleted_at IS NULL',
    { shiftId, ids: employeeIds }
  );
  return res.affectedRows;
}

/** Resolve the effective shift for an employee (their assigned shift). */
export async function shiftForEmployee(employeeId) {
  const [rows] = await pool.query(
    `SELECT s.* FROM shifts s
     JOIN employees e ON e.shift_id = s.id
     WHERE e.id = :id AND s.deleted_at IS NULL LIMIT 1`,
    { id: employeeId }
  );
  return rows[0] || null;
}

/** The company's default/primary shift — used for employees with no shift assigned. */
export async function getDefault() {
  const [rows] = await pool.query(
    "SELECT * FROM shifts WHERE deleted_at IS NULL AND status = 'active' ORDER BY id LIMIT 1"
  );
  return rows[0] || null;
}

/** Update just the schedule (times + grace) of a shift — used by Company Settings. */
export async function setSchedule(id, { start_time, end_time, grace_minutes }) {
  await pool.execute(
    'UPDATE shifts SET start_time = :s, end_time = :e, grace_minutes = :g WHERE id = :id AND deleted_at IS NULL',
    { s: start_time, e: end_time, g: grace_minutes ?? 0, id }
  );
  return findById(id);
}
