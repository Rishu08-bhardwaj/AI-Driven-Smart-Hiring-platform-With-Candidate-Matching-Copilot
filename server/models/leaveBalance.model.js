import { pool } from '../config/db.js';

/** All balances for an employee in a year, including remaining + type info. */
export async function forEmployee(employeeId, year) {
  const [rows] = await pool.query(
    `SELECT lb.id, lb.leave_type_id, lt.name AS leave_type, lt.code, lt.is_paid,
            lb.year, lb.allocated, lb.used,
            (lb.allocated - lb.used) AS remaining
     FROM leave_balances lb
     JOIN leave_types lt ON lt.id = lb.leave_type_id
     WHERE lb.employee_id = :employeeId AND lb.year = :year
     ORDER BY lt.name`,
    { employeeId, year }
  );
  return rows;
}

/**
 * Fetch the balance row for (employee, type, year), creating it from the
 * leave type's default allocation if it doesn't exist. Transaction-aware.
 */
export async function getOrCreate({ employeeId, leaveTypeId, year, defaultAllocated = 0 }, conn = pool) {
  const [rows] = await conn.query(
    'SELECT * FROM leave_balances WHERE employee_id=:employeeId AND leave_type_id=:leaveTypeId AND year=:year LIMIT 1',
    { employeeId, leaveTypeId, year }
  );
  if (rows.length) return rows[0];
  await conn.execute(
    `INSERT INTO leave_balances (employee_id, leave_type_id, year, allocated, used)
     VALUES (:employeeId, :leaveTypeId, :year, :allocated, 0)`,
    { employeeId, leaveTypeId, year, allocated: defaultAllocated }
  );
  const [created] = await conn.query(
    'SELECT * FROM leave_balances WHERE employee_id=:employeeId AND leave_type_id=:leaveTypeId AND year=:year LIMIT 1',
    { employeeId, leaveTypeId, year }
  );
  return created[0];
}

/** Adjust used days (positive to consume, negative to release). Transaction-aware. */
export async function adjustUsed({ employeeId, leaveTypeId, year, delta }, conn = pool) {
  await conn.execute(
    `UPDATE leave_balances SET used = GREATEST(0, used + :delta)
     WHERE employee_id=:employeeId AND leave_type_id=:leaveTypeId AND year=:year`,
    { employeeId, leaveTypeId, year, delta }
  );
}

/** Admin: set/override allocation. */
export async function setAllocation({ employeeId, leaveTypeId, year, allocated }) {
  await pool.execute(
    `INSERT INTO leave_balances (employee_id, leave_type_id, year, allocated, used)
     VALUES (:employeeId, :leaveTypeId, :year, :allocated, 0)
     ON DUPLICATE KEY UPDATE allocated = VALUES(allocated)`,
    { employeeId, leaveTypeId, year, allocated }
  );
}
