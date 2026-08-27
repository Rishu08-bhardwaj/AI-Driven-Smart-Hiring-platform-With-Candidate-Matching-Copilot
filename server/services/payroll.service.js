import { pool } from '../config/db.js';
import { round2 } from '../utils/money.js';
import * as Payroll from '../models/payroll.model.js';
import * as SalaryProfile from '../models/salaryProfile.model.js';
import * as Advance from '../models/advance.model.js';
import * as Loan from '../models/loan.model.js';
import * as Shift from '../models/shift.model.js';

/** Load payroll settings (singleton) with sane fallbacks. */
export async function getSettings(conn = pool) {
  const [rows] = await conn.query('SELECT * FROM payroll_settings ORDER BY id LIMIT 1');
  return (
    rows[0] || {
      overtime_rate_default: 0,
      overtime_multiplier: 1,
      late_penalty_per_min: 0,
      early_exit_penalty_per_min: 0,
      absent_deduction_mode: 'per_day_basic',
      halfday_deduction_factor: 0.5,
      pay_pct_absent: 0,
      pay_pct_unpaid_leave: 0,
      pay_pct_half_day: 50,
      default_tax_percent: 0,
      default_pf_percent: 0,
      default_esi_percent: 0,
      default_working_days: 26,
      payday: 1,
    }
  );
}

/** Update the singleton payroll_settings row (e.g. the overtime multiplier). */
export async function savePayrollSettings(patch, conn = pool) {
  const allowed = [
    'overtime_rate_default', 'overtime_multiplier', 'late_penalty_per_min',
    'early_exit_penalty_per_min', 'halfday_deduction_factor', 'absent_deduction_mode',
    'pay_pct_absent', 'pay_pct_unpaid_leave', 'pay_pct_half_day',
    'default_tax_percent', 'default_pf_percent', 'default_esi_percent',
    'default_working_days', 'payday',
  ];
  const payload = {};
  for (const k of allowed) if (patch[k] !== undefined && patch[k] !== '') payload[k] = patch[k];
  if (!Object.keys(payload).length) return;
  const [[existing]] = await conn.query('SELECT id FROM payroll_settings ORDER BY id LIMIT 1');
  const set = Object.keys(payload).map((k) => `${k} = :${k}`).join(', ');
  if (existing) {
    await conn.execute(`UPDATE payroll_settings SET ${set} WHERE id = :id`, { ...payload, id: existing.id });
  } else {
    const cols = Object.keys(payload);
    await conn.execute(
      `INSERT INTO payroll_settings (${cols.join(', ')}) VALUES (${cols.map((c) => `:${c}`).join(', ')})`,
      payload
    );
  }
}

/** Net paid working hours a shift represents (end − start − break), fallback 8h. */
function shiftDailyHours(shift) {
  if (!shift?.start_time || !shift?.end_time) return 8;
  const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  let mins = toMin(shift.end_time) - toMin(shift.start_time);
  if (mins < 0) mins += 1440; // crosses midnight
  mins -= Number(shift.break_minutes) || 0;
  const hrs = mins / 60;
  return hrs > 0 ? hrs : 8;
}

/** Attendance aggregates for one employee in a period. Transaction-aware. */
async function attendanceFor(employeeId, month, year, conn) {
  const [[row]] = await conn.query(
    `SELECT
       SUM(status='present') AS present,
       SUM(status='wfh')     AS wfh,
       SUM(status='absent')  AS absent,
       SUM(status='half_day') AS half_day,
       SUM(status='paid_leave') AS paid_leave,
       SUM(status='unpaid_leave') AS unpaid_leave,
       COALESCE(SUM(late_minutes),0)     AS late_minutes,
       COALESCE(SUM(early_exit_minutes),0) AS early_exit_minutes,
       COALESCE(SUM(overtime_minutes),0) AS overtime_minutes
     FROM attendance
     WHERE employee_id = :employeeId AND MONTH(date) = :month AND YEAR(date) = :year`,
    { employeeId, month, year }
  );
  return {
    present: Number(row.present) || 0,
    wfh: Number(row.wfh) || 0,
    absent: Number(row.absent) || 0,
    halfDay: Number(row.half_day) || 0,
    paidLeave: Number(row.paid_leave) || 0,
    unpaidLeave: Number(row.unpaid_leave) || 0,
    lateMinutes: Number(row.late_minutes) || 0,
    earlyExitMinutes: Number(row.early_exit_minutes) || 0,
    overtimeHours: round2((Number(row.overtime_minutes) || 0) / 60),
  };
}

/**
 * Compute a complete payroll record for one employee/period.
 * Pure with respect to the DB *for preview* (no writes); the caller decides
 * whether to persist and record advance/loan recoveries.
 *
 * @returns {{ row, recoveries, meta }}
 */
export async function computeForEmployee({ employee, month, year }, conn = pool) {
  const settings = await getSettings(conn);
  const profile = await SalaryProfile.getByEmployee(employee.id, conn);
  const base = SalaryProfile.effectiveBase(profile, employee);
  const workingDays = Number(settings.default_working_days) || 26;
  const perDay = workingDays > 0 ? base / workingDays : 0;

  const att = await attendanceFor(employee.id, month, year, conn);

  // Allowances + statutory percentages from the profile (fallback to settings).
  const house = Number(profile?.house_allowance) || 0;
  const medical = Number(profile?.medical_allowance) || 0;
  const travel = Number(profile?.travel_allowance) || 0;
  const food = Number(profile?.food_allowance) || 0;
  const taxPct = Number(profile?.tax_percent ?? settings.default_tax_percent) || 0;
  const pfPct = Number(profile?.pf_percent ?? settings.default_pf_percent) || 0;
  const esiPct = Number(profile?.esi_percent ?? settings.default_esi_percent) || 0;

  // Overtime — automatic pay for the overtime hours recorded in attendance.
  // Rate priority: employee's explicit ₹/hr → company flat ₹/hr → the derived
  // hourly wage × the overtime multiplier (e.g. 1.5 = time-and-a-half). Daily
  // hours come from the working shift so the hourly wage matches the real schedule.
  const overtimeEligible = profile ? !!profile.overtime_eligible : true;
  const shift = (await Shift.shiftForEmployee(employee.id)) || (await Shift.getDefault());
  const dailyHours = shiftDailyHours(shift);
  const hourlyWage = workingDays > 0 && dailyHours > 0 ? base / (workingDays * dailyHours) : 0;
  const otMultiplier = Number(settings.overtime_multiplier) > 0 ? Number(settings.overtime_multiplier) : 1;
  const otRate = Number(profile?.overtime_rate) > 0
    ? Number(profile.overtime_rate)
    : Number(settings.overtime_rate_default) > 0
      ? Number(settings.overtime_rate_default)
      : round2(hourlyWage * otMultiplier);
  const overtimeAmount = overtimeEligible ? round2(att.overtimeHours * otRate) : 0;

  // Attendance-driven deductions, from the configurable pay policy. Each status has a
  // "paid %" — the fraction of a day's salary the employee keeps for it — so the deducted
  // portion is (1 − paid%). Defaults (absent 0%, unpaid 0%, half-day 50%) reproduce the
  // previous fixed behaviour. Late / early-exit are per-minute penalties.
  const frac = (pct, def) => {
    const v = Number(pct);
    return Math.max(0, Math.min(100, Number.isFinite(v) ? v : def)) / 100;
  };
  const payAbsent = frac(settings.pay_pct_absent, 0);
  const payUnpaid = frac(settings.pay_pct_unpaid_leave, 0);
  const payHalf = frac(settings.pay_pct_half_day, 50);
  const absentDeduction = round2(perDay * (att.absent * (1 - payAbsent) + att.unpaidLeave * (1 - payUnpaid)));
  const halfdayDeduction = round2(perDay * att.halfDay * (1 - payHalf));
  const latePenalty = round2(
    att.lateMinutes * Number(settings.late_penalty_per_min || 0) +
    att.earlyExitMinutes * Number(settings.early_exit_penalty_per_min || 0)
  );

  // Statutory
  const tax = round2(base * (taxPct / 100));
  const pf = round2(base * (pfPct / 100));
  const esi = round2(base * (esiPct / 100));

  // Advance & loan recovery (capped at outstanding)
  const recoveries = { advances: [], loans: [] };
  let advanceRecovery = 0;
  if (!profile || profile.advance_eligible) {
    const advances = await Advance.activeForEmployee(employee.id, conn);
    for (const a of advances) {
      const remaining = round2(Number(a.amount) - Number(a.recovered));
      const take = round2(Math.min(Number(a.recovery_per_month) || remaining, remaining));
      if (take > 0) { advanceRecovery = round2(advanceRecovery + take); recoveries.advances.push({ id: a.id, amount: take }); }
    }
  }
  let loanRecovery = 0;
  if (!profile || profile.loan_eligible) {
    const loans = await Loan.activeForEmployee(employee.id, month, year, conn);
    for (const l of loans) {
      const remaining = round2(Number(l.total_payable) - Number(l.recovered));
      const take = round2(Math.min(Number(l.emi), remaining));
      if (take > 0) { loanRecovery = round2(loanRecovery + take); recoveries.loans.push({ id: l.id, amount: take }); }
    }
  }

  const basic = round2(base);
  const grossBase = round2(basic + house + medical + travel + food + overtimeAmount);
  const totalDeductions = round2(
    tax + pf + esi + advanceRecovery + loanRecovery + latePenalty + absentDeduction + halfdayDeduction
  );
  const net = round2(grossBase - totalDeductions);
  const previousPending = await Payroll.previousPending(employee.id, month, year, conn);
  const remaining = net;
  const outstanding = round2(previousPending + remaining);

  const row = {
    employee_id: employee.id,
    month, year,
    salary_amount: basic,
    basic,
    house_allowance: house,
    medical_allowance: medical,
    travel_allowance: travel,
    food_allowance: food,
    bonus_total: 0,
    overtime_hours: att.overtimeHours,
    overtime_amount: overtimeAmount,
    incentives: 0,
    commission: 0,
    other_earnings: 0,
    gross_amount: grossBase,
    tax, pf, esi,
    advance_recovery: advanceRecovery,
    loan_recovery: loanRecovery,
    late_penalty: latePenalty,
    absent_deduction: absentDeduction,
    halfday_deduction: halfdayDeduction,
    other_deductions: 0,
    total_deductions: totalDeductions,
    net_amount: net,
    previous_pending: previousPending,
    remaining_amount: remaining,
    outstanding,
    present_days: att.present + att.wfh,
    absent_days: att.absent,
    half_days: att.halfDay,
    paid_leave_days: att.paidLeave,
    unpaid_leave_days: att.unpaidLeave,
    working_days: workingDays,
  };

  return { row, recoveries, meta: { base, perDay, attendance: att } };
}

/**
 * Re-apply the current salary profile (base, allowances, PF/ESI/tax, overtime)
 * to every UNPAID, unlocked payroll of an employee, then recompute net. Called
 * after a salary profile is edited so allowance/statutory changes show up in
 * pending payrolls without regenerating them. Preserves bonus/deduction
 * components, advance recovery, payments and carried-forward dues; loan EMIs
 * are re-derived separately.
 */
export async function resyncEmployeePayrolls(employeeId, conn = pool) {
  const [[employee]] = await conn.query('SELECT * FROM employees WHERE id = :id AND deleted_at IS NULL', { id: employeeId });
  if (!employee) return { updated: 0 };
  // A salary-structure change is effective going forward: it may only touch the
  // CURRENT and FUTURE unpaid payrolls. An already-elapsed month (even if still
  // unpaid/in arrears) keeps the structure it was run under — we never
  // retroactively change a past month's pay. To correct a specific past month,
  // regenerate that month explicitly.
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const [rows] = await conn.query(
    `SELECT id, month, year FROM payroll
      WHERE employee_id = :id AND locked = 0 AND paid_amount = 0
        AND payment_status NOT IN ('paid','cancelled','refunded')
        AND (year > :curYear OR (year = :curYear AND month >= :curMonth))`,
    { id: employeeId, curYear, curMonth }
  );
  for (const pr of rows) {
    const { row } = await computeForEmployee({ employee, month: pr.month, year: pr.year }, conn);
    // Refresh only profile/attendance-derived fields; keep advance_recovery,
    // loan_recovery, components (bonus/deduction), paid_amount, previous_pending.
    await conn.execute(
      `UPDATE payroll SET
         salary_amount = :salary_amount, basic = :basic,
         house_allowance = :house, medical_allowance = :medical,
         travel_allowance = :travel, food_allowance = :food,
         overtime_hours = :otHours, overtime_amount = :otAmount,
         tax = :tax, pf = :pf, esi = :esi,
         absent_deduction = :absentDed, halfday_deduction = :halfDed, late_penalty = :latePen,
         present_days = :present, absent_days = :absent, half_days = :half,
         paid_leave_days = :paidLeave, unpaid_leave_days = :unpaidLeave, working_days = :workingDays
       WHERE id = :id`,
      {
        salary_amount: row.salary_amount, basic: row.basic,
        house: row.house_allowance, medical: row.medical_allowance,
        travel: row.travel_allowance, food: row.food_allowance,
        otHours: row.overtime_hours, otAmount: row.overtime_amount,
        tax: row.tax, pf: row.pf, esi: row.esi,
        absentDed: row.absent_deduction, halfDed: row.halfday_deduction, latePen: row.late_penalty,
        present: row.present_days, absent: row.absent_days, half: row.half_days,
        paidLeave: row.paid_leave_days, unpaidLeave: row.unpaid_leave_days, workingDays: row.working_days,
        id: pr.id,
      }
    );
    await Payroll.recompute(pr.id, conn);
  }
  // Keep advance-recovery and loan EMIs consistent after the recompute above.
  await Advance.reconcileEmployeeAdvances(employeeId, conn);
  await Loan.reconcileEmployeeLoans(employeeId, conn);
  await carryForwardFrozenOvertime(employee, conn);
  return { updated: rows.length };
}

/**
 * A payroll that already carries a payment (paid_amount > 0) or is locked is
 * "frozen" — the loop above intentionally skips it so an issued payment's
 * figures never shift underneath it. But attendance can still be corrected for
 * that month afterward (e.g. overtime added late). Rather than silently losing
 * that pay, fold the missed overtime hours/amount into the employee's next open
 * (unlocked, unpaid) payroll period, on top of whatever that period's own
 * overtime already is — mirroring how unpaid balances already carry forward via
 * previous_pending, but for attendance-driven overtime on a month that can no
 * longer be edited directly.
 *
 * Self-correcting by construction: the resync loop above always resets a
 * destination row's own overtime_hours/overtime_amount to its native
 * (this-month-only) value before this runs, so each call recomputes the delta
 * from the frozen month's true attendance and re-applies it fresh — no separate
 * "already carried" bookkeeping needed.
 */
async function carryForwardFrozenOvertime(employee, conn) {
  const [frozen] = await conn.query(
    `SELECT id, month, year, overtime_hours, overtime_amount FROM payroll
      WHERE employee_id = :id AND (locked = 1 OR paid_amount > 0)
        AND payment_status NOT IN ('cancelled', 'refunded')`,
    { id: employee.id }
  );
  for (const pr of frozen) {
    const { row } = await computeForEmployee({ employee, month: pr.month, year: pr.year }, conn);
    const deltaAmount = round2(row.overtime_amount - Number(pr.overtime_amount));
    const deltaHours = round2(row.overtime_hours - Number(pr.overtime_hours));
    if (deltaAmount <= 0) continue;

    const [[dest]] = await conn.query(
      `SELECT id FROM payroll
        WHERE employee_id = :id AND locked = 0 AND paid_amount = 0
          AND payment_status NOT IN ('paid', 'cancelled', 'refunded')
          AND (year > :y OR (year = :y AND month > :m))
        ORDER BY year ASC, month ASC LIMIT 1`,
      { id: employee.id, y: pr.year, m: pr.month }
    );
    if (!dest) continue; // next period hasn't been generated yet — nothing to attach it to

    await conn.execute(
      `UPDATE payroll SET overtime_hours = overtime_hours + :deltaHours, overtime_amount = overtime_amount + :deltaAmount WHERE id = :id`,
      { deltaHours, deltaAmount, id: dest.id }
    );
    await Payroll.recompute(dest.id, conn);
  }
}

/** Is an employee eligible for payroll in this period? */
export function isEligible(employee, month, year) {
  if (['resigned', 'terminated', 'retired', 'inactive'].includes(employee.status)) {
    return { ok: false, reason: `status is ${employee.status}` };
  }
  if (employee.joining_date) {
    const periodEnd = new Date(Date.UTC(year, month, 0)); // last day of month
    const joined = new Date(`${employee.joining_date}T00:00:00Z`);
    if (joined > periodEnd) return { ok: false, reason: 'joined after payroll period' };
  }
  return { ok: true };
}
