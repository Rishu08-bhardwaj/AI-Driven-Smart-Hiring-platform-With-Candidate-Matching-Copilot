import { pool } from '../config/db.js';

// Columns the API is allowed to write (whitelist guards against mass-assignment).
const WRITABLE = [
  'employee_code', 'first_name', 'middle_name', 'last_name', 'photo_url',
  'gender', 'dob', 'blood_group', 'marital_status', 'nationality',
  'phone', 'alternate_phone', 'email', 'emergency_name', 'emergency_phone', 'emergency_relation',
  'current_address', 'permanent_address', 'city', 'state', 'country', 'zip_code',
  'joining_date', 'department_id', 'designation_id', 'manager_id', 'work_location', 'shift',
  'employment_type', 'probation_period', 'status',
  'salary', 'salary_type', 'salary_cycle', 'bank_name', 'account_holder_name',
  'account_number', 'ifsc', 'branch', 'upi_id',
  'aadhaar_number', 'pan_number', 'passport_number', 'driving_license',
  'esi_number', 'pf_number', 'tax_number', 'internal_notes',
];

const SAFE_SORT = {
  newest: 'e.created_at DESC',
  oldest: 'e.created_at ASC',
  salary_high: 'e.salary DESC',
  salary_low: 'e.salary ASC',
  name: 'e.first_name ASC, e.last_name ASC',
  joining: 'e.joining_date DESC',
  department: 'department_name ASC',
};

const LIST_SELECT = `
  SELECT e.id, e.employee_code, e.first_name, e.middle_name, e.last_name, e.photo_url,
         e.email, e.phone, e.gender, e.joining_date, e.employment_type, e.status,
         e.salary, e.salary_type, e.department_id, e.designation_id, e.work_location,
         d.department_name, ds.designation_name,
         CONCAT_WS(' ', m.first_name, m.last_name) AS manager_name
  FROM employees e
  LEFT JOIN departments  d  ON d.id  = e.department_id
  LEFT JOIN designations ds ON ds.id = e.designation_id
  LEFT JOIN employees    m  ON m.id  = e.manager_id
`;

/** Build the WHERE clause + params shared by list() and count(). */
function buildFilters(q) {
  const where = ['e.deleted_at IS NULL'];
  const params = {};

  if (q.search) {
    where.push(`(
      e.first_name LIKE :s OR e.last_name LIKE :s OR e.email LIKE :s OR
      e.phone LIKE :s OR e.employee_code LIKE :s
    )`);
    params.s = `%${q.search}%`;
  }
  if (q.status) { where.push('e.status = :status'); params.status = q.status; }
  if (q.department_id) { where.push('e.department_id = :deptId'); params.deptId = q.department_id; }
  if (q.designation_id) { where.push('e.designation_id = :desigId'); params.desigId = q.designation_id; }
  if (q.employment_type) { where.push('e.employment_type = :etype'); params.etype = q.employment_type; }
  if (q.gender) { where.push('e.gender = :gender'); params.gender = q.gender; }
  if (q.blood_group) { where.push('e.blood_group = :bg'); params.bg = q.blood_group; }
  if (q.work_location) { where.push('e.work_location = :wl'); params.wl = q.work_location; }
  if (q.manager_id) { where.push('e.manager_id = :mgr'); params.mgr = q.manager_id; }
  if (q.salary_min != null && q.salary_min !== '') { where.push('e.salary >= :smin'); params.smin = q.salary_min; }
  if (q.salary_max != null && q.salary_max !== '') { where.push('e.salary <= :smax'); params.smax = q.salary_max; }
  if (q.joined_from) { where.push('e.joining_date >= :jfrom'); params.jfrom = q.joined_from; }
  if (q.joined_to) { where.push('e.joining_date <= :jto'); params.jto = q.joined_to; }

  return { whereSql: `WHERE ${where.join(' AND ')}`, params };
}

/** Paginated, filtered, sorted employee list. */
export async function list(q = {}) {
  const { whereSql, params } = buildFilters(q);
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 10));
  const offset = (page - 1) * limit;
  const orderBy = SAFE_SORT[q.sort] || SAFE_SORT.newest;

  const [rows] = await pool.query(
    `${LIST_SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT :limit OFFSET :offset`,
    { ...params, limit, offset }
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM employees e ${whereSql}`,
    params
  );
  return { rows, total, page, limit };
}

/** Full employee record with joined relation names. */
export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT e.*, d.department_name, ds.designation_name,
            CONCAT_WS(' ', m.first_name, m.last_name) AS manager_name
     FROM employees e
     LEFT JOIN departments  d  ON d.id  = e.department_id
     LEFT JOIN designations ds ON ds.id = e.designation_id
     LEFT JOIN employees    m  ON m.id  = e.manager_id
     WHERE e.id = :id AND e.deleted_at IS NULL
     LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}

/** Full employee record for the given login account (self-service). */
export async function findByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT e.*, d.department_name, ds.designation_name,
            CONCAT_WS(' ', m.first_name, m.last_name) AS manager_name
     FROM employees e
     LEFT JOIN departments  d  ON d.id  = e.department_id
     LEFT JOIN designations ds ON ds.id = e.designation_id
     LEFT JOIN employees    m  ON m.id  = e.manager_id
     WHERE e.user_id = :userId AND e.deleted_at IS NULL
     LIMIT 1`,
    { userId }
  );
  return rows[0] || null;
}

/** Find the employee currently linked to a login account (ignores soft-delete). */
export async function findByUserIdRaw(userId) {
  const [rows] = await pool.query('SELECT id FROM employees WHERE user_id = :userId LIMIT 1', { userId });
  return rows[0] || null;
}

/** Link / unlink an employee record to a login account. */
export async function setUserId(id, userId) {
  await pool.execute('UPDATE employees SET user_id = :userId WHERE id = :id', { id, userId: userId || null });
  return findById(id);
}

/** Pick only writable columns from an input object. */
function pickWritable(data) {
  const out = {};
  for (const key of WRITABLE) {
    if (data[key] !== undefined) out[key] = data[key] === '' ? null : data[key];
  }
  return out;
}

export async function create(data) {
  const fields = pickWritable(data);
  const cols = Object.keys(fields);
  const placeholders = cols.map((c) => `:${c}`).join(', ');
  const [res] = await pool.execute(
    `INSERT INTO employees (${cols.join(', ')}) VALUES (${placeholders})`,
    fields
  );
  return findById(res.insertId);
}

export async function update(id, data) {
  const fields = pickWritable(data);
  delete fields.employee_code; // immutable after creation
  const assignments = Object.keys(fields).map((c) => `${c} = :${c}`).join(', ');
  if (assignments) {
    await pool.execute(
      `UPDATE employees SET ${assignments} WHERE id = :id AND deleted_at IS NULL`,
      { ...fields, id }
    );
  }
  return findById(id);
}

export async function softDelete(id) {
  await pool.execute(
    `UPDATE employees SET deleted_at = NOW(), status = 'inactive' WHERE id = :id`,
    { id }
  );
}

export async function setStatus(id, status) {
  await pool.execute(
    'UPDATE employees SET status = :status WHERE id = :id AND deleted_at IS NULL',
    { id, status }
  );
  return findById(id);
}

/** Bulk status update for selected ids. */
export async function bulkSetStatus(ids, status) {
  if (!ids.length) return 0;
  const [res] = await pool.query(
    'UPDATE employees SET status = :status WHERE id IN (:ids) AND deleted_at IS NULL',
    { status, ids }
  );
  return res.affectedRows;
}

export async function bulkSoftDelete(ids) {
  if (!ids.length) return 0;
  const [res] = await pool.query(
    `UPDATE employees SET deleted_at = NOW(), status = 'inactive' WHERE id IN (:ids) AND deleted_at IS NULL`,
    { ids }
  );
  return res.affectedRows;
}

export async function bulkAssignDepartment(ids, departmentId) {
  if (!ids.length) return 0;
  const [res] = await pool.query(
    'UPDATE employees SET department_id = :departmentId WHERE id IN (:ids) AND deleted_at IS NULL',
    { departmentId: departmentId || null, ids }
  );
  return res.affectedRows;
}

export async function bulkAssignDesignation(ids, designationId) {
  if (!ids.length) return 0;
  const [res] = await pool.query(
    'UPDATE employees SET designation_id = :designationId WHERE id IN (:ids) AND deleted_at IS NULL',
    { designationId: designationId || null, ids }
  );
  return res.affectedRows;
}

// ── Uniqueness checks ──────────────────────────────────────

/** True if a field value is already used by another (non-deleted) employee. */
export async function isDuplicate(field, value, exceptId = null) {
  if (!['email', 'phone', 'employee_code'].includes(field)) return false;
  if (value == null || value === '') return false;
  const [rows] = await pool.query(
    `SELECT id FROM employees
     WHERE ${field} = :value AND deleted_at IS NULL AND (:exceptId IS NULL OR id <> :exceptId)
     LIMIT 1`,
    { value, exceptId }
  );
  return rows.length > 0;
}

/** Generate the next sequential employee code, e.g. EMP0001. */
export async function generateCode(prefix = 'EMP') {
  const [rows] = await pool.query(
    `SELECT employee_code FROM employees
     WHERE employee_code REGEXP :re
     ORDER BY CAST(REGEXP_REPLACE(employee_code, '[^0-9]', '') AS UNSIGNED) DESC
     LIMIT 1`,
    { re: `^${prefix}[0-9]+$` }
  );
  let next = 1;
  if (rows.length) {
    const digits = rows[0].employee_code.replace(/[^0-9]/g, '');
    next = (parseInt(digits, 10) || 0) + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}

/** Does the employee have salary records (blocks hard delete per spec)? */
export async function hasSalaryRecords(id) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS c FROM payroll WHERE employee_id = :id',
    { id }
  );
  return rows[0].c > 0;
}
