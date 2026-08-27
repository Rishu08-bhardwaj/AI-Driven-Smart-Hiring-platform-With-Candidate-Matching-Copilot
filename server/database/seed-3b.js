/**
 * Seed payroll reference data: settings singleton, per-employee salary profiles
 * (derived from employee.salary, with PF and a house allowance), plus one
 * approved advance and one active loan to exercise recovery logic. Idempotent.
 *
 * Usage: node database/seed-3b.js
 */
import { pool } from '../config/db.js';

async function seedSettings() {
  const [rows] = await pool.query('SELECT id FROM payroll_settings LIMIT 1');
  if (!rows.length) {
    await pool.execute(
      `INSERT INTO payroll_settings
        (overtime_rate_default, overtime_multiplier, late_penalty_per_min, absent_deduction_mode,
         halfday_deduction_factor, default_tax_percent, default_pf_percent,
         default_esi_percent, default_working_days, payday)
       VALUES (0, 1.5, 5, 'per_day_basic', 0.5, 0, 12, 0.75, 26, 1)`
    );
    // eslint-disable-next-line no-console
    console.log('  + payroll settings (working_days=26, PF=12%, ESI=0.75%, late=₹5/min)');
  }
}

async function seedProfiles() {
  const [emps] = await pool.query('SELECT id, salary FROM employees WHERE deleted_at IS NULL');
  for (const e of emps) {
    const base = Number(e.salary) || 0;
    const house = Math.round(base * 0.2);
    await pool.execute(
      `INSERT INTO salary_profiles
         (employee_id, base_salary, salary_type, salary_cycle, house_allowance, pf_percent, esi_percent)
       VALUES (?, ?, 'monthly', 'monthly', ?, 12, 0.75)
       ON DUPLICATE KEY UPDATE base_salary = VALUES(base_salary), house_allowance = VALUES(house_allowance)`,
      [e.id, base, house]
    );
  }
  // eslint-disable-next-line no-console
  console.log(`  + salary profiles for ${emps.length} employee(s)`);
}

async function seedAdvanceAndLoan() {
  const today = new Date().toISOString().slice(0, 10);
  const [adv] = await pool.query("SELECT id FROM salary_advances WHERE employee_id = 1 LIMIT 1");
  if (!adv.length) {
    await pool.execute(
      `INSERT INTO salary_advances (employee_id, amount, request_date, reason, status, approved_by, approved_at, recovery_per_month)
       VALUES (1, 10000, ?, 'Medical', 'approved', 1, NOW(), 2500)`,
      [today]
    );
    // eslint-disable-next-line no-console
    console.log('  + approved advance ₹10,000 (recover ₹2,500/mo) for employee 1');
  }
  const [loan] = await pool.query('SELECT id FROM employee_loans WHERE employee_id = 1 LIMIT 1');
  if (!loan.length) {
    const now = new Date();
    await pool.execute(
      `INSERT INTO employee_loans (employee_id, principal, interest_percent, total_payable, emi, start_month, start_year, status, created_by)
       VALUES (1, 24000, 0, 24000, 4000, ?, ?, 'active', 1)`,
      [now.getMonth() + 1, now.getFullYear()]
    );
    // eslint-disable-next-line no-console
    console.log('  + active loan ₹24,000 (EMI ₹4,000) for employee 1');
  }
}

async function run() {
  // eslint-disable-next-line no-console
  console.log('Seeding payroll reference data...');
  await seedSettings();
  await seedProfiles();
  await seedAdvanceAndLoan();
  // eslint-disable-next-line no-console
  console.log('✓ 3B seeding complete.');
  await pool.end();
}

run().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('✗ Seeding failed:', err.message);
  await pool.end();
  process.exit(1);
});
