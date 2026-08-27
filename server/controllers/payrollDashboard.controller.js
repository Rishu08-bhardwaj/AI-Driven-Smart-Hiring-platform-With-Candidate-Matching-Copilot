import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { pool } from '../config/db.js';
import { streamSalarySlip } from '../services/salarySlip.service.js';
import { ApiError } from '../utils/ApiError.js';

// GET /api/payroll/dashboard?month=&year=
export const payrollDashboard = asyncHandler(async (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();

  const [[kpi]] = await pool.query(
    `SELECT
       COUNT(*) AS payrolls,
       COALESCE(SUM(p.net_amount),0)        AS total_payroll,
       COALESCE(SUM(p.paid_amount),0)       AS paid,
       COALESCE(SUM(p.remaining_amount),0)  AS pending,
       COALESCE(SUM(p.bonus_total),0)       AS bonus,
       COALESCE(SUM(p.total_deductions),0)  AS deductions,
       COALESCE(SUM(p.overtime_amount),0)   AS overtime,
       SUM(p.payment_status='paid')         AS emp_paid,
       SUM(p.payment_status='pending')      AS emp_pending,
       SUM(p.payment_status='partial')      AS emp_partial
     FROM payroll p JOIN employees e ON e.id = p.employee_id
     WHERE e.deleted_at IS NULL AND p.month = :month AND p.year = :year`,
    { month, year }
  );
  const [[adv]] = await pool.query(`SELECT COALESCE(SUM(amount - recovered),0) AS total FROM salary_advances WHERE status='approved'`);
  const [[advPaid]] = await pool.query(
    `SELECT COALESCE(SUM(paid_amount),0) AS total, COUNT(*) AS cnt
     FROM salary_advances WHERE status='paid' AND MONTH(paid_at)=:month AND YEAR(paid_at)=:year`,
    { month, year }
  );
  // Outstanding = everything still unpaid AS OF the selected month (this month + any
  // earlier arrears), so it stays consistent with the month you're viewing instead of
  // mixing in future months' unpaid payrolls.
  const [[out]] = await pool.query(
    `SELECT COALESCE(SUM(p.remaining_amount),0) AS total
     FROM payroll p JOIN employees e ON e.id = p.employee_id
     WHERE e.deleted_at IS NULL AND p.payment_status NOT IN ('paid','cancelled','refunded')
       AND (p.year < :year OR (p.year = :year AND p.month <= :month))`,
    { month, year }
  );

  const [byDept] = await pool.query(
    `SELECT d.department_name AS name, COALESCE(SUM(p.net_amount),0) AS amount
     FROM payroll p JOIN employees e ON e.id = p.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.deleted_at IS NULL AND p.month = :month AND p.year = :year
     GROUP BY d.id, d.department_name ORDER BY amount DESC`,
    { month, year }
  );
  const [trends] = await pool.query(
    `SELECT CONCAT(p.year,'-',LPAD(p.month,2,'0')) AS period,
            COALESCE(SUM(p.net_amount),0) AS net,
            COALESCE(SUM(p.paid_amount),0) AS paid
     FROM payroll p JOIN employees e ON e.id = p.employee_id
     WHERE e.deleted_at IS NULL
       AND STR_TO_DATE(CONCAT(p.year,'-',p.month,'-01'),'%Y-%m-%d') >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
     GROUP BY p.year, p.month ORDER BY p.year, p.month`
  );
  const [statusBreakdown] = await pool.query(
    `SELECT p.payment_status AS status, COUNT(*) AS count, COALESCE(SUM(p.net_amount),0) AS amount
     FROM payroll p JOIN employees e ON e.id = p.employee_id
     WHERE e.deleted_at IS NULL AND p.month=:month AND p.year=:year GROUP BY p.payment_status`,
    { month, year }
  );

  const netPayroll = Number(kpi.total_payroll) || 0;
  return sendSuccess(res, {
    data: {
      kpis: {
        payrolls: Number(kpi.payrolls) || 0,
        totalPayroll: netPayroll,
        paidSalary: Number(kpi.paid) || 0,
        pendingSalary: Number(kpi.pending) || 0,
        employeesPaid: Number(kpi.emp_paid) || 0,
        employeesPending: Number(kpi.emp_pending) || 0,
        employeesPartiallyPaid: Number(kpi.emp_partial) || 0,
        totalAdvances: Number(adv.total) || 0,
        totalAdvancesPaid: Number(advPaid.total) || 0,
        advancesPaidCount: Number(advPaid.cnt) || 0,
        totalBonus: Number(kpi.bonus) || 0,
        totalDeductions: Number(kpi.deductions) || 0,
        totalOvertime: Number(kpi.overtime) || 0,
        netPayroll,
        totalOutstanding: Number(out.total) || 0,
      },
      departmentPayroll: byDept,
      payrollTrends: trends,
      statusBreakdown,
    },
    meta: { month, year },
  });
});

// GET /api/payroll/:id/slip  — PDF
export const downloadSlip = asyncHandler(async (req, res) => {
  const ok = await streamSalarySlip(req.params.id, res);
  if (!ok) throw ApiError.notFound('Payroll record not found.');
});
