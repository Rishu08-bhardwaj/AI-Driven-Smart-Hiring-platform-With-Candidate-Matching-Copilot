import { pool } from '../config/db.js';
import * as Payroll from './payroll.model.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Re-derive every UNPAID payroll's loan EMI for one employee from their current
 * active loans, processed oldest→newest so multi-month caps are respected, then
 * sync each loan's `recovered`/`status`. Deleted/cancelled loans are excluded,
 * so forgiving a loan makes its EMI disappear from pending payrolls (net rises).
 * Paid/locked payrolls are never modified (money already disbursed) but still
 * count toward each loan's running recovery.
 */
export async function reconcileEmployeeLoans(employeeId, conn = pool) {
  const [payrolls] = await conn.query(
    `SELECT id, month, year, loan_recovery, paid_amount, locked, payment_status
       FROM payroll WHERE employee_id = :eid ORDER BY year, month, id`,
    { eid: employeeId }
  );
  const [loans] = await conn.query(
    `SELECT id, emi, total_payable, start_month, start_year
       FROM employee_loans
      WHERE employee_id = :eid AND status = 'active' AND emi IS NOT NULL
        AND start_month IS NOT NULL AND start_year IS NOT NULL`,
    { eid: employeeId }
  );
  const running = {};
  loans.forEach((l) => { running[l.id] = 0; });

  for (const p of payrolls) {
    const editable = Number(p.paid_amount) === 0 && !p.locked
      && !['cancelled', 'refunded', 'paid'].includes(p.payment_status);
    let due = 0;
    for (const l of loans) {
      const started = l.start_year < p.year || (l.start_year === p.year && l.start_month <= p.month);
      if (!started) continue;
      const remaining = round2(Number(l.total_payable) - running[l.id]);
      if (remaining <= 0) continue;
      const take = round2(Math.min(Number(l.emi), remaining));
      if (take <= 0) continue;
      running[l.id] = round2(running[l.id] + take);
      due = round2(due + take);
    }
    if (editable && round2(Number(p.loan_recovery)) !== due) {
      await conn.execute('UPDATE payroll SET loan_recovery = :due WHERE id = :id', { due, id: p.id });
      await Payroll.recompute(p.id, conn);
    }
  }

  for (const l of loans) {
    const rec = round2(running[l.id]);
    const closed = rec >= Number(l.total_payable) - 0.005;
    await conn.execute(
      "UPDATE employee_loans SET recovered = :rec, status = IF(:closed, 'closed', 'active') WHERE id = :id AND status = 'active'",
      { rec, closed: closed ? 1 : 0, id: l.id }
    );
  }
}

const SELECT = `
  SELECT l.*, (l.total_payable - l.recovered) AS remaining,
         e.first_name, e.last_name, e.employee_code, u.name AS created_by_name
  FROM employee_loans l
  JOIN employees e   ON e.id = l.employee_id
  LEFT JOIN users u  ON u.id = l.created_by
`;

export async function list(q = {}) {
  const where = ['e.deleted_at IS NULL'];
  const params = {};
  if (q.employee_id) { where.push('l.employee_id = :employeeId'); params.employeeId = q.employee_id; }
  if (q.status) { where.push('l.status = :status'); params.status = q.status; }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const [rows] = await pool.query(`${SELECT} ${whereSql} ORDER BY l.created_at DESC`, params);
  return rows;
}

export async function findById(id, conn = pool) {
  const [rows] = await conn.query(`${SELECT} WHERE l.id = :id LIMIT 1`, { id });
  return rows[0] || null;
}

/** Round to 2 decimals. */
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
/**
 * Simple interest at an ANNUAL (per-annum) rate, pro-rated over the tenure.
 *   interest = principal × rate%p.a. × (tenureMonths / 12)
 *   EMI      = (principal + interest) / tenureMonths
 */
export function computeTerms(principal, interestPercent, tenureMonths) {
  const p = Number(principal);
  const ratePa = Number(interestPercent) || 0;
  const months = Number(tenureMonths) || 0;
  const totalInterest = r2(p * (ratePa / 100) * (months / 12));
  const totalPayable = r2(p + totalInterest);
  const emi = months > 0 ? r2(totalPayable / months) : null;
  return { totalInterest, totalPayable, emi };
}

export async function create(data, createdBy) {
  const principal = Number(data.principal);
  const interest = Number(data.interest_percent) || 0;
  const tenure = Number(data.tenure_months) || null;
  const { totalPayable, emi } = computeTerms(principal, interest, tenure);
  const [res] = await pool.execute(
    `INSERT INTO employee_loans
       (employee_id, principal, interest_percent, total_payable, emi, tenure_months, start_month, start_year, status, created_by, approved_by, approved_at)
     VALUES (:employeeId, :principal, :interest, :totalPayable, :emi, :tenure, :startMonth, :startYear, 'active', :createdBy, :createdBy, NOW())`,
    {
      employeeId: data.employee_id,
      principal,
      interest,
      totalPayable,
      emi: data.emi != null && data.emi !== '' ? Number(data.emi) : emi,
      tenure,
      startMonth: data.start_month,
      startYear: data.start_year,
      createdBy: createdBy || null,
    }
  );
  return findById(res.insertId);
}

/** Employee-initiated loan request (pending; terms set later on approval). */
export async function createRequest({ employeeId, amount, tenureMonths, reason }) {
  const [res] = await pool.execute(
    `INSERT INTO employee_loans
       (employee_id, principal, requested_amount, interest_percent, tenure_months, reason, request_date, status)
     VALUES (:employeeId, :amount, :amount, 0, :tenure, :reason, CURDATE(), 'pending')`,
    { employeeId, amount, tenure: tenureMonths || null, reason: reason || null }
  );
  return findById(res.insertId);
}

/** Approve a pending request: lock in interest + tenure, compute payable + EMI, activate. */
export async function approve({ id, principal, interestPercent, tenureMonths, startMonth, startYear, approvedBy }, conn = pool) {
  const { totalPayable, emi } = computeTerms(principal, interestPercent, tenureMonths);
  await conn.execute(
    `UPDATE employee_loans
     SET principal = :principal, interest_percent = :interest, tenure_months = :tenure,
         total_payable = :totalPayable, emi = :emi,
         start_month = :startMonth, start_year = :startYear,
         status = 'active', approved_by = :approvedBy, approved_at = NOW()
     WHERE id = :id`,
    { id, principal, interest: interestPercent, tenure: tenureMonths, totalPayable, emi, startMonth, startYear, approvedBy: approvedBy || null }
  );
  return findById(id, conn);
}

export async function reject({ id, approvedBy }, conn = pool) {
  await conn.execute(
    `UPDATE employee_loans SET status = 'rejected', approved_by = :approvedBy, approved_at = NOW() WHERE id = :id`,
    { id, approvedBy: approvedBy || null }
  );
  return findById(id, conn);
}

/** Loans belonging to one employee (self-service view). */
export async function listForEmployee(employeeId) {
  const [rows] = await pool.query(
    `${SELECT} WHERE l.employee_id = :employeeId AND e.deleted_at IS NULL ORDER BY l.created_at DESC`,
    { employeeId }
  );
  return rows;
}

/** Active loans whose recovery has started by the given period. Transaction-aware. */
export async function activeForEmployee(employeeId, month, year, conn = pool) {
  const [rows] = await conn.query(
    `SELECT *, (total_payable - recovered) AS remaining FROM employee_loans
     WHERE employee_id = :employeeId AND status = 'active' AND recovered < total_payable
       AND (start_year < :year OR (start_year = :year AND start_month <= :month))
     ORDER BY created_at`,
    { employeeId, month, year }
  );
  return rows;
}

export async function recordRecovery(id, amount, conn = pool) {
  await conn.execute(
    `UPDATE employee_loans
     SET recovered = recovered + :amount,
         status = IF(recovered + :amount >= total_payable, 'closed', status)
     WHERE id = :id`,
    { id, amount }
  );
}
