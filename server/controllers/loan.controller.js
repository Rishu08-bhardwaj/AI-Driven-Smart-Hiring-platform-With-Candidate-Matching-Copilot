import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { withTransaction } from '../config/db.js';
import * as Loan from '../models/loan.model.js';
import * as Employee from '../models/employee.model.js';
import * as SalaryProfile from '../models/salaryProfile.model.js';
import { recordAudit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';

// GET /api/loans
export const listLoans = asyncHandler(async (req, res) => {
  const data = await Loan.list({ employee_id: req.query.employee_id, status: req.query.status });
  return sendSuccess(res, { data });
});

// GET /api/loans/:id
export const getLoan = asyncHandler(async (req, res) => {
  const item = await Loan.findById(req.params.id);
  if (!item) throw ApiError.notFound('Loan not found.');
  return sendSuccess(res, { data: item });
});

// POST /api/loans
export const createLoan = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.body.employee_id);
  if (!employee) throw ApiError.notFound('Employee not found.');
  const profile = await SalaryProfile.getByEmployee(employee.id);
  if (profile && !profile.loan_eligible) {
    throw ApiError.badRequest('This employee is not eligible for loans. Enable “Loan” in their salary structure first.');
  }
  const item = await Loan.create(req.body, req.user.id);
  // A directly-created loan is active immediately — reflect its EMI in any pending payroll now.
  await withTransaction((conn) => Loan.reconcileEmployeeLoans(employee.id, conn));
  await recordAudit({
    req, action: 'loan.create', entity: 'employee_loan', entityId: item.id,
    description: `₹${item.principal} loan (EMI ₹${item.emi}) for ${employee.first_name} ${employee.last_name || ''}`,
  });
  await notify({ title: 'Loan created', description: `Loan of ₹${item.principal} created for ${employee.first_name} ${employee.last_name || ''}.`, type: 'payroll' });
  return sendSuccess(res, { statusCode: 201, message: 'Loan created.', data: item });
});

// POST /api/loans/:id/approve  — set interest + tenure, compute EMI, activate
export const approveLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw ApiError.notFound('Loan not found.');
  if (loan.status !== 'pending') throw ApiError.badRequest(`Loan is already ${loan.status}.`);

  const principal = req.body.principal != null ? Number(req.body.principal) : Number(loan.requested_amount ?? loan.principal);
  const interestPercent = Number(req.body.interest_percent) || 0;
  const tenureMonths = Number(req.body.tenure_months);
  const startMonth = Number(req.body.start_month);
  const startYear = Number(req.body.start_year);
  if (!(principal > 0)) throw ApiError.badRequest('Principal must be greater than zero.');
  if (!(tenureMonths >= 1)) throw ApiError.badRequest('Tenure (months) is required.');

  const updated = await withTransaction(async (conn) => {
    const u = await Loan.approve({ id: loan.id, principal, interestPercent, tenureMonths, startMonth, startYear, approvedBy: req.user.id }, conn);
    // Re-derive loan EMIs across this employee's unpaid payrolls, so the EMI
    // shows up immediately in any pending payroll from the start month onward.
    await Loan.reconcileEmployeeLoans(u.employee_id, conn);
    return Loan.findById(loan.id, conn);
  });

  await recordAudit({ req, action: 'loan.approve', entity: 'employee_loan', entityId: updated.id, description: `₹${principal} loan approved @ ${interestPercent}% p.a. over ${tenureMonths}mo (EMI ₹${updated.emi}) for ${updated.first_name} ${updated.last_name || ''}` });
  await notify({ title: 'Loan approved', description: `Loan of ₹${principal} approved for ${updated.first_name} ${updated.last_name || ''}. EMI ₹${updated.emi} × ${tenureMonths} months.`, type: 'payroll' });
  return sendSuccess(res, {
    message: `Loan approved. EMI ₹${updated.emi} is deducted from salary each month from ${startMonth}/${startYear}.`,
    data: updated,
  });
});

// DELETE /api/loans/:id  — forgive & delete a loan; EMI is removed from pending payrolls
export const deleteLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw ApiError.notFound('Loan not found.');
  await withTransaction(async (conn) => {
    await conn.execute('DELETE FROM employee_loans WHERE id = :id', { id: loan.id });
    // Recompute the employee's unpaid payrolls so the forgiven EMI disappears (net rises).
    await Loan.reconcileEmployeeLoans(loan.employee_id, conn);
  });
  await recordAudit({ req, action: 'loan.delete', entity: 'employee_loan', entityId: loan.id, description: `Loan of ₹${loan.principal} forgiven & deleted for ${loan.first_name} ${loan.last_name || ''}` });
  await notify({ title: 'Loan forgiven', description: `The loan for ${loan.first_name} ${loan.last_name || ''} was forgiven and removed. EMI cleared from pending payroll.`, type: 'payroll' });
  return sendSuccess(res, { message: 'Loan forgiven and deleted. EMI removed from pending payroll.' });
});

// POST /api/loans/:id/reject
export const rejectLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw ApiError.notFound('Loan not found.');
  if (loan.status !== 'pending') throw ApiError.badRequest(`Loan is already ${loan.status}.`);
  const updated = await Loan.reject({ id: loan.id, approvedBy: req.user.id });
  await recordAudit({ req, action: 'loan.reject', entity: 'employee_loan', entityId: updated.id, description: `Loan request rejected for ${updated.first_name} ${updated.last_name || ''}` });
  await notify({ title: 'Loan rejected', description: `Loan request for ${updated.first_name} ${updated.last_name || ''} was rejected.`, type: 'payroll' });
  return sendSuccess(res, { message: 'Loan request rejected.', data: updated });
});
