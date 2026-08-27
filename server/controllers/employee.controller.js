import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess, buildMeta } from '../utils/response.js';
import { pool } from '../config/db.js';
import * as Employee from '../models/employee.model.js';
import * as UserModel from '../models/user.model.js';
import { hashPassword, randomToken } from '../utils/password.js';
import { persistFile } from '../services/storage.service.js';
import { recordAudit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';

/** Validate uniqueness of code/email/phone; throws 409 with field details. */
async function assertUnique(data, exceptId = null) {
  const conflicts = [];
  if (data.employee_code && (await Employee.isDuplicate('employee_code', data.employee_code, exceptId))) {
    conflicts.push({ field: 'employee_code', message: 'Employee code already in use.' });
  }
  if (data.email && (await Employee.isDuplicate('email', data.email, exceptId))) {
    conflicts.push({ field: 'email', message: 'Email already in use.' });
  }
  if (data.phone && (await Employee.isDuplicate('phone', data.phone, exceptId))) {
    conflicts.push({ field: 'phone', message: 'Phone number already in use.' });
  }
  if (conflicts.length) throw ApiError.conflict('Duplicate employee details.', conflicts);
}

// GET /api/employees
export const listEmployees = asyncHandler(async (req, res) => {
  const { rows, total, page, limit } = await Employee.list(req.query);
  return sendSuccess(res, {
    data: rows,
    meta: buildMeta({ page, limit, total }),
  });
});

// GET /api/employees/next-code
export const nextCode = asyncHandler(async (req, res) => {
  const code = await Employee.generateCode();
  return sendSuccess(res, { data: { employee_code: code } });
});

// GET /api/employees/:id
export const getEmployee = asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id);
  if (!emp) throw ApiError.notFound('Employee not found.');
  return sendSuccess(res, { data: emp });
});

// POST /api/employees
export const createEmployee = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (!data.employee_code) data.employee_code = await Employee.generateCode();
  if (req.file) {
    const stored = await persistFile(req.file, 'employees');
    data.photo_url = stored.url;
  }
  await assertUnique(data);

  const emp = await Employee.create(data);
  await recordAudit({
    req, action: 'employee.create', entity: 'employee', entityId: emp.id,
    description: `Added ${emp.first_name} ${emp.last_name || ''} (${emp.employee_code})`,
  });
  await notify({ title: 'New employee added', description: `${emp.first_name} ${emp.last_name || ''} joined.`, type: 'employee' });
  return sendSuccess(res, { statusCode: 201, message: 'Employee created.', data: emp });
});

// PUT /api/employees/:id
export const updateEmployee = asyncHandler(async (req, res) => {
  const existing = await Employee.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Employee not found.');

  const data = { ...req.body };
  if (req.file) {
    const stored = await persistFile(req.file, 'employees');
    data.photo_url = stored.url;
  }
  await assertUnique(data, Number(req.params.id));

  const emp = await Employee.update(req.params.id, data);
  await recordAudit({
    req, action: 'employee.update', entity: 'employee', entityId: emp.id,
    description: `Updated ${emp.first_name} ${emp.last_name || ''}`,
  });
  return sendSuccess(res, { message: 'Employee updated.', data: emp });
});

// DELETE /api/employees/:id  (?archive=true to bypass salary-record guard)
export const deleteEmployee = asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id);
  if (!emp) throw ApiError.notFound('Employee not found.');

  const hasSalary = await Employee.hasSalaryRecords(req.params.id);
  if (hasSalary && req.query.archive !== 'true') {
    throw ApiError.conflict(
      'This employee has salary records. Pass ?archive=true to archive instead of delete.'
    );
  }

  await Employee.softDelete(req.params.id);
  // Auto-void this employee's still-unpaid payrolls so they don't linger as orphans
  // in the analytics (paid payrolls are kept as historical financial records).
  const [voided] = await pool.query(
    `UPDATE payroll SET payment_status = 'cancelled', remaining_amount = 0
     WHERE employee_id = :id AND paid_amount = 0
       AND payment_status NOT IN ('paid','cancelled','refunded')`,
    { id: emp.id }
  );
  await recordAudit({
    req, action: 'employee.delete', entity: 'employee', entityId: emp.id,
    description: `Removed ${emp.first_name} ${emp.last_name || ''} (${emp.employee_code})${voided.affectedRows ? ` · voided ${voided.affectedRows} unpaid payroll(s)` : ''}`,
  });
  await notify({ title: 'Employee removed', description: `${emp.first_name} ${emp.last_name || ''} was removed.`, type: 'employee' });
  return sendSuccess(res, { message: hasSalary ? 'Employee archived.' : 'Employee deleted.' });
});

// PATCH /api/employees/:id/status
export const changeStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const existing = await Employee.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Employee not found.');
  const emp = await Employee.setStatus(req.params.id, status);
  await recordAudit({ req, action: 'employee.status_change', entity: 'employee', entityId: emp.id, description: `Status → ${status}` });
  return sendSuccess(res, { message: 'Status updated.', data: emp });
});

// POST /api/employees/bulk
export const bulkAction = asyncHandler(async (req, res) => {
  const { action, ids = [], departmentId, designationId, status } = req.body;
  if (!Array.isArray(ids) || !ids.length) throw ApiError.badRequest('No employees selected.');

  let affected = 0;
  switch (action) {
    case 'activate':
      affected = await Employee.bulkSetStatus(ids, 'active');
      break;
    case 'deactivate':
      affected = await Employee.bulkSetStatus(ids, 'inactive');
      break;
    case 'delete':
      affected = await Employee.bulkSoftDelete(ids);
      break;
    case 'assign_department':
      affected = await Employee.bulkAssignDepartment(ids, departmentId);
      break;
    case 'assign_designation':
      affected = await Employee.bulkAssignDesignation(ids, designationId);
      break;
    case 'set_status':
      if (!status) throw ApiError.badRequest('Status is required.');
      affected = await Employee.bulkSetStatus(ids, status);
      break;
    default:
      throw ApiError.badRequest(`Unknown bulk action: ${action}`);
  }

  await recordAudit({ req, action: `employee.bulk_${action}`, entity: 'employee', description: `${affected} record(s)` });
  return sendSuccess(res, { message: `Bulk action applied to ${affected} employee(s).`, data: { affected } });
});

// ── Self-service login account ─────────────────────────────

// POST /api/employees/:id/account  — provision a portal login for this employee
export const createAccount = asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id);
  if (!emp) throw ApiError.notFound('Employee not found.');
  if (emp.user_id) throw ApiError.badRequest('This employee already has a login account.');
  if (!emp.email) {
    throw ApiError.badRequest('Add an email to the employee before creating a login account.');
  }
  const existing = await UserModel.findByEmail(emp.email);
  if (existing) {
    throw ApiError.conflict('A user account with this email already exists.', [
      { field: 'email', message: 'Email already in use by another account.' },
    ]);
  }

  // Admin/HR sets the password, or we generate a temporary one to share.
  const generated = !req.body.password;
  const password = req.body.password || `Emp@${randomToken(3)}`; // 10 chars, mixed
  const hash = await hashPassword(password);
  const user = await UserModel.create({
    name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
    email: emp.email,
    password: hash,
    role: 'employee',
    status: 'active',
  });
  await Employee.setUserId(emp.id, user.id);

  await recordAudit({ req, action: 'employee.account_create', entity: 'employee', entityId: emp.id, description: `Portal login created for ${emp.email}` });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Login account created.',
    data: { email: emp.email, tempPassword: generated ? password : undefined, user },
  });
});

// DELETE /api/employees/:id/account  — revoke the portal login
export const revokeAccount = asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id);
  if (!emp) throw ApiError.notFound('Employee not found.');
  if (!emp.user_id) throw ApiError.badRequest('This employee has no login account.');

  await UserModel.softDelete(emp.user_id); // FK ON DELETE SET NULL also clears the link
  await Employee.setUserId(emp.id, null);
  await recordAudit({ req, action: 'employee.account_revoke', entity: 'employee', entityId: emp.id, description: `Portal login revoked for ${emp.email}` });
  return sendSuccess(res, { message: 'Login account revoked.' });
});

// ── Profile sub-resources ──────────────────────────────────

// GET /api/employees/:id/salary-history
export const salaryHistory = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, month, year, salary_amount, gross_amount, net_amount,
            paid_amount, remaining_amount, outstanding, payment_status, generated_date
     FROM payroll WHERE employee_id = :id ORDER BY year DESC, month DESC`,
    { id: req.params.id }
  );
  return sendSuccess(res, { data: rows });
});

// GET /api/employees/:id/attendance?month=&year=
export const attendance = asyncHandler(async (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const [rows] = await pool.query(
    `SELECT id, date, status, check_in, check_out, working_hours, remarks
     FROM attendance
     WHERE employee_id = :id AND MONTH(date) = :month AND YEAR(date) = :year
     ORDER BY date`,
    { id: req.params.id, month, year }
  );
  const present = rows.filter((r) => r.status === 'present').length;
  const percentage = rows.length ? Math.round((present / rows.length) * 100) : 0;
  return sendSuccess(res, { data: rows, meta: { month, year, percentage } });
});

// GET /api/employees/:id/leaves
export const leaveHistory = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason,
            l.status, u.name AS approved_by_name
     FROM leaves l LEFT JOIN users u ON u.id = l.approved_by
     WHERE l.employee_id = :id ORDER BY l.start_date DESC`,
    { id: req.params.id }
  );
  return sendSuccess(res, { data: rows });
});

// GET /api/employees/:id/documents
export const documents = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, document_name, document_type, file_url, file_size, mime_type, uploaded_at
     FROM documents WHERE employee_id = :id AND deleted_at IS NULL ORDER BY uploaded_at DESC`,
    { id: req.params.id }
  );
  return sendSuccess(res, { data: rows });
});

// GET /api/employees/:id/timeline
export const timeline = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, action, description, created_at, user_id
     FROM audit_logs
     WHERE entity = 'employee' AND entity_id = :id
     ORDER BY created_at DESC LIMIT 100`,
    { id: req.params.id }
  );
  return sendSuccess(res, { data: rows });
});
