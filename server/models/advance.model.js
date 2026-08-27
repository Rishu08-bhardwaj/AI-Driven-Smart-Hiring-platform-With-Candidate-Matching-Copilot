import { pool } from '../config/db.js';
import * as Payroll from './payroll.model.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Re-derive every UNPAID payroll's installment "advance recovery" for one
 * employee from their currently-active (approved, not fully recovered)
 * advances, oldest→newest, then sync each advance's recovered/status.
 * Closed / paid / rejected advances are excluded, so a fully-recovered or
 * closed advance never leaves a stale recovery deduction on a pending payroll.
 * Paid/locked payrolls are never modified.
 */
export async function reconcileEmployeeAdvances(employeeId, conn = pool) {
  const [payrolls] = await conn.query(
    `SELECT id, month, year, advance_recovery, paid_amount, locked, payment_status
       FROM payroll WHERE employee_id = :eid ORDER BY year, month, id`,
    { eid: employeeId }
  );
  const [advances] = await conn.query(
    `SELECT id, amount, recovery_per_month FROM salary_advances
      WHERE employee_id = :eid AND status = 'approved' AND recovered < amount`,
    { eid: employeeId }
  );
  const running = {};
  advances.forEach((a) => { running[a.id] = 0; });

  for (const p of payrolls) {
    const editable = Number(p.paid_amount) === 0 && !p.locked
      && !['cancelled', 'refunded', 'paid'].includes(p.payment_status);
    let due = 0;
    for (const a of advances) {
      const remaining = round2(Number(a.amount) - running[a.id]);
      if (remaining <= 0) continue;
      const take = round2(Math.min(Number(a.recovery_per_month) || remaining, remaining));
      if (take <= 0) continue;
      running[a.id] = round2(running[a.id] + take);
      due = round2(due + take);
    }
    if (editable && round2(Number(p.advance_recovery)) !== due) {
      await conn.execute('UPDATE payroll SET advance_recovery = :due WHERE id = :id', { due, id: p.id });
      await Payroll.recompute(p.id, conn);
    }
  }

  for (const a of advances) {
    const rec = round2(running[a.id]);
    const closed = rec >= Number(a.amount) - 0.005;
    await conn.execute(
      "UPDATE salary_advances SET recovered = :rec, status = IF(:closed, 'closed', status) WHERE id = :id AND status = 'approved'",
      { rec, closed: closed ? 1 : 0, id: a.id }
    );
  }
}

const SELECT = `
  SELECT a.*, (a.amount - a.recovered) AS remaining,
         e.first_name, e.last_name, e.employee_code, u.name AS approved_by_name
  FROM salary_advances a
  JOIN employees e   ON e.id = a.employee_id
  LEFT JOIN users u  ON u.id = a.approved_by
`;

export async function list(q = {}) {
  const where = ['e.deleted_at IS NULL'];
  const params = {};
  if (q.employee_id) { where.push('a.employee_id = :employeeId'); params.employeeId = q.employee_id; }
  if (q.status) { where.push('a.status = :status'); params.status = q.status; }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const [rows] = await pool.query(`${SELECT} ${whereSql} ORDER BY a.created_at DESC`, params);
  return rows;
}

export async function findById(id, conn = pool) {
  const [rows] = await conn.query(`${SELECT} WHERE a.id = :id LIMIT 1`, { id });
  return rows[0] || null;
}

export async function create(data) {
  const [res] = await pool.execute(
    `INSERT INTO salary_advances (employee_id, amount, request_date, reason, recovery_per_month, status)
     VALUES (:employeeId, :amount, :requestDate, :reason, :recovery, 'pending')`,
    {
      employeeId: data.employee_id,
      amount: data.amount,
      requestDate: data.request_date,
      reason: data.reason || null,
      recovery: data.recovery_per_month ?? 0,
    }
  );
  return findById(res.insertId);
}

/** Advances belonging to one employee (self-service view). */
export async function listForEmployee(employeeId) {
  const [rows] = await pool.query(
    `${SELECT} WHERE a.employee_id = :employeeId AND e.deleted_at IS NULL ORDER BY a.created_at DESC`,
    { employeeId }
  );
  return rows;
}

/**
 * Disburse an advance with an accountant-chosen amount (may differ from the
 * requested amount). Marks it 'paid' and links the payroll it was applied to.
 * Transaction-aware.
 */
export async function pay({ id, paidAmount, paidBy, payrollId }, conn = pool) {
  await conn.execute(
    `UPDATE salary_advances
     SET paid_amount = :paidAmount, status = 'paid',
         paid_at = NOW(), paid_by = :paidBy, payroll_id = :payrollId,
         approved_by = COALESCE(approved_by, :paidBy),
         approved_at = COALESCE(approved_at, NOW())
     WHERE id = :id`,
    { id, paidAmount, paidBy: paidBy || null, payrollId: payrollId || null }
  );
  return findById(id, conn);
}

export async function decide({ id, status, approvedBy }) {
  await pool.execute(
    `UPDATE salary_advances SET status = :status, approved_by = :approvedBy, approved_at = NOW()
     WHERE id = :id`,
    { id, status, approvedBy: approvedBy || null }
  );
  return findById(id);
}

/** Approved advances with outstanding recovery for an employee. Transaction-aware. */
export async function activeForEmployee(employeeId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT *, (amount - recovered) AS remaining FROM salary_advances
     WHERE employee_id = :employeeId AND status = 'approved' AND recovered < amount
     ORDER BY approved_at`,
    { employeeId }
  );
  return rows;
}

/** Record a recovery against an advance; auto-closes when fully recovered. */
export async function recordRecovery(id, amount, conn = pool) {
  await conn.execute(
    `UPDATE salary_advances
     SET recovered = recovered + :amount,
         status = IF(recovered + :amount >= amount, 'closed', status)
     WHERE id = :id`,
    { id, amount }
  );
}
