import { pool } from '../config/db.js';

/** Single-row scalar helper. */
async function scalar(sql, params = {}, key = 'v') {
  const [rows] = await pool.query(sql, params);
  return Number(rows[0]?.[key] ?? 0);
}

/** Employee-related headline counts. */
export async function employeeStats() {
  const [[row]] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      SUM(status = 'active')    AS active,
      SUM(status = 'inactive')  AS inactive,
      SUM(status = 'on_leave')  AS on_leave,
      SUM(YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())) AS new_this_month,
      SUM(DATE(created_at) = CURDATE()) AS joined_today
    FROM employees WHERE deleted_at IS NULL
  `);
  return {
    total: Number(row.total) || 0,
    active: Number(row.active) || 0,
    inactive: Number(row.inactive) || 0,
    onLeave: Number(row.on_leave) || 0,
    newThisMonth: Number(row.new_this_month) || 0,
    joinedToday: Number(row.joined_today) || 0,
  };
}

/** Salary / payroll headline figures for the current month. */
export async function salaryStats() {
  const [[row]] = await pool.query(`
    SELECT
      COALESCE(SUM(p.salary_amount), 0)    AS total_payroll,
      COALESCE(SUM(p.paid_amount), 0)      AS paid,
      COALESCE(SUM(p.remaining_amount), 0) AS pending,
      SUM(p.payment_status = 'pending')    AS emp_pending,
      SUM(p.payment_status = 'partial')    AS emp_partial
    FROM payroll p JOIN employees e ON e.id = p.employee_id
    WHERE e.deleted_at IS NULL AND p.month = MONTH(CURDATE()) AND p.year = YEAR(CURDATE())
  `);
  const totalOutstanding = await scalar(
    `SELECT COALESCE(SUM(p.remaining_amount),0) AS v
     FROM payroll p JOIN employees e ON e.id = p.employee_id
     WHERE e.deleted_at IS NULL AND p.payment_status NOT IN ('paid','cancelled','refunded')`
  );
  return {
    totalMonthlyPayroll: Number(row.total_payroll) || 0,
    paidThisMonth: Number(row.paid) || 0,
    pendingThisMonth: Number(row.pending) || 0,
    employeesPending: Number(row.emp_pending) || 0,
    employeesPartiallyPaid: Number(row.emp_partial) || 0,
    totalOutstanding,
  };
}

/** Today's attendance breakdown + percentage. */
export async function attendanceStats() {
  const [[row]] = await pool.query(`
    SELECT
      SUM(status = 'present')  AS present,
      SUM(status = 'absent')   AS absent,
      SUM(status = 'half_day') AS half_day,
      SUM(status = 'leave')    AS on_leave,
      COUNT(*)                 AS marked
    FROM attendance WHERE date = CURDATE()
  `);
  const present = Number(row.present) || 0;
  const marked = Number(row.marked) || 0;
  return {
    present,
    absent: Number(row.absent) || 0,
    halfDay: Number(row.half_day) || 0,
    leave: Number(row.on_leave) || 0,
    percentage: marked ? Math.round((present / marked) * 100) : 0,
  };
}

/** Company-wide totals. */
export async function companyStats() {
  const departments = await scalar(
    `SELECT COUNT(*) AS v FROM departments WHERE deleted_at IS NULL`
  );
  const designations = await scalar(
    `SELECT COUNT(*) AS v FROM designations WHERE deleted_at IS NULL`
  );
  const documents = await scalar(
    `SELECT COUNT(*) AS v FROM documents WHERE deleted_at IS NULL`
  );
  const pendingLeaves = await scalar(
    `SELECT COUNT(*) AS v FROM leaves WHERE status = 'pending'`
  );
  return { departments, designations, documents, pendingLeaves };
}

/** Last N months of payroll totals for the bar chart. */
export async function monthlySalaryExpense(months = 6) {
  const [rows] = await pool.query(
    `SELECT CONCAT(p.year, '-', LPAD(p.month, 2, '0')) AS period,
            COALESCE(SUM(p.salary_amount), 0) AS amount
     FROM payroll p JOIN employees e ON e.id = p.employee_id
     WHERE e.deleted_at IS NULL
       AND STR_TO_DATE(CONCAT(p.year,'-',p.month,'-01'), '%Y-%m-%d') >= DATE_SUB(CURDATE(), INTERVAL :months MONTH)
     GROUP BY p.year, p.month
     ORDER BY p.year, p.month`,
    { months }
  );
  return rows;
}

/** Employees joined per month (line chart). */
export async function employeeGrowth(months = 6) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(joining_date, '%Y-%m') AS period, COUNT(*) AS count
     FROM employees
     WHERE deleted_at IS NULL AND joining_date >= DATE_SUB(CURDATE(), INTERVAL :months MONTH)
     GROUP BY period ORDER BY period`,
    { months }
  );
  return rows;
}

/** Salary paid vs pending vs partial (pie chart). */
export async function salaryStatusBreakdown() {
  const [rows] = await pool.query(
    `SELECT p.payment_status, COUNT(*) AS count, COALESCE(SUM(p.salary_amount),0) AS amount
     FROM payroll p JOIN employees e ON e.id = p.employee_id
     WHERE e.deleted_at IS NULL AND p.month = MONTH(CURDATE()) AND p.year = YEAR(CURDATE())
     GROUP BY p.payment_status`
  );
  return rows;
}

/** Employees per department (horizontal bar). */
export async function departmentDistribution() {
  const [rows] = await pool.query(
    `SELECT d.department_name AS name, COUNT(e.id) AS count
     FROM departments d
     LEFT JOIN employees e ON e.department_id = d.id AND e.deleted_at IS NULL
     WHERE d.deleted_at IS NULL
     GROUP BY d.id, d.department_name
     ORDER BY count DESC`
  );
  return rows;
}

// ── Widgets ────────────────────────────────────────────────

export async function recentEmployees(limit = 5) {
  const [rows] = await pool.query(
    `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.photo_url,
            e.joining_date, d.department_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.deleted_at IS NULL
     ORDER BY e.created_at DESC LIMIT :limit`,
    { limit }
  );
  return rows;
}

export async function latestPayments(limit = 5) {
  const [rows] = await pool.query(
    `SELECT sp.id, sp.amount, sp.payment_date, sp.payment_method,
            e.first_name, e.last_name, e.employee_code
     FROM salary_payments sp
     JOIN payroll s   ON s.id = sp.salary_id
     JOIN employees e ON e.id = s.employee_id
     ORDER BY sp.created_at DESC LIMIT :limit`,
    { limit }
  );
  return rows;
}

export async function upcomingBirthdays(limit = 5) {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, photo_url, dob,
            DATE_FORMAT(dob, '%m-%d') AS md
     FROM employees
     WHERE deleted_at IS NULL AND dob IS NOT NULL
       AND DAYOFYEAR(dob) BETWEEN DAYOFYEAR(CURDATE()) AND DAYOFYEAR(CURDATE()) + 30
     ORDER BY DAYOFYEAR(dob) LIMIT :limit`,
    { limit }
  );
  return rows;
}

export async function workAnniversaries(limit = 5) {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, photo_url, joining_date,
            TIMESTAMPDIFF(YEAR, joining_date, CURDATE()) AS years
     FROM employees
     WHERE deleted_at IS NULL AND joining_date IS NOT NULL
       AND DAYOFYEAR(joining_date) BETWEEN DAYOFYEAR(CURDATE()) AND DAYOFYEAR(CURDATE()) + 30
     ORDER BY DAYOFYEAR(joining_date) LIMIT :limit`,
    { limit }
  );
  return rows;
}

export async function recentLeaves(limit = 5) {
  const [rows] = await pool.query(
    `SELECT l.id, l.leave_type, l.start_date, l.end_date, l.status,
            e.first_name, e.last_name
     FROM leaves l
     JOIN employees e ON e.id = l.employee_id
     ORDER BY l.created_at DESC LIMIT :limit`,
    { limit }
  );
  return rows;
}

export async function pendingSalaryAlerts(limit = 5) {
  const [rows] = await pool.query(
    `SELECT s.id, s.month, s.year, s.remaining_amount, s.payment_status,
            e.first_name, e.last_name, e.employee_code
     FROM payroll s
     JOIN employees e ON e.id = s.employee_id
     WHERE e.deleted_at IS NULL AND s.payment_status NOT IN ('paid','cancelled','refunded')
     ORDER BY s.year DESC, s.month DESC LIMIT :limit`,
    { limit }
  );
  return rows;
}

export async function recentActivity(limit = 8) {
  const [rows] = await pool.query(
    `SELECT a.id, a.action, a.entity, a.description, a.created_at, u.name AS user_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC LIMIT :limit`,
    { limit }
  );
  return rows;
}
