import { pool } from '../config/db.js';

const FIELDS = [
  'base_salary', 'salary_type', 'salary_cycle', 'payment_day',
  'house_allowance', 'medical_allowance', 'travel_allowance', 'food_allowance',
  'overtime_rate', 'tax_percent', 'pf_percent', 'esi_percent',
  'bank_name', 'account_number', 'ifsc', 'upi_id', 'tax_number', 'pf_number', 'esi_number',
  'bonus_eligible', 'overtime_eligible', 'advance_eligible', 'loan_eligible',
];

export async function getByEmployee(employeeId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT sp.*, e.first_name, e.last_name, e.employee_code, e.salary AS employee_salary
     FROM salary_profiles sp JOIN employees e ON e.id = sp.employee_id
     WHERE sp.employee_id = :id LIMIT 1`,
    { id: employeeId }
  );
  return rows[0] || null;
}

/** Insert or update an employee's salary profile. */
export async function upsert(employeeId, data) {
  const payload = {};
  for (const f of FIELDS) if (data[f] !== undefined) payload[f] = data[f] === '' ? null : data[f];

  const existing = await getByEmployee(employeeId);
  if (existing) {
    const assignments = Object.keys(payload).map((k) => `${k} = :${k}`).join(', ');
    if (assignments) {
      await pool.execute(
        `UPDATE salary_profiles SET ${assignments} WHERE employee_id = :employeeId`,
        { ...payload, employeeId }
      );
    }
  } else {
    const cols = ['employee_id', ...Object.keys(payload)];
    const placeholders = cols.map((c) => `:${c}`).join(', ');
    await pool.execute(
      `INSERT INTO salary_profiles (${cols.join(', ')}) VALUES (${placeholders})`,
      { employee_id: employeeId, ...payload }
    );
  }
  return getByEmployee(employeeId);
}

/** Effective base salary: profile base, falling back to the employee record. */
export function effectiveBase(profile, employee) {
  const base = Number(profile?.base_salary) || 0;
  if (base > 0) return base;
  return Number(employee?.salary) || 0;
}
