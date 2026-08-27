import { pool } from '../config/db.js';

const LIST_SELECT = `
  SELECT l.id, l.employee_id, l.leave_type_id, lt.name AS leave_type_name,
         l.start_date, l.end_date, l.total_days, l.half_day, l.reason,
         l.attachment_url, l.status, l.approved_by, l.approved_at, l.remarks,
         l.created_at,
         e.employee_code, e.first_name, e.last_name, e.photo_url,
         d.department_name, u.name AS approved_by_name
  FROM leaves l
  JOIN employees e          ON e.id = l.employee_id
  LEFT JOIN leave_types lt  ON lt.id = l.leave_type_id
  LEFT JOIN departments d   ON d.id = e.department_id
  LEFT JOIN users u         ON u.id = l.approved_by
`;

function buildFilters(q) {
  const where = ['e.deleted_at IS NULL'];
  const params = {};
  if (q.employee_id) { where.push('l.employee_id = :employeeId'); params.employeeId = q.employee_id; }
  if (q.leave_type_id) { where.push('l.leave_type_id = :typeId'); params.typeId = q.leave_type_id; }
  if (q.status) { where.push('l.status = :status'); params.status = q.status; }
  if (q.department_id) { where.push('e.department_id = :deptId'); params.deptId = q.department_id; }
  if (q.from) { where.push('l.end_date >= :from'); params.from = q.from; }
  if (q.to) { where.push('l.start_date <= :to'); params.to = q.to; }
  if (q.search) {
    where.push('(e.first_name LIKE :s OR e.last_name LIKE :s OR e.employee_code LIKE :s)');
    params.s = `%${q.search}%`;
  }
  return { whereSql: `WHERE ${where.join(' AND ')}`, params };
}

/**
 * Leave days recorded DIRECTLY in attendance (status paid_leave / unpaid_leave) rather than
 * through a formal application. These drive payroll deductions, so they must be visible here
 * too — surfaced read-only (source: 'attendance') alongside formal applications.
 */
async function attendanceLeaves(q = {}) {
  // These are recorded facts (~approved). A request for any other status excludes them,
  // as does a formal-leave-type filter (they have no leave_type_id).
  if (q.status && q.status !== 'approved') return [];
  if (q.leave_type_id) return [];
  const where = ['e.deleted_at IS NULL', "a.status IN ('paid_leave','unpaid_leave')"];
  const params = {};
  if (q.employee_id) { where.push('a.employee_id = :employeeId'); params.employeeId = q.employee_id; }
  if (q.department_id) { where.push('e.department_id = :deptId'); params.deptId = q.department_id; }
  if (q.from) { where.push('a.date >= :from'); params.from = q.from; }
  if (q.to) { where.push('a.date <= :to'); params.to = q.to; }
  if (q.search) {
    where.push('(e.first_name LIKE :s OR e.last_name LIKE :s OR e.employee_code LIKE :s)');
    params.s = `%${q.search}%`;
  }
  const [rows] = await pool.query(
    `SELECT a.id, a.employee_id, a.date, a.status,
            e.employee_code, e.first_name, e.last_name, e.photo_url, d.department_name
     FROM attendance a
     JOIN employees e        ON e.id = a.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.date DESC`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    source: 'attendance',
    employee_id: r.employee_id,
    leave_type_id: null,
    leave_type_name: r.status === 'unpaid_leave' ? 'Unpaid Leave' : 'Paid Leave',
    start_date: r.date,
    end_date: r.date,
    total_days: 1,
    half_day: 0,
    reason: 'Recorded directly in attendance',
    attachment_url: null,
    status: 'approved',
    approved_by: null,
    approved_at: null,
    remarks: null,
    created_at: r.date,
    employee_code: r.employee_code,
    first_name: r.first_name,
    last_name: r.last_name,
    photo_url: r.photo_url,
    department_name: r.department_name,
    approved_by_name: null,
  }));
}

export async function list(q = {}) {
  const { whereSql, params } = buildFilters(q);
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));
  const offset = (page - 1) * limit;

  const [formal] = await pool.query(`${LIST_SELECT} ${whereSql} ORDER BY l.start_date DESC`, params);
  const formalRows = formal.map((r) => ({ ...r, source: 'leave' }));
  const attRows = await attendanceLeaves(q);

  // Merge both sources, newest first, then paginate the combined list in-app.
  const all = [...formalRows, ...attRows].sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  const total = all.length;
  const rows = all.slice(offset, offset + limit);
  return { rows, total, page, limit };
}

export async function findById(id) {
  const [rows] = await pool.query(`${LIST_SELECT} WHERE l.id = :id LIMIT 1`, { id });
  return rows[0] || null;
}

/** Detect overlapping leave for the same employee (excludes rejected/cancelled). */
export async function hasOverlap({ employeeId, startDate, endDate, exceptId = null }) {
  const [rows] = await pool.query(
    `SELECT id FROM leaves
     WHERE employee_id = :employeeId
       AND status IN ('pending','approved')
       AND NOT (end_date < :startDate OR start_date > :endDate)
       AND (:exceptId IS NULL OR id <> :exceptId)
     LIMIT 1`,
    { employeeId, startDate, endDate, exceptId }
  );
  return rows.length > 0;
}

export async function create(data, conn = pool) {
  const [res] = await conn.execute(
    `INSERT INTO leaves
       (employee_id, leave_type_id, start_date, end_date, total_days, half_day,
        reason, attachment_url, emergency_contact, status)
     VALUES
       (:employeeId, :leaveTypeId, :startDate, :endDate, :totalDays, :halfDay,
        :reason, :attachment, :emergency, 'pending')`,
    {
      employeeId: data.employee_id,
      leaveTypeId: data.leave_type_id,
      startDate: data.start_date,
      endDate: data.end_date,
      totalDays: data.total_days,
      halfDay: data.half_day ? 1 : 0,
      reason: data.reason || null,
      attachment: data.attachment_url || null,
      emergency: data.emergency_contact || null,
    }
  );
  return res.insertId;
}

export async function setStatus({ id, status, approvedBy, remarks }, conn = pool) {
  await conn.execute(
    `UPDATE leaves SET status = :status, approved_by = :approvedBy,
       approved_at = NOW(), remarks = :remarks
     WHERE id = :id`,
    { id, status, approvedBy: approvedBy || null, remarks: remarks || null }
  );
}

export async function addApproval({ leaveId, action, actorId, remarks }, conn = pool) {
  await conn.execute(
    `INSERT INTO leave_approvals (leave_id, action, actor_id, remarks)
     VALUES (:leaveId, :action, :actorId, :remarks)`,
    { leaveId, action, actorId: actorId || null, remarks: remarks || null }
  );
}

export async function approvalHistory(leaveId) {
  const [rows] = await pool.query(
    `SELECT la.id, la.action, la.remarks, la.created_at, u.name AS actor_name
     FROM leave_approvals la LEFT JOIN users u ON u.id = la.actor_id
     WHERE la.leave_id = :leaveId ORDER BY la.created_at`,
    { leaveId }
  );
  return rows;
}

/** Company-wide leave calendar between two dates (approved + pending). */
export async function calendar({ from, to }) {
  const [rows] = await pool.query(
    `SELECT l.id, l.start_date, l.end_date, l.status, lt.name AS leave_type,
            e.first_name, e.last_name, e.employee_code
     FROM leaves l
     JOIN employees e ON e.id = l.employee_id
     LEFT JOIN leave_types lt ON lt.id = l.leave_type_id
     WHERE e.deleted_at IS NULL AND l.status IN ('approved','pending')
       AND NOT (l.end_date < :from OR l.start_date > :to)
     ORDER BY l.start_date`,
    { from, to }
  );
  return rows;
}
