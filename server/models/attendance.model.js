import { pool } from '../config/db.js';

const LIST_SELECT = `
  SELECT a.id, a.employee_id, a.date, a.check_in, a.check_out,
         a.break_minutes, a.working_minutes, a.overtime_minutes,
         a.late_minutes, a.early_exit_minutes, a.status, a.remarks,
         a.shift_id, a.created_at, a.updated_at,
         e.employee_code, e.first_name, e.last_name, e.photo_url,
         d.department_name, ds.designation_name, s.shift_name
  FROM attendance a
  JOIN employees e         ON e.id = a.employee_id
  LEFT JOIN departments d  ON d.id = e.department_id
  LEFT JOIN designations ds ON ds.id = e.designation_id
  LEFT JOIN shifts s        ON s.id = a.shift_id
`;

function buildFilters(q) {
  const where = ['e.deleted_at IS NULL'];
  const params = {};
  if (q.date) { where.push('a.date = :date'); params.date = q.date; }
  if (q.from) { where.push('a.date >= :from'); params.from = q.from; }
  if (q.to) { where.push('a.date <= :to'); params.to = q.to; }
  if (q.month) { where.push('MONTH(a.date) = :month'); params.month = q.month; }
  if (q.year) { where.push('YEAR(a.date) = :year'); params.year = q.year; }
  if (q.status) { where.push('a.status = :status'); params.status = q.status; }
  if (q.employee_id) { where.push('a.employee_id = :employeeId'); params.employeeId = q.employee_id; }
  if (q.department_id) { where.push('e.department_id = :deptId'); params.deptId = q.department_id; }
  if (q.designation_id) { where.push('e.designation_id = :desigId'); params.desigId = q.designation_id; }
  if (q.shift_id) { where.push('a.shift_id = :shiftId'); params.shiftId = q.shift_id; }
  if (q.search) {
    where.push('(e.first_name LIKE :s OR e.last_name LIKE :s OR e.employee_code LIKE :s)');
    params.s = `%${q.search}%`;
  }
  return { whereSql: `WHERE ${where.join(' AND ')}`, params };
}

export async function list(q = {}) {
  const { whereSql, params } = buildFilters(q);
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 25));
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `${LIST_SELECT} ${whereSql} ORDER BY a.date DESC, e.first_name LIMIT :limit OFFSET :offset`,
    { ...params, limit, offset }
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM attendance a JOIN employees e ON e.id = a.employee_id ${whereSql}`,
    params
  );
  return { rows, total, page, limit };
}

export async function findById(id) {
  const [rows] = await pool.query(`${LIST_SELECT} WHERE a.id = :id LIMIT 1`, { id });
  return rows[0] || null;
}

export async function findByEmployeeDate(employeeId, date) {
  const [rows] = await pool.query(
    'SELECT * FROM attendance WHERE employee_id = :employeeId AND date = :date LIMIT 1',
    { employeeId, date }
  );
  return rows[0] || null;
}

/** Insert or update a single attendance record (unique per employee+date). */
export async function upsert(record, conn = pool) {
  await conn.execute(
    `INSERT INTO attendance
       (employee_id, date, status, check_in, check_out, break_minutes, working_minutes,
        overtime_minutes, late_minutes, early_exit_minutes, shift_id, remarks, created_by, updated_by)
     VALUES
       (:employee_id, :date, :status, :check_in, :check_out, :break_minutes, :working_minutes,
        :overtime_minutes, :late_minutes, :early_exit_minutes, :shift_id, :remarks, :actor, :actor)
     ON DUPLICATE KEY UPDATE
       status=VALUES(status), check_in=VALUES(check_in), check_out=VALUES(check_out),
       break_minutes=VALUES(break_minutes), working_minutes=VALUES(working_minutes),
       overtime_minutes=VALUES(overtime_minutes), late_minutes=VALUES(late_minutes),
       early_exit_minutes=VALUES(early_exit_minutes), shift_id=VALUES(shift_id),
       remarks=VALUES(remarks), updated_by=VALUES(updated_by)`,
    {
      employee_id: record.employee_id,
      date: record.date,
      status: record.status,
      check_in: record.check_in || null,
      check_out: record.check_out || null,
      break_minutes: record.break_minutes ?? 0,
      working_minutes: record.working_minutes ?? 0,
      overtime_minutes: record.overtime_minutes ?? 0,
      late_minutes: record.late_minutes ?? 0,
      early_exit_minutes: record.early_exit_minutes ?? 0,
      shift_id: record.shift_id || null,
      remarks: record.remarks || null,
      actor: record.actor || null,
    }
  );
}

/** Apply a correction to an existing record by id. */
export async function applyCorrection(id, fields, actorId) {
  await pool.execute(
    `UPDATE attendance SET
       status=:status, check_in=:check_in, check_out=:check_out, break_minutes=:break_minutes,
       working_minutes=:working_minutes, overtime_minutes=:overtime_minutes,
       late_minutes=:late_minutes, early_exit_minutes=:early_exit_minutes,
       remarks=:remarks, updated_by=:actor
     WHERE id=:id`,
    {
      id,
      status: fields.status,
      check_in: fields.check_in || null,
      check_out: fields.check_out || null,
      break_minutes: fields.break_minutes ?? 0,
      working_minutes: fields.working_minutes ?? 0,
      overtime_minutes: fields.overtime_minutes ?? 0,
      late_minutes: fields.late_minutes ?? 0,
      early_exit_minutes: fields.early_exit_minutes ?? 0,
      remarks: fields.remarks || null,
      actor: actorId || null,
    }
  );
  return findById(id);
}

export async function remove(id) {
  await pool.execute('DELETE FROM attendance WHERE id = :id', { id });
}

/** Monthly per-employee summary with attendance percentage. */
export async function monthlySummary({ employeeId, month, year, workingDays }) {
  const [[row]] = await pool.query(
    `SELECT
       SUM(status='present') AS present,
       SUM(status='absent')  AS absent,
       SUM(status='half_day') AS half_day,
       SUM(status='paid_leave')   AS paid_leave,
       SUM(status='unpaid_leave') AS unpaid_leave,
       SUM(status='wfh') AS wfh,
       SUM(late_minutes > 0) AS late_days,
       COALESCE(SUM(overtime_minutes),0) AS overtime_minutes,
       COUNT(*) AS marked
     FROM attendance
     WHERE employee_id=:employeeId AND MONTH(date)=:month AND YEAR(date)=:year`,
    { employeeId, month, year }
  );
  const present = Number(row.present) || 0;
  const half = Number(row.half_day) || 0;
  const denom = workingDays || Number(row.marked) || 0;
  const percentage = denom ? Math.round(((present + half * 0.5) / denom) * 100) : 0;
  return {
    present,
    absent: Number(row.absent) || 0,
    halfDay: half,
    paidLeave: Number(row.paid_leave) || 0,
    unpaidLeave: Number(row.unpaid_leave) || 0,
    wfh: Number(row.wfh) || 0,
    lateDays: Number(row.late_days) || 0,
    overtimeHours: Math.round(((Number(row.overtime_minutes) || 0) / 60) * 100) / 100,
    markedDays: Number(row.marked) || 0,
    workingDays: denom,
    percentage,
  };
}

// ── Analytics ──────────────────────────────────────────────

export async function dailyStatusBreakdown(date) {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM attendance WHERE date = :date GROUP BY status`,
    { date }
  );
  return rows;
}

export async function departmentAttendance(month, year) {
  const [rows] = await pool.query(
    `SELECT d.department_name AS name,
            SUM(a.status='present') AS present,
            COUNT(a.id) AS total,
            ROUND(SUM(a.status='present') / NULLIF(COUNT(a.id),0) * 100, 1) AS percentage
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE MONTH(a.date)=:month AND YEAR(a.date)=:year
     GROUP BY d.id, d.department_name`,
    { month, year }
  );
  return rows;
}

export async function trends(months = 6) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(date, '%Y-%m') AS period,
            SUM(status='present') AS present,
            SUM(status='absent')  AS absent,
            SUM(late_minutes > 0) AS late,
            ROUND(COALESCE(SUM(overtime_minutes),0)/60, 1) AS overtime_hours
     FROM attendance
     WHERE date >= DATE_SUB(CURDATE(), INTERVAL :months MONTH)
     GROUP BY period ORDER BY period`,
    { months }
  );
  return rows;
}

/** Employees with no attendance record for a given date (used for absent alerts). */
export async function employeesAbsentOn(date) {
  const [rows] = await pool.query(
    `SELECT e.id, e.first_name, e.last_name, e.employee_code
     FROM employees e
     LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = :date
     WHERE e.deleted_at IS NULL AND e.status = 'active'
       AND (a.id IS NULL OR a.status = 'absent')`,
    { date }
  );
  return rows;
}
