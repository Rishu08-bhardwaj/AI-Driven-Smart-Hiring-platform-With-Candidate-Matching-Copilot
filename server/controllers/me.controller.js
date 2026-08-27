/**
 * Employee self-service controller. Every handler resolves the employee record
 * linked to the authenticated user (employees.user_id) and scopes all data to
 * that record — an employee can never read another employee's data.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { pool } from '../config/db.js';
import * as Employee from '../models/employee.model.js';
import * as LeaveBalance from '../models/leaveBalance.model.js';
import * as LeaveType from '../models/leaveType.model.js';
import * as Advance from '../models/advance.model.js';
import * as Loan from '../models/loan.model.js';
import { persistFile } from '../services/storage.service.js';
import { streamSalarySlip } from '../services/salarySlip.service.js';
import { recordAudit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';
import * as leaveCtrl from './leave.controller.js';

// Fields an employee may edit on their own profile (spec: personal info only).
const SELF_EDITABLE = [
  'phone', 'alternate_phone',
  'current_address', 'permanent_address', 'city', 'state', 'country', 'zip_code',
  'emergency_name', 'emergency_phone', 'emergency_relation',
];

/** Resolve the employee record for the logged-in user, or 404. */
async function resolveSelf(req) {
  const emp = await Employee.findByUserId(req.user.id);
  if (!emp) {
    throw ApiError.notFound('No employee profile is linked to your account. Contact HR.');
  }
  return emp;
}

// GET /api/me/profile
export const getProfile = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);
  return sendSuccess(res, { data: emp });
});

// PUT /api/me/profile  — personal info + photo only
export const updateProfile = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);

  const data = {};
  for (const f of SELF_EDITABLE) if (req.body[f] !== undefined) data[f] = req.body[f];
  if (req.file) {
    const stored = await persistFile(req.file, 'employees');
    data.photo_url = stored.url;
  }

  const updated = await Employee.update(emp.id, data);
  await recordAudit({ req, action: 'employee.self_update', entity: 'employee', entityId: emp.id, description: 'Self-service profile update' });
  return sendSuccess(res, { message: 'Profile updated.', data: updated });
});

// GET /api/me/dashboard
export const dashboard = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);
  const year = new Date().getFullYear();

  const [[today]] = await pool.query(
    `SELECT status, check_in, check_out, working_hours
     FROM attendance WHERE employee_id = :id AND date = CURDATE() LIMIT 1`,
    { id: emp.id }
  );
  const leaveBalances = await LeaveBalance.forEmployee(emp.id, year);
  const [upcomingHolidays] = await pool.query(
    `SELECT id, name, holiday_date, holiday_type
     FROM holidays
     WHERE holiday_date >= CURDATE() AND status = 'active' AND deleted_at IS NULL
     ORDER BY holiday_date LIMIT 5`
  );
  const [[salary]] = await pool.query(
    `SELECT month, year, salary_amount, gross_amount, bonus_total, other_deductions,
            loan_recovery, advance_recovery, total_deductions, net_amount,
            paid_amount, remaining_amount, outstanding, payment_status
     FROM payroll WHERE employee_id = :id ORDER BY year DESC, month DESC LIMIT 1`,
    { id: emp.id }
  );
  const [notifications] = await pool.query(
    `SELECT id, title, description, type, is_read, created_at
     FROM notifications WHERE user_id = :uid ORDER BY created_at DESC LIMIT 5`,
    { uid: req.user.id }
  );

  return sendSuccess(res, {
    data: {
      employee: { id: emp.id, name: `${emp.first_name} ${emp.last_name || ''}`.trim(), code: emp.employee_code, photo_url: emp.photo_url, designation: emp.designation_name, department: emp.department_name },
      todayAttendance: today || null,
      leaveBalances,
      upcomingHolidays,
      salarySummary: salary || null,
      recentNotifications: notifications,
    },
    meta: { year },
  });
});

// GET /api/me/attendance?month=&year=
export const attendance = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const [rows] = await pool.query(
    `SELECT id, date, status, check_in, check_out, working_hours, remarks
     FROM attendance WHERE employee_id = :id AND MONTH(date) = :month AND YEAR(date) = :year
     ORDER BY date`,
    { id: emp.id, month, year }
  );
  const present = rows.filter((r) => r.status === 'present').length;
  const percentage = rows.length ? Math.round((present / rows.length) * 100) : 0;
  return sendSuccess(res, { data: rows, meta: { month, year, percentage } });
});

// GET /api/me/leaves
export const leaves = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);
  const [rows] = await pool.query(
    `SELECT l.id, l.leave_type, l.leave_type_id, l.start_date, l.end_date, l.total_days,
            l.reason, l.status, u.name AS approved_by_name
     FROM leaves l LEFT JOIN users u ON u.id = l.approved_by
     WHERE l.employee_id = :id ORDER BY l.start_date DESC`,
    { id: emp.id }
  );
  return sendSuccess(res, { data: rows });
});

// GET /api/me/leaves/balances?year=
export const leaveBalances = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);
  const year = Number(req.query.year) || new Date().getFullYear();
  const data = await LeaveBalance.forEmployee(emp.id, year);
  return sendSuccess(res, { data, meta: { year } });
});

// GET /api/me/leave-types  — active types for the apply form
export const leaveTypes = asyncHandler(async (req, res) => {
  await resolveSelf(req);
  const data = await LeaveType.list({ status: 'active' });
  return sendSuccess(res, { data });
});

// POST /api/me/leaves  — apply for own leave (delegates to leave controller)
export const applyLeave = asyncHandler(async (req, res, next) => {
  const emp = await resolveSelf(req);
  req.body.employee_id = emp.id; // force ownership
  return leaveCtrl.applyLeave(req, res, next);
});

// PATCH /api/me/leaves/:id/cancel  — cancel own pending leave
export const cancelLeave = asyncHandler(async (req, res, next) => {
  const emp = await resolveSelf(req);
  const [[leave]] = await pool.query('SELECT employee_id FROM leaves WHERE id = :id LIMIT 1', { id: req.params.id });
  if (!leave || leave.employee_id !== emp.id) throw ApiError.notFound('Leave request not found.');
  return leaveCtrl.cancelLeave(req, res, next);
});

// GET /api/me/salary
export const salary = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);
  const [rows] = await pool.query(
    `SELECT p.id, p.month, p.year, p.salary_amount, p.gross_amount, p.bonus_total, p.other_deductions,
            p.loan_recovery, p.advance_recovery, p.pf, p.esi, p.tax,
            p.total_deductions, p.net_amount, p.previous_pending,
            p.paid_amount, p.remaining_amount,
            (SELECT COALESCE(SUM(p2.remaining_amount), 0)
               FROM payroll p2
              WHERE p2.employee_id = p.employee_id
                AND p2.payment_status NOT IN ('paid','cancelled','refunded')
                AND (p2.year < p.year OR (p2.year = p.year AND p2.month <= p.month))) AS outstanding,
            p.payment_status, p.generated_date
     FROM payroll p WHERE p.employee_id = :id ORDER BY p.year DESC, p.month DESC`,
    { id: emp.id }
  );
  return sendSuccess(res, { data: rows });
});

// GET /api/me/salary/:id/slip  — own salary slip PDF
export const downloadSlip = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);
  const [[record]] = await pool.query('SELECT employee_id FROM payroll WHERE id = :id LIMIT 1', { id: req.params.id });
  if (!record || record.employee_id !== emp.id) throw ApiError.notFound('Salary slip not found.');
  const ok = await streamSalarySlip(req.params.id, res);
  if (!ok) throw ApiError.notFound('Salary slip not found.');
});

// GET /api/me/advances  — own salary-advance requests
export const advances = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);
  const data = await Advance.listForEmployee(emp.id);
  return sendSuccess(res, { data });
});

// POST /api/me/advances  — request a salary advance (with reason)
export const requestAdvance = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);
  const item = await Advance.create({
    employee_id: emp.id,
    amount: req.body.amount,
    request_date: new Date().toISOString().slice(0, 10),
    reason: req.body.reason,
  });
  await recordAudit({ req, action: 'advance.self_request', entity: 'salary_advance', entityId: item.id, description: `Requested ₹${item.amount} advance` });
  await notify({ title: 'Advance requested', description: `${emp.first_name} ${emp.last_name || ''} requested a ₹${item.amount} salary advance.`, type: 'payroll' });
  return sendSuccess(res, { statusCode: 201, message: 'Advance request submitted.', data: item });
});

// GET /api/me/loans  — own loan requests/loans
export const loans = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);
  const data = await Loan.listForEmployee(emp.id);
  return sendSuccess(res, { data });
});

// POST /api/me/loans  — request a loan (amount + preferred tenure + reason)
export const requestLoan = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);
  const item = await Loan.createRequest({
    employeeId: emp.id,
    amount: req.body.amount,
    tenureMonths: req.body.tenure_months,
    reason: req.body.reason,
  });
  await recordAudit({ req, action: 'loan.self_request', entity: 'employee_loan', entityId: item.id, description: `Requested ₹${item.principal} loan over ${item.tenure_months} months` });
  await notify({ title: 'Loan requested', description: `${emp.first_name} ${emp.last_name || ''} requested a ₹${item.principal} loan.`, type: 'payroll' });
  return sendSuccess(res, { statusCode: 201, message: 'Loan request submitted.', data: item });
});

// GET /api/me/documents
export const documents = asyncHandler(async (req, res) => {
  const emp = await resolveSelf(req);
  const [rows] = await pool.query(
    `SELECT id, document_name, document_type, file_url, file_size, mime_type, uploaded_at
     FROM documents WHERE employee_id = :id AND deleted_at IS NULL ORDER BY uploaded_at DESC`,
    { id: emp.id }
  );
  return sendSuccess(res, { data: rows });
});
