import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { pool, withTransaction } from '../config/db.js';
import { round2 } from '../utils/money.js';
import * as Advance from '../models/advance.model.js';
import * as Payroll from '../models/payroll.model.js';
import * as Employee from '../models/employee.model.js';
import * as SalaryProfile from '../models/salaryProfile.model.js';
import { recordAudit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';

// GET /api/advances
export const listAdvances = asyncHandler(async (req, res) => {
  const data = await Advance.list({ employee_id: req.query.employee_id, status: req.query.status });
  return sendSuccess(res, { data });
});

// GET /api/advances/:id
export const getAdvance = asyncHandler(async (req, res) => {
  const item = await Advance.findById(req.params.id);
  if (!item) throw ApiError.notFound('Advance not found.');
  return sendSuccess(res, { data: item });
});

// POST /api/advances
export const createAdvance = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.body.employee_id);
  if (!employee) throw ApiError.notFound('Employee not found.');
  const profile = await SalaryProfile.getByEmployee(employee.id);
  if (profile && !profile.advance_eligible) {
    throw ApiError.badRequest('This employee is not eligible for advances. Enable “Advance” in their salary structure first.');
  }
  const item = await Advance.create(req.body);
  await recordAudit({ req, action: 'advance.create', entity: 'salary_advance', entityId: item.id, description: `₹${item.amount} advance for ${employee.first_name} ${employee.last_name || ''}` });
  await notify({ title: 'Advance requested', description: `₹${item.amount} advance requested for ${employee.first_name} ${employee.last_name || ''}.`, type: 'payroll' });
  return sendSuccess(res, { statusCode: 201, message: 'Advance recorded.', data: item });
});

// POST /api/advances/:id/pay  { amount, payment_method?, remarks? }
// Accountant disburses the advance with any amount (less/exact/more than
// requested). The disbursed amount is applied against the employee's latest
// open payroll, moving it from "pending" to "partial" (or "paid").
export const payAdvance = asyncHandler(async (req, res) => {
  const amount = round2(req.body.amount);
  if (!(amount > 0)) throw ApiError.badRequest('Payment amount must be greater than zero.');

  const advance = await Advance.findById(req.params.id);
  if (!advance) throw ApiError.notFound('Advance not found.');
  if (['paid', 'rejected', 'closed'].includes(advance.status)) {
    throw ApiError.badRequest(`Advance is already ${advance.status}.`);
  }

  const result = await withTransaction(async (conn) => {
    // Latest open payroll for this employee (current/most-recent period).
    const [[payroll]] = await conn.query(
      `SELECT * FROM payroll
       WHERE employee_id = :eid AND locked = 0
         AND payment_status NOT IN ('paid','cancelled','refunded')
       ORDER BY year DESC, month DESC LIMIT 1
       FOR UPDATE`,
      { eid: advance.employee_id }
    );

    let payrollId = null;
    let payrollAfter = null;
    if (payroll) {
      // Reflect against payroll, capped so remaining never goes negative.
      const remaining = Number(payroll.remaining_amount);
      const applied = round2(Math.min(amount, remaining));
      if (applied > 0) {
        const remainingAfter = round2(remaining - applied);
        await Payroll.insertPayment({
          payrollId: payroll.id,
          paymentDate: new Date().toISOString().slice(0, 10),
          amount: applied, remainingAfter,
          method: req.body.payment_method || 'bank_transfer',
          remarks: req.body.remarks || `Salary advance disbursed (₹${amount})`,
          createdBy: req.user.id,
        }, conn);
        const totals = await Payroll.applyPayment(payroll.id, applied, new Date().toISOString().slice(0, 10), conn);
        await Payroll.addHistory({
          payrollId: payroll.id, action: 'advance',
          newValue: { advanceId: advance.id, amount: applied, status: totals.status },
          actorId: req.user.id,
        }, conn);
        payrollId = payroll.id;
        payrollAfter = totals;
      }
    }

    const updated = await Advance.pay({ id: advance.id, paidAmount: amount, paidBy: req.user.id, payrollId }, conn);
    return { updated, payrollAfter };
  });

  await recordAudit({ req, action: 'advance.pay', entity: 'salary_advance', entityId: advance.id, description: `₹${amount} advance paid to ${advance.first_name} ${advance.last_name || ''}` });
  await notify({ title: 'Salary advance paid', description: `₹${amount} advance paid to ${advance.first_name} ${advance.last_name || ''}.`, type: 'payroll' });

  return sendSuccess(res, {
    message: result.payrollAfter
      ? `Advance paid. Payroll is now ${result.payrollAfter.status}.`
      : 'Advance paid. No open payroll to reflect against.',
    data: result.updated,
  });
});

// PATCH /api/advances/:id/decision  { status: approved|rejected }
export const decideAdvance = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw ApiError.badRequest('Decision must be approved or rejected.');
  const item = await Advance.findById(req.params.id);
  if (!item) throw ApiError.notFound('Advance not found.');
  if (item.status !== 'pending') throw ApiError.badRequest(`Advance is already ${item.status}.`);

  const updated = await Advance.decide({ id: req.params.id, status, approvedBy: req.user.id });
  // Reflect an approved installment advance (or a reversal) in pending payrolls right away.
  await withTransaction((conn) => Advance.reconcileEmployeeAdvances(updated.employee_id, conn));
  await recordAudit({ req, action: `advance.${status}`, entity: 'salary_advance', entityId: updated.id, description: `₹${updated.amount} ${status}` });
  await notify({ title: `Advance ${status}`, description: `Advance of ₹${updated.amount} for ${updated.first_name} ${updated.last_name || ''} was ${status}.`, type: 'payroll' });
  return sendSuccess(res, { message: `Advance ${status}.`, data: updated });
});
