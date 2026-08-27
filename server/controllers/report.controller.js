import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { pool } from '../config/db.js';

// GET /api/reports/headcount
export const headcount = asyncHandler(async (req, res) => {
  const [[totals]] = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(status='active') AS active,
            SUM(status NOT IN ('active')) AS inactive
     FROM employees WHERE deleted_at IS NULL`
  );
  const [byDepartment] = await pool.query(
    `SELECT COALESCE(d.department_name,'Unassigned') AS name, COUNT(*) AS count
     FROM employees e LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.deleted_at IS NULL GROUP BY d.id, d.department_name ORDER BY count DESC`
  );
  const [byDesignation] = await pool.query(
    `SELECT COALESCE(ds.designation_name,'Unassigned') AS name, COUNT(*) AS count
     FROM employees e LEFT JOIN designations ds ON ds.id = e.designation_id
     WHERE e.deleted_at IS NULL GROUP BY ds.id, ds.designation_name ORDER BY count DESC`
  );
  const [byType] = await pool.query(
    `SELECT employment_type AS name, COUNT(*) AS count
     FROM employees WHERE deleted_at IS NULL GROUP BY employment_type ORDER BY count DESC`
  );
  const [byStatus] = await pool.query(
    `SELECT status AS name, COUNT(*) AS count
     FROM employees WHERE deleted_at IS NULL GROUP BY status ORDER BY count DESC`
  );
  return sendSuccess(res, {
    data: {
      totals: { total: Number(totals.total) || 0, active: Number(totals.active) || 0, inactive: Number(totals.inactive) || 0 },
      byDepartment, byDesignation, byType, byStatus,
    },
  });
});

// GET /api/reports/attendance?month=&year=
export const attendance = asyncHandler(async (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const [byStatus] = await pool.query(
    `SELECT status AS name, COUNT(*) AS count
     FROM attendance WHERE MONTH(date) = :month AND YEAR(date) = :year
     GROUP BY status ORDER BY count DESC`,
    { month, year }
  );
  const [byDepartment] = await pool.query(
    `SELECT COALESCE(d.department_name,'Unassigned') AS name,
            SUM(a.status='present') AS present,
            SUM(a.status='absent')  AS absent,
            COUNT(*) AS total
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE MONTH(a.date) = :month AND YEAR(a.date) = :year
     GROUP BY d.id, d.department_name ORDER BY total DESC`,
    { month, year }
  );
  return sendSuccess(res, { data: { byStatus, byDepartment }, meta: { month, year } });
});

// GET /api/reports/payroll?month=&year=
export const payroll = asyncHandler(async (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const [[totals]] = await pool.query(
    `SELECT COUNT(*) AS payrolls,
            COALESCE(SUM(gross_amount),0) AS gross,
            COALESCE(SUM(net_amount),0) AS net,
            COALESCE(SUM(paid_amount),0) AS paid,
            COALESCE(SUM(remaining_amount),0) AS pending,
            COALESCE(SUM(total_deductions),0) AS deductions,
            COALESCE(SUM(bonus_total),0) AS bonus
     FROM payroll WHERE month = :month AND year = :year`,
    { month, year }
  );
  const [byDepartment] = await pool.query(
    `SELECT COALESCE(d.department_name,'Unassigned') AS name,
            COALESCE(SUM(p.net_amount),0) AS amount, COUNT(*) AS employees
     FROM payroll p
     JOIN employees e ON e.id = p.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE p.month = :month AND p.year = :year
     GROUP BY d.id, d.department_name ORDER BY amount DESC`,
    { month, year }
  );
  return sendSuccess(res, {
    data: {
      totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Number(v) || 0])),
      byDepartment,
    },
    meta: { month, year },
  });
});

// GET /api/reports/leave?year=
export const leave = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const [byType] = await pool.query(
    `SELECT COALESCE(lt.name, l.leave_type) AS name,
            COUNT(*) AS requests, COALESCE(SUM(l.total_days),0) AS days
     FROM leaves l LEFT JOIN leave_types lt ON lt.id = l.leave_type_id
     WHERE YEAR(l.start_date) = :year
     GROUP BY name ORDER BY days DESC`,
    { year }
  );
  const [byStatus] = await pool.query(
    `SELECT status AS name, COUNT(*) AS count
     FROM leaves WHERE YEAR(start_date) = :year GROUP BY status`,
    { year }
  );
  return sendSuccess(res, { data: { byType, byStatus }, meta: { year } });
});
