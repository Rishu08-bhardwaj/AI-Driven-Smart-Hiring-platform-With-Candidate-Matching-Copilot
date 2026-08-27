import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as Company from '../models/company.model.js';
import * as Shift from '../models/shift.model.js';
import { getSettings, savePayrollSettings } from '../services/payroll.service.js';
import { recordAudit } from '../services/audit.service.js';

const hhmm = (t) => (t ? String(t).slice(0, 5) : null);

/** Company profile merged with the default shift's schedule (the single source of
 *  truth for working hours) and the overtime pay multiplier. Surfaced here so the
 *  Settings screen can edit them in one place. */
async function settingsPayload() {
  const company = await Company.get();
  const shift = await Shift.getDefault();
  const settings = await getSettings();
  return {
    ...company,
    shift_id: shift?.id || null,
    shift_name: shift?.shift_name || null,
    shift_start: hhmm(shift?.start_time),
    shift_end: hhmm(shift?.end_time),
    grace_minutes: shift?.grace_minutes ?? null,
    overtime_multiplier: Number(settings.overtime_multiplier) || 1,
    // Attendance pay policy — % of a day's salary the employee KEEPS per status
    // (and the per-minute late / early-exit penalties).
    pay_pct_absent: Number(settings.pay_pct_absent ?? 0),
    pay_pct_unpaid_leave: Number(settings.pay_pct_unpaid_leave ?? 0),
    pay_pct_half_day: Number(settings.pay_pct_half_day ?? 50),
    late_penalty_per_min: Number(settings.late_penalty_per_min ?? 0),
    early_exit_penalty_per_min: Number(settings.early_exit_penalty_per_min ?? 0),
  };
}

// GET /api/company
export const getCompany = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: await settingsPayload() });
});

// PUT /api/company
export const updateCompany = asyncHandler(async (req, res) => {
  const company = await Company.upsert(req.body);

  // Working hours are defined on the default shift; persist any schedule edits there
  // (and mirror onto the company row so no stale copy is left behind).
  const hasSchedule = req.body.shift_start != null || req.body.shift_end != null || req.body.grace_minutes != null;
  if (hasSchedule) {
    const shift = await Shift.getDefault();
    if (shift) {
      const start = req.body.shift_start || hhmm(shift.start_time);
      const end = req.body.shift_end || hhmm(shift.end_time);
      const grace = req.body.grace_minutes === '' || req.body.grace_minutes == null
        ? shift.grace_minutes : Number(req.body.grace_minutes);
      await Shift.setSchedule(shift.id, { start_time: start, end_time: end, grace_minutes: grace });
      await Company.upsert({ office_start: start, office_end: end });
    }
  }

  // Overtime multiplier + attendance pay policy live in payroll settings.
  const policyKeys = [
    'overtime_multiplier', 'pay_pct_absent', 'pay_pct_unpaid_leave', 'pay_pct_half_day',
    'late_penalty_per_min', 'early_exit_penalty_per_min',
  ];
  const policyPatch = {};
  for (const k of policyKeys) {
    if (req.body[k] != null && req.body[k] !== '') policyPatch[k] = Number(req.body[k]);
  }
  if (Object.keys(policyPatch).length) await savePayrollSettings(policyPatch);

  await recordAudit({ req, action: 'company.update', entity: 'company', entityId: company?.id, description: company?.company_name });
  return sendSuccess(res, { message: 'Company settings saved.', data: await settingsPayload() });
});
