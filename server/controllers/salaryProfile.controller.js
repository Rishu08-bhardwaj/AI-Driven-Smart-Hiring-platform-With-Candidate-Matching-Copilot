import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { withTransaction, pool } from '../config/db.js';
import { round2 } from '../utils/money.js';
import * as SalaryProfile from '../models/salaryProfile.model.js';
import * as Employee from '../models/employee.model.js';
import { resyncEmployeePayrolls, getSettings } from '../services/payroll.service.js';
import { recordAudit } from '../services/audit.service.js';

/** Accumulated Provident Fund corpus for an employee — the PF deducted from every
 *  processed (paid / partially-paid) payroll, minus any amounts already settled/withdrawn.
 *  Held for retirement / final settlement. Only exposed via this HR/Accountant/Admin
 *  endpoint; never in the employee self-view. */
async function pfCorpus(employeeId) {
  const [rows] = await pool.query(
    `SELECT CONCAT(year,'-',LPAD(month,2,'0')) AS period, month, year, pf, payment_status
     FROM payroll
     WHERE employee_id = :id AND pf > 0 AND payment_status IN ('paid','partial')
     ORDER BY year, month`,
    { id: employeeId }
  );
  const [wd] = await pool.query(
    `SELECT w.id, w.amount, w.note, w.settled_at, u.name AS settled_by_name
     FROM pf_withdrawals w LEFT JOIN users u ON u.id = w.settled_by
     WHERE w.employee_id = :id ORDER BY w.settled_at`,
    { id: employeeId }
  );
  const collected = round2(rows.reduce((s, r) => s + Number(r.pf), 0));
  const withdrawn = round2(wd.reduce((s, r) => s + Number(r.amount), 0));
  return {
    collected,
    withdrawn,
    available: round2(collected - withdrawn),
    months: rows.length,
    contributions: rows,
    withdrawals: wd,
  };
}

// GET /api/salary-profiles/:employeeId
export const getProfile = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.employeeId);
  if (!employee) throw ApiError.notFound('Employee not found.');
  const profile = await SalaryProfile.getByEmployee(req.params.employeeId);
  const settings = await getSettings();
  const companyDefaults = {
    pf_percent: Number(settings.default_pf_percent) || 0,
    esi_percent: Number(settings.default_esi_percent) || 0,
    tax_percent: Number(settings.default_tax_percent) || 0,
  };
  // For an employee with no structure yet, pre-fill the statutory rates that
  // payroll actually applies (the company defaults) so the form isn't blank —
  // saving it then can't silently zero out PF/ESI.
  const data = profile || {
    employee_id: Number(req.params.employeeId),
    base_salary: employee.salary,
    ...companyDefaults,
  };
  const pf = await pfCorpus(req.params.employeeId);
  return sendSuccess(res, { data: { ...data, companyDefaults, pfCorpus: pf } });
});

// PUT /api/salary-profiles/:employeeId
export const upsertProfile = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.employeeId);
  if (!employee) throw ApiError.notFound('Employee not found.');
  const before = await SalaryProfile.getByEmployee(req.params.employeeId);
  const profile = await SalaryProfile.upsert(req.params.employeeId, req.body);
  // Push the new allowances / PF / ESI / tax into any pending (unpaid) payrolls.
  const { updated } = await withTransaction((conn) => resyncEmployeePayrolls(employee.id, conn));
  await recordAudit({
    req, action: before ? 'salary_profile.update' : 'salary_profile.create',
    entity: 'salary_profile', entityId: profile.id,
    description: `Salary profile for ${employee.first_name} ${employee.last_name || ''} (base ₹${profile.base_salary})`,
  });
  return sendSuccess(res, {
    message: updated > 0
      ? `Salary profile saved. ${updated} pending payroll${updated > 1 ? 's' : ''} updated with the new structure.`
      : 'Salary profile saved.',
    data: profile,
  });
});

// POST /api/salary-profiles/:employeeId/pf-withdraw  — settle/withdraw PF (e.g. on retirement)
export const withdrawPf = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.employeeId);
  if (!employee) throw ApiError.notFound('Employee not found.');
  const pf = await pfCorpus(req.params.employeeId);
  // Default to settling the whole available corpus (retirement payout) when no amount given.
  const amount = round2(req.body.amount == null || req.body.amount === '' ? pf.available : Number(req.body.amount));
  if (!(amount > 0)) throw ApiError.badRequest('Enter a valid withdrawal amount.');
  if (amount > pf.available + 0.01) {
    throw ApiError.badRequest(`Amount exceeds the available PF corpus (₹${pf.available}).`);
  }
  await pool.query(
    'INSERT INTO pf_withdrawals (employee_id, amount, note, settled_by) VALUES (:e, :a, :n, :by)',
    { e: employee.id, a: amount, n: req.body.note?.trim() || null, by: req.user.id }
  );
  await recordAudit({
    req, action: 'pf.withdraw', entity: 'salary_profile', entityId: employee.id,
    description: `PF settlement ₹${amount} for ${employee.first_name} ${employee.last_name || ''}${req.body.note ? ` — ${req.body.note}` : ''}`,
  });
  return sendSuccess(res, { message: `PF settlement of ₹${amount} recorded.`, data: await pfCorpus(req.params.employeeId) });
});
