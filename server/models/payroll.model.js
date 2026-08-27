import { pool } from '../config/db.js';

const LIST_SELECT = `
  SELECT p.id, p.employee_id, p.month, p.year, p.salary_amount, p.basic,
         p.gross_amount, p.bonus_total, p.other_deductions,
         p.loan_recovery, p.advance_recovery, p.pf, p.esi, p.tax,
         p.absent_deduction, p.halfday_deduction, p.late_penalty,
         p.total_deductions, p.net_amount,
         p.previous_pending, p.paid_amount, p.remaining_amount,
         (SELECT COALESCE(SUM(p2.remaining_amount), 0)
            FROM payroll p2
           WHERE p2.employee_id = p.employee_id
             AND p2.payment_status NOT IN ('paid','cancelled','refunded')
             AND (p2.year < p.year OR (p2.year = p.year AND p2.month <= p.month))) AS outstanding,
         (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', el.id, 'emi', el.emi, 'principal', el.principal))
            FROM employee_loans el
           WHERE el.employee_id = p.employee_id AND el.status = 'active' AND el.emi IS NOT NULL
             AND el.recovered < el.total_payable
             AND (el.start_year < p.year OR (el.start_year = p.year AND el.start_month <= p.month))) AS loan_emis,
         (SELECT COALESCE(SUM(p3.remaining_amount), 0)
            FROM payroll p3
           WHERE p3.employee_id = p.employee_id
             AND p3.payment_status NOT IN ('paid','cancelled','refunded')
             AND (p3.year < p.year OR (p3.year = p.year AND p3.month < p.month))) AS prior_unpaid,
         p.payment_status, p.locked, p.generated_date, p.last_payment_date,
         p.overtime_hours, p.present_days, p.absent_days, p.working_days,
         e.employee_code, e.first_name, e.last_name, e.photo_url,
         d.department_name, ds.designation_name
  FROM payroll p
  JOIN employees e          ON e.id = p.employee_id
  LEFT JOIN departments d   ON d.id = e.department_id
  LEFT JOIN designations ds ON ds.id = e.designation_id
`;

function buildFilters(q) {
  const where = ['e.deleted_at IS NULL'];
  const params = {};
  if (q.month) { where.push('p.month = :month'); params.month = q.month; }
  if (q.year) { where.push('p.year = :year'); params.year = q.year; }
  if (q.employee_id) { where.push('p.employee_id = :employeeId'); params.employeeId = q.employee_id; }
  if (q.department_id) { where.push('e.department_id = :deptId'); params.deptId = q.department_id; }
  if (q.designation_id) { where.push('e.designation_id = :desigId'); params.desigId = q.designation_id; }
  if (q.payment_status) { where.push('p.payment_status = :status'); params.status = q.payment_status; }
  if (q.locked != null && q.locked !== '') { where.push('p.locked = :locked'); params.locked = q.locked === 'true' || q.locked === true ? 1 : 0; }
  if (q.search) {
    where.push('(e.first_name LIKE :s OR e.last_name LIKE :s OR e.employee_code LIKE :s)');
    params.s = `%${q.search}%`;
  }
  return { whereSql: `WHERE ${where.join(' AND ')}`, params };
}

export async function list(q = {}) {
  const { whereSql, params } = buildFilters(q);
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));
  const offset = (page - 1) * limit;
  const sort = q.sort === 'outstanding' ? 'p.outstanding DESC' : 'p.year DESC, p.month DESC, e.first_name';
  const [rows] = await pool.query(
    `${LIST_SELECT} ${whereSql} ORDER BY ${sort} LIMIT :limit OFFSET :offset`,
    { ...params, limit, offset }
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM payroll p JOIN employees e ON e.id = p.employee_id ${whereSql}`,
    params
  );
  return { rows, total, page, limit };
}

export async function findById(id, conn = pool) {
  const [rows] = await conn.query(
    `SELECT p.*, e.employee_code, e.first_name, e.last_name, e.photo_url,
            d.department_name, ds.designation_name
     FROM payroll p
     JOIN employees e          ON e.id = p.employee_id
     LEFT JOIN departments d   ON d.id = e.department_id
     LEFT JOIN designations ds ON ds.id = e.designation_id
     WHERE p.id = :id LIMIT 1`,
    { id }
  );
  if (!rows[0]) return null;
  const [components] = await conn.query(
    `SELECT sc.id, sc.kind, sc.category, sc.label, sc.amount, sc.remarks, sc.created_at,
            u.name AS created_by_name
     FROM salary_components sc
     LEFT JOIN users u ON u.id = sc.created_by
     WHERE sc.payroll_id = :id ORDER BY sc.kind, sc.id`,
    { id }
  );
  // Earlier months for this employee that are still unpaid (arrears warning).
  const [prior] = await conn.query(
    `SELECT month, year, remaining_amount FROM payroll
      WHERE employee_id = :eid AND payment_status NOT IN ('paid','cancelled','refunded')
        AND (year < :y OR (year = :y AND month < :m))
      ORDER BY year, month`,
    { eid: rows[0].employee_id, y: rows[0].year, m: rows[0].month }
  );
  const priorUnpaid = Math.round((prior.reduce((s, r) => s + Number(r.remaining_amount), 0) + Number.EPSILON) * 100) / 100;
  // Salary advances disbursed early against this payroll (shown as a partial payment).
  const [advancesPaid] = await conn.query(
    `SELECT id, amount, paid_amount, paid_at, reason FROM salary_advances
      WHERE payroll_id = :id AND status = 'paid' ORDER BY paid_at`,
    { id }
  );
  return { ...rows[0], components, prior_unpaid: priorUnpaid, prior_unpaid_months: prior, advances_paid: advancesPaid };
}

export async function findByEmployeePeriod(employeeId, month, year, conn = pool) {
  const [rows] = await conn.query(
    'SELECT * FROM payroll WHERE employee_id = :employeeId AND month = :month AND year = :year LIMIT 1',
    { employeeId, month, year }
  );
  return rows[0] || null;
}

/** Sum of unpaid remaining from all PRIOR periods (carry-forward). Transaction-aware. */
export async function previousPending(employeeId, month, year, conn = pool) {
  const [[row]] = await conn.query(
    `SELECT COALESCE(SUM(remaining_amount), 0) AS pending
     FROM payroll
     WHERE employee_id = :employeeId
       AND payment_status NOT IN ('paid','cancelled','refunded')
       AND (year < :year OR (year = :year AND month < :month))`,
    { employeeId, month, year }
  );
  return Number(row.pending) || 0;
}

/** Insert a fully-computed payroll row. Transaction-aware. */
export async function insert(p, conn = pool) {
  const [res] = await conn.execute(
    `INSERT INTO payroll (
       employee_id, month, year, salary_amount, basic,
       house_allowance, medical_allowance, travel_allowance, food_allowance,
       bonus_total, overtime_hours, overtime_amount, incentives, commission, other_earnings,
       gross_amount, tax, pf, esi, advance_recovery, loan_recovery, late_penalty,
       absent_deduction, halfday_deduction, other_deductions, total_deductions, net_amount,
       previous_pending, paid_amount, remaining_amount, outstanding,
       present_days, absent_days, half_days, paid_leave_days, unpaid_leave_days, working_days,
       payment_status, generated_date, generated_by
     ) VALUES (
       :employee_id, :month, :year, :salary_amount, :basic,
       :house_allowance, :medical_allowance, :travel_allowance, :food_allowance,
       :bonus_total, :overtime_hours, :overtime_amount, :incentives, :commission, :other_earnings,
       :gross_amount, :tax, :pf, :esi, :advance_recovery, :loan_recovery, :late_penalty,
       :absent_deduction, :halfday_deduction, :other_deductions, :total_deductions, :net_amount,
       :previous_pending, 0, :remaining_amount, :outstanding,
       :present_days, :absent_days, :half_days, :paid_leave_days, :unpaid_leave_days, :working_days,
       'pending', :generated_date, :generated_by
     )`,
    p
  );
  return res.insertId;
}

export async function addComponent(c, conn = pool) {
  await conn.execute(
    `INSERT INTO salary_components (payroll_id, kind, category, label, amount, remarks, created_by)
     VALUES (:payrollId, :kind, :category, :label, :amount, :remarks, :createdBy)`,
    {
      payrollId: c.payrollId, kind: c.kind, category: c.category,
      label: c.label, amount: c.amount, remarks: c.remarks || null, createdBy: c.createdBy || null,
    }
  );
}

/** Recompute gross/deductions/net/remaining/outstanding from base fields + components. */
export async function recompute(payrollId, conn = pool) {
  const [[p]] = await conn.query('SELECT * FROM payroll WHERE id = :id', { id: payrollId });
  const [comp] = await conn.query(
    `SELECT kind, COALESCE(SUM(amount),0) AS total FROM salary_components
     WHERE payroll_id = :id GROUP BY kind`,
    { id: payrollId }
  );
  let extraEarnings = 0, extraDeductions = 0;
  for (const c of comp) {
    if (c.kind === 'earning') extraEarnings = Number(c.total);
    else extraDeductions = Number(c.total);
  }

  const baseEarnings =
    Number(p.basic) + Number(p.house_allowance) + Number(p.medical_allowance) +
    Number(p.travel_allowance) + Number(p.food_allowance) + Number(p.overtime_amount) +
    Number(p.incentives) + Number(p.commission) + Number(p.other_earnings);
  const gross = Math.round((baseEarnings + extraEarnings + Number.EPSILON) * 100) / 100;
  const bonusTotal = extraEarnings; // bonus/incentive components

  const baseDeductions =
    Number(p.tax) + Number(p.pf) + Number(p.esi) + Number(p.advance_recovery) +
    Number(p.loan_recovery) + Number(p.late_penalty) + Number(p.absent_deduction) +
    Number(p.halfday_deduction);
  const totalDeductions = Math.round((baseDeductions + extraDeductions + Number.EPSILON) * 100) / 100;
  const net = Math.round((gross - totalDeductions + Number.EPSILON) * 100) / 100;
  const remaining = Math.round((net - Number(p.paid_amount) + Number.EPSILON) * 100) / 100;
  const outstanding = Math.round((Number(p.previous_pending) + remaining + Number.EPSILON) * 100) / 100;

  await conn.execute(
    `UPDATE payroll SET gross_amount = :gross, bonus_total = :bonus, other_deductions = :otherDed,
       total_deductions = :totalDed, net_amount = :net, remaining_amount = :remaining, outstanding = :outstanding
     WHERE id = :id`,
    { gross, bonus: bonusTotal, otherDed: extraDeductions, totalDed: totalDeductions, net, remaining, outstanding, id: payrollId }
  );
}

// ── Payments (immutable ledger) ────────────────────────────

export async function insertPayment(pay, conn = pool) {
  const [res] = await conn.execute(
    `INSERT INTO salary_payments
       (salary_id, payment_date, amount, remaining_after, payment_method, transaction_id, reference_number, remarks, created_by)
     VALUES (:payrollId, :paymentDate, :amount, :remainingAfter, :method, :txnId, :refNo, :remarks, :createdBy)`,
    {
      payrollId: pay.payrollId, paymentDate: pay.paymentDate, amount: pay.amount,
      remainingAfter: pay.remainingAfter, method: pay.method, txnId: pay.transactionId || null,
      refNo: pay.referenceNumber || null, remarks: pay.remarks || null, createdBy: pay.createdBy || null,
    }
  );
  return res.insertId;
}

export async function listPayments(payrollId) {
  const [rows] = await pool.query(
    `SELECT sp.*, u.name AS created_by_name FROM salary_payments sp
     LEFT JOIN users u ON u.id = sp.created_by
     WHERE sp.salary_id = :payrollId ORDER BY sp.payment_date, sp.id`,
    { payrollId }
  );
  return rows;
}

export async function transactionExists(transactionId, conn = pool) {
  if (!transactionId) return false;
  const [rows] = await conn.query(
    'SELECT id FROM salary_payments WHERE transaction_id = :txnId LIMIT 1',
    { txnId: transactionId }
  );
  return rows.length > 0;
}

/** Apply a payment to the payroll totals + status. Transaction-aware. */
export async function applyPayment(payrollId, amount, paymentDate, conn = pool) {
  const [[p]] = await conn.query('SELECT * FROM payroll WHERE id = :id', { id: payrollId });
  const paid = Math.round((Number(p.paid_amount) + Number(amount) + Number.EPSILON) * 100) / 100;
  const remaining = Math.round((Number(p.net_amount) - paid + Number.EPSILON) * 100) / 100;
  const outstanding = Math.round((Number(p.previous_pending) + remaining + Number.EPSILON) * 100) / 100;
  let status = 'partial';
  if (remaining <= 0) status = 'paid';
  else if (paid <= 0) status = 'pending';

  await conn.execute(
    `UPDATE payroll SET paid_amount = :paid, remaining_amount = :remaining, outstanding = :outstanding,
       payment_status = :status, last_payment_date = :paymentDate
     WHERE id = :id`,
    { paid, remaining, outstanding, status, paymentDate, id: payrollId }
  );
  return { paid, remaining, outstanding, status };
}

export async function setLock(payrollId, locked, userId, conn = pool) {
  await conn.execute(
    `UPDATE payroll SET locked = :locked, locked_by = :userId, locked_at = :ts WHERE id = :id`,
    { locked: locked ? 1 : 0, userId: locked ? userId : null, ts: locked ? new Date() : null, id: payrollId }
  );
}

export async function addHistory(h, conn = pool) {
  await conn.execute(
    `INSERT INTO payroll_history (payroll_id, action, old_value, new_value, actor_id)
     VALUES (:payrollId, :action, :oldValue, :newValue, :actorId)`,
    {
      payrollId: h.payrollId, action: h.action,
      oldValue: h.oldValue != null ? JSON.stringify(h.oldValue) : null,
      newValue: h.newValue != null ? JSON.stringify(h.newValue) : null,
      actorId: h.actorId || null,
    }
  );
}

export async function history(payrollId) {
  const [rows] = await pool.query(
    `SELECT ph.*, u.name AS actor_name FROM payroll_history ph
     LEFT JOIN users u ON u.id = ph.actor_id
     WHERE ph.payroll_id = :id ORDER BY ph.created_at`,
    { id: payrollId }
  );
  return rows;
}
