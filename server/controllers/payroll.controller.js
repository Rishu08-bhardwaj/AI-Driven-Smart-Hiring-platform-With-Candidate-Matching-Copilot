import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess, buildMeta } from '../utils/response.js';
import { pool, withTransaction } from '../config/db.js';
import { round2 } from '../utils/money.js';
import { roleHasPermission } from '../utils/permissions.js';
import * as Payroll from '../models/payroll.model.js';
import * as Advance from '../models/advance.model.js';
import * as Loan from '../models/loan.model.js';
import * as SalaryProfile from '../models/salaryProfile.model.js';
import { computeForEmployee, isEligible } from '../services/payroll.service.js';
import { recordAudit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';

/** Resolve the target employee set for a generation/preview request. */
async function resolveEmployees(employeeIds) {
  if (Array.isArray(employeeIds) && employeeIds.length) {
    const [rows] = await pool.query(
      'SELECT * FROM employees WHERE id IN (:ids) AND deleted_at IS NULL',
      { ids: employeeIds }
    );
    return rows;
  }
  const [rows] = await pool.query('SELECT * FROM employees WHERE deleted_at IS NULL');
  return rows;
}

// GET /api/payroll
export const listPayroll = asyncHandler(async (req, res) => {
  const { rows, total, page, limit } = await Payroll.list(req.query);
  return sendSuccess(res, { data: rows, meta: buildMeta({ page, limit, total }) });
});

// GET /api/payroll/:id
export const getPayroll = asyncHandler(async (req, res) => {
  const record = await Payroll.findById(req.params.id);
  if (!record) throw ApiError.notFound('Payroll record not found.');
  return sendSuccess(res, { data: record });
});

// POST /api/payroll/preview  { month, year, employee_ids? }
export const previewPayroll = asyncHandler(async (req, res) => {
  const { month, year, employee_ids } = req.body;
  const employees = await resolveEmployees(employee_ids);

  const preview = [];
  const skipped = [];
  for (const emp of employees) {
    const eligible = isEligible(emp, month, year);
    if (!eligible.ok) { skipped.push({ employee_id: emp.id, name: `${emp.first_name} ${emp.last_name || ''}`.trim(), reason: eligible.reason }); continue; }
    const existing = await Payroll.findByEmployeePeriod(emp.id, month, year);
    const isVoided = existing && ['cancelled', 'refunded'].includes(existing.payment_status);
    // A voided payroll that an admin hasn't settled yet blocks regeneration — surface
    // it as skipped-with-reason rather than a silently-greyed "already generated" row.
    if (isVoided && !existing.void_settled_at) {
      skipped.push({ employee_id: emp.id, name: `${emp.first_name} ${emp.last_name || ''}`.trim(), reason: 'voided — an admin must settle it before it can be regenerated' });
      continue;
    }
    const { row, meta } = await computeForEmployee({ employee: emp, month, year });
    preview.push({
      employee_id: emp.id,
      employee_code: emp.employee_code,
      name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
      // Only a LIVE payroll counts as "already generated". A settled void is regenerable.
      alreadyGenerated: !!existing && !isVoided,
      voidedSettled: !!isVoided,
      ...row,
      _meta: meta,
    });
  }
  return sendSuccess(res, { data: { month, year, preview, skipped } });
});

// POST /api/payroll/generate  { month, year, employee_ids?, regenerate? }
export const generatePayroll = asyncHandler(async (req, res) => {
  const { month, year, employee_ids, regenerate = false } = req.body;
  const employees = await resolveEmployees(employee_ids);

  const result = await withTransaction(async (conn) => {
    const created = [];
    const skipped = [];
    for (const emp of employees) {
      const eligible = isEligible(emp, month, year);
      if (!eligible.ok) { skipped.push({ employee_id: emp.id, reason: eligible.reason }); continue; }

      const existing = await Payroll.findByEmployeePeriod(emp.id, month, year, conn);
      const isVoided = existing && ['cancelled', 'refunded'].includes(existing.payment_status);
      let carryForward = 0; // money already retained by the employee from a settled void

      if (isVoided) {
        // A voided payroll is a closed financial record. It can only be replaced once
        // an admin has formally settled the disbursed money — then anyone who can
        // generate may re-issue the corrected payroll.
        if (!existing.void_settled_at) {
          skipped.push({ employee_id: emp.id, reason: 'voided payroll — an admin must mark it settled before it can be regenerated' });
          continue;
        }
        // The employee still holds (disbursed − returned) of the original payout — carry
        // that forward as already-paid on the corrected payroll instead of resetting to 0.
        carryForward = round2((Number(existing.void_disbursed) || 0) - (Number(existing.void_recovered) || 0));
        await conn.execute('DELETE FROM salary_components WHERE payroll_id = :id', { id: existing.id });
        await conn.execute('DELETE FROM payroll_history WHERE payroll_id = :id', { id: existing.id });
        await conn.execute('DELETE FROM payroll WHERE id = :id', { id: existing.id });
      } else {
        if (existing && !regenerate) { skipped.push({ employee_id: emp.id, reason: 'payroll already generated' }); continue; }
        if (existing && existing.locked) { skipped.push({ employee_id: emp.id, reason: 'payroll locked' }); continue; }
        if (existing && Number(existing.paid_amount) > 0) { skipped.push({ employee_id: emp.id, reason: 'payments already made' }); continue; }
        if (existing && regenerate) {
          // Remove the prior unpaid, unlocked draft before regenerating.
          await conn.execute('DELETE FROM payroll WHERE id = :id', { id: existing.id });
        }
      }

      const { row, recoveries } = await computeForEmployee({ employee: emp, month, year }, conn);
      const payrollId = await Payroll.insert({ ...row, generated_date: new Date().toISOString().slice(0, 10), generated_by: req.user.id }, conn);

      // Re-derive advance-recovery and loan EMIs across this employee's unpaid
      // payrolls (authoritative — closed advances/loans drop off automatically).
      await Advance.reconcileEmployeeAdvances(emp.id, conn);
      await Loan.reconcileEmployeeLoans(emp.id, conn);

      await Payroll.addHistory({ payrollId, action: 'generated', newValue: { net: row.net_amount, outstanding: row.outstanding }, actorId: req.user.id }, conn);

      // Carry forward money the employee already retained from a settled void, so the
      // corrected payroll shows as (fully/partly) paid rather than resetting to ₹0.
      if (carryForward > 0) {
        const seed = round2(Math.min(carryForward, Number(row.net_amount)));
        if (seed > 0) {
          const today = new Date().toISOString().slice(0, 10);
          await Payroll.insertPayment({
            payrollId, paymentDate: today, amount: seed,
            remainingAfter: round2(Number(row.net_amount) - seed),
            method: 'other', remarks: 'Carried forward — already disbursed on the voided payroll',
            createdBy: req.user.id,
          }, conn);
          const totals = await Payroll.applyPayment(payrollId, seed, today, conn);
          await Payroll.addHistory({ payrollId, action: 'carry_forward', newValue: { amount: seed, status: totals.status }, actorId: req.user.id }, conn);
        }
      }

      created.push({ payrollId, employee_id: emp.id, net: row.net_amount, outstanding: row.outstanding });
    }
    return { created, skipped };
  });

  await recordAudit({ req, action: 'payroll.generate', entity: 'payroll', description: `${result.created.length} payroll record(s) for ${month}/${year}` });
  await notify({ title: 'Payroll generated', description: `Payroll generated for ${result.created.length} employee(s) — ${month}/${year}.`, type: 'payroll' });

  return sendSuccess(res, { statusCode: 201, message: `Payroll generated for ${result.created.length} employee(s).`, data: result });
});

// POST /api/payroll/:id/pay  — partial or full payment
export const paySalary = asyncHandler(async (req, res) => {
  const amount = round2(req.body.amount);
  if (!(amount > 0)) throw ApiError.badRequest('Payment amount must be greater than zero.');
  const paymentDate = req.body.payment_date || new Date().toISOString().slice(0, 10);

  const result = await withTransaction(async (conn) => {
    const [[record]] = await conn.query('SELECT * FROM payroll WHERE id = :id FOR UPDATE', { id: req.params.id });
    if (!record) throw ApiError.notFound('Payroll record not found.');
    if (['cancelled', 'refunded'].includes(record.payment_status)) {
      throw ApiError.badRequest(`Cannot pay a ${record.payment_status} payroll.`);
    }
    const remaining = Number(record.remaining_amount);
    if (amount > remaining) {
      throw ApiError.badRequest(`Payment ₹${amount} exceeds remaining ₹${remaining}.`, [{ field: 'amount', message: `Maximum payable is ₹${remaining}.` }]);
    }
    if (req.body.transaction_id && (await Payroll.transactionExists(req.body.transaction_id, conn))) {
      throw ApiError.conflict('A payment with this transaction ID already exists.', [{ field: 'transaction_id', message: 'Duplicate transaction ID.' }]);
    }

    const remainingAfter = round2(remaining - amount);
    await Payroll.insertPayment({
      payrollId: record.id, paymentDate, amount, remainingAfter,
      method: req.body.payment_method || 'bank_transfer',
      transactionId: req.body.transaction_id, referenceNumber: req.body.reference_number,
      remarks: req.body.remarks, createdBy: req.user.id,
    }, conn);

    const totals = await Payroll.applyPayment(record.id, amount, paymentDate, conn);
    await Payroll.addHistory({ payrollId: record.id, action: 'payment', oldValue: { remaining }, newValue: { amount, remaining: totals.remaining, status: totals.status }, actorId: req.user.id }, conn);
    return { record, totals };
  });

  await recordAudit({
    req, action: 'payroll.payment', entity: 'payroll', entityId: Number(req.params.id),
    description: `Paid ₹${amount} (status ${result.totals.status}, remaining ₹${result.totals.remaining})`,
  });
  await notify({ title: result.totals.status === 'paid' ? 'Salary fully paid' : 'Partial salary paid', description: `₹${amount} paid for ${result.record.month}/${result.record.year}. Remaining ₹${result.totals.remaining}.`, type: 'payroll' });

  return sendSuccess(res, { message: 'Payment recorded.', data: await Payroll.findById(req.params.id) });
});

// GET /api/payroll/:id/payments
export const paymentHistory = asyncHandler(async (req, res) => {
  const record = await Payroll.findById(req.params.id);
  if (!record) throw ApiError.notFound('Payroll record not found.');
  const data = await Payroll.listPayments(req.params.id);
  return sendSuccess(res, { data });
});

// GET /api/payroll/:id/history
export const payrollHistory = asyncHandler(async (req, res) => {
  const data = await Payroll.history(req.params.id);
  return sendSuccess(res, { data });
});

// POST /api/payroll/:id/components  — add bonus (earning) or deduction
export const addComponent = asyncHandler(async (req, res) => {
  const { kind, category, label, amount, remarks } = req.body;
  const record = await Payroll.findById(req.params.id);
  if (!record) throw ApiError.notFound('Payroll record not found.');
  if (record.locked) throw ApiError.forbidden('Payroll is locked. Unlock it before editing.');
  if (Number(record.paid_amount) > 0) throw ApiError.badRequest('Cannot modify a payroll that already has payments.');

  // A bonus/earning can only be added if the employee is eligible for bonuses.
  if (kind === 'earning') {
    const profile = await SalaryProfile.getByEmployee(record.employee_id);
    if (profile && !profile.bonus_eligible) {
      throw ApiError.badRequest('This employee is not eligible for bonuses. Enable “Bonus” in their salary structure to add one.');
    }
  }

  // Manual deductions are for NON-attendance reasons only. Absent, late, half-day,
  // unpaid-leave and early-exit are calculated automatically from attendance + the pay
  // policy — allowing them here would double-charge the employee.
  if (kind === 'deduction') {
    const ATTENDANCE_CATEGORIES = ['absent', 'late', 'halfday', 'half_day', 'unpaid_leave', 'unpaidleave', 'early_exit', 'earlyexit'];
    if (ATTENDANCE_CATEGORIES.includes(String(category || '').trim().toLowerCase())) {
      throw ApiError.badRequest('Absent, late, half-day, unpaid-leave and early-exit are deducted automatically from attendance. Adjust the attendance record or the pay policy instead — manual deductions are for non-attendance reasons (damage, fine, recovery, cost, other).');
    }
  }

  await withTransaction(async (conn) => {
    await Payroll.addComponent({ payrollId: record.id, kind, category, label, amount: round2(amount), remarks, createdBy: req.user.id }, conn);
    await Payroll.recompute(record.id, conn);
    await Payroll.addHistory({ payrollId: record.id, action: `component.${kind}`, newValue: { category, label, amount }, actorId: req.user.id }, conn);
  });

  await recordAudit({ req, action: `payroll.${kind === 'earning' ? 'bonus' : 'deduction'}_add`, entity: 'payroll', entityId: record.id, description: `${label}: ₹${amount}` });
  return sendSuccess(res, { statusCode: 201, message: `${kind === 'earning' ? 'Bonus/earning' : 'Deduction'} added.`, data: await Payroll.findById(record.id) });
});

// PATCH /api/payroll/:id/lock
export const lockPayroll = asyncHandler(async (req, res) => {
  const record = await Payroll.findById(req.params.id);
  if (!record) throw ApiError.notFound('Payroll record not found.');
  if (record.locked) throw ApiError.badRequest('Payroll is already locked.');
  await withTransaction(async (conn) => {
    await Payroll.setLock(record.id, true, req.user.id, conn);
    await Payroll.addHistory({ payrollId: record.id, action: 'locked', actorId: req.user.id }, conn);
  });
  await recordAudit({ req, action: 'payroll.lock', entity: 'payroll', entityId: record.id, description: `Locked ${record.month}/${record.year}` });
  return sendSuccess(res, { message: 'Payroll locked.', data: await Payroll.findById(record.id) });
});

// PATCH /api/payroll/:id/unlock  (admin only — enforced by route permission)
export const unlockPayroll = asyncHandler(async (req, res) => {
  if (!roleHasPermission(req.user.role, 'payroll:unlock')) {
    throw ApiError.forbidden('Only an administrator can unlock payroll.');
  }
  const record = await Payroll.findById(req.params.id);
  if (!record) throw ApiError.notFound('Payroll record not found.');
  if (!record.locked) throw ApiError.badRequest('Payroll is not locked.');
  await withTransaction(async (conn) => {
    await Payroll.setLock(record.id, false, req.user.id, conn);
    await Payroll.addHistory({ payrollId: record.id, action: 'unlocked', actorId: req.user.id }, conn);
  });
  await recordAudit({ req, action: 'payroll.unlock', entity: 'payroll', entityId: record.id, description: `Unlocked ${record.month}/${record.year}` });
  return sendSuccess(res, { message: 'Payroll unlocked.', data: await Payroll.findById(record.id) });
});

// DELETE /api/payroll/:id  — revoke an UNPAID, unlocked payroll (clean removal)
export const deletePayroll = asyncHandler(async (req, res) => {
  const record = await Payroll.findById(req.params.id);
  if (!record) throw ApiError.notFound('Payroll record not found.');
  if (record.locked) throw ApiError.forbidden('Payroll is locked. Unlock it before revoking.');
  if (Number(record.paid_amount) > 0) {
    throw ApiError.badRequest('This payroll has payments recorded. An administrator must void it instead of revoking.');
  }
  await withTransaction(async (conn) => {
    await conn.execute('DELETE FROM salary_components WHERE payroll_id = :id', { id: record.id });
    await conn.execute('DELETE FROM payroll_history WHERE payroll_id = :id', { id: record.id });
    await conn.execute('DELETE FROM payroll WHERE id = :id', { id: record.id });
    // The removed payroll no longer recovers any advance/loan — re-sync those.
    await Advance.reconcileEmployeeAdvances(record.employee_id, conn);
    await Loan.reconcileEmployeeLoans(record.employee_id, conn);
  });
  await recordAudit({ req, action: 'payroll.revoke', entity: 'payroll', entityId: record.id, description: `Revoked ${record.month}/${record.year} payroll for ${record.first_name} ${record.last_name || ''}` });
  return sendSuccess(res, { message: 'Payroll revoked.' });
});

// PATCH /api/payroll/:id/void  — void a PAID payroll (admin only). Reverses the
// payment on the books; the disbursed cash must be recovered from the employee manually.
export const voidPayroll = asyncHandler(async (req, res) => {
  if (!roleHasPermission(req.user.role, 'payroll:void')) {
    throw ApiError.forbidden('Only an administrator can void a paid payroll.');
  }
  const record = await Payroll.findById(req.params.id);
  if (!record) throw ApiError.notFound('Payroll record not found.');
  if (['cancelled', 'refunded'].includes(record.payment_status)) throw ApiError.badRequest('This payroll is already voided.');
  const paidBefore = Number(record.paid_amount) || 0;
  if (paidBefore <= 0) throw ApiError.badRequest('This payroll has no payments — revoke it instead of voiding.');

  await withTransaction(async (conn) => {
    // Reverse the payment records and void the payroll on the books.
    await conn.execute('DELETE FROM salary_payments WHERE salary_id = :id', { id: record.id });
    await conn.execute(
      "UPDATE payroll SET payment_status='cancelled', paid_amount=0, remaining_amount=0, locked=0, void_disbursed=:paid WHERE id = :id",
      { id: record.id, paid: paidBefore }
    );
    await Payroll.addHistory({ payrollId: record.id, action: 'voided', oldValue: { paid_amount: paidBefore, status: record.payment_status }, newValue: { status: 'cancelled', recover_from_employee: paidBefore }, actorId: req.user.id }, conn);
    // Undo any advance/loan recovery this payroll had applied.
    await Advance.reconcileEmployeeAdvances(record.employee_id, conn);
    await Loan.reconcileEmployeeLoans(record.employee_id, conn);
  });
  await recordAudit({
    req, action: 'payroll.void', entity: 'payroll', entityId: record.id,
    description: `VOIDED ${record.month}/${record.year} payroll for ${record.first_name} ${record.last_name || ''}. ₹${paidBefore} had been disbursed and must be recovered from the employee.`,
  });
  return sendSuccess(res, {
    message: `Payroll voided. ₹${paidBefore} had already been paid out — recover it from the employee manually (the transfer cannot be reversed automatically).`,
    data: await Payroll.findById(record.id),
  });
});

const VOID_RESOLUTIONS = ['recovered', 'adjusted', 'written_off'];

// PATCH /api/payroll/:id/settle-void  — admin acknowledges how the disbursed money
// from a voided payroll was resolved. This UNLOCKS the month so a corrected payroll
// can be generated again (by admin or accountant).
export const settleVoid = asyncHandler(async (req, res) => {
  if (!roleHasPermission(req.user.role, 'payroll:void')) {
    throw ApiError.forbidden('Only an administrator can settle a voided payroll.');
  }
  const record = await Payroll.findById(req.params.id);
  if (!record) throw ApiError.notFound('Payroll record not found.');
  if (!['cancelled', 'refunded'].includes(record.payment_status)) {
    throw ApiError.badRequest('Only a voided payroll can be settled.');
  }
  if (record.void_settled_at) throw ApiError.badRequest('This voided payroll is already settled.');

  const resolution = String(req.body.resolution || '').trim();
  const note = String(req.body.note || '').trim();
  if (!VOID_RESOLUTIONS.includes(resolution)) {
    throw ApiError.badRequest(`Resolution must be one of: ${VOID_RESOLUTIONS.join(', ')}.`);
  }
  if (!note) throw ApiError.badRequest('A note is required to record how the money was settled.');

  // How much of the disbursed money the employee physically returned. Only meaningful
  // when it was "recovered from employee"; for adjust/write-off nothing comes back now.
  // Whatever the employee KEEPS (disbursed − returned) is carried forward as already-paid
  // when the corrected payroll is regenerated.
  const disbursed = Number(record.void_disbursed) || 0;
  let recovered = 0;
  if (resolution === 'recovered') {
    recovered = round2(req.body.recovered_amount == null || req.body.recovered_amount === '' ? disbursed : Number(req.body.recovered_amount));
    if (!(recovered >= 0)) throw ApiError.badRequest('Enter the amount the employee returned.');
    if (recovered > disbursed + 0.01) throw ApiError.badRequest(`Amount returned cannot exceed the disbursed ₹${disbursed}.`);
  }
  const retained = round2(disbursed - recovered);

  await withTransaction(async (conn) => {
    await conn.execute(
      'UPDATE payroll SET void_settled_at = NOW(), void_settled_by = :by, void_resolution = :res, void_settle_note = :note, void_recovered = :rec WHERE id = :id',
      { by: req.user.id, res: resolution, note, rec: recovered, id: record.id }
    );
    await Payroll.addHistory({ payrollId: record.id, action: 'void.settled', newValue: { resolution, note, disbursed, recovered, retained }, actorId: req.user.id }, conn);
  });
  await recordAudit({
    req, action: 'payroll.void.settle', entity: 'payroll', entityId: record.id,
    description: `Settled voided ${record.month}/${record.year} payroll for ${record.first_name} ${record.last_name || ''} — ${resolution.replace('_', ' ')} (disbursed ₹${disbursed}${resolution === 'recovered' ? `, returned ₹${recovered}, retained ₹${retained}` : ''}): ${note}`,
  });
  return sendSuccess(res, {
    message: 'Voided payroll settled. This month can now be regenerated.',
    data: await Payroll.findById(record.id),
  });
});
