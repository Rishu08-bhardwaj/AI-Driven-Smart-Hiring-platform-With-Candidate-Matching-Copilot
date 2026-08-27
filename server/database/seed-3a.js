/**
 * Seed Module 5/6 reference data: a default shift (assigned to all employees),
 * standard leave types, a sample holiday, and per-employee leave balances for
 * the current year. Idempotent.
 *
 * Usage: node database/seed-3a.js
 */
import { pool } from '../config/db.js';

const SHIFT = {
  shift_name: 'Morning Shift',
  start_time: '09:00:00',
  end_time: '18:00:00',
  break_minutes: 60,
  grace_minutes: 15,
  weekly_off: 'sunday',
};

const LEAVE_TYPES = [
  { name: 'Casual Leave', code: 'CL', default_days: 12, is_paid: 1 },
  { name: 'Sick Leave', code: 'SL', default_days: 10, is_paid: 1 },
  { name: 'Paid Leave', code: 'PL', default_days: 15, is_paid: 1 },
  { name: 'Unpaid Leave', code: 'LWP', default_days: 0, is_paid: 0 },
];

async function seedShift() {
  let [rows] = await pool.query('SELECT id FROM shifts WHERE shift_name = ?', [SHIFT.shift_name]);
  let shiftId;
  if (!rows.length) {
    const [res] = await pool.execute(
      `INSERT INTO shifts (shift_name, start_time, end_time, break_minutes, grace_minutes, weekly_off, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [SHIFT.shift_name, SHIFT.start_time, SHIFT.end_time, SHIFT.break_minutes, SHIFT.grace_minutes, SHIFT.weekly_off]
    );
    shiftId = res.insertId;
    // eslint-disable-next-line no-console
    console.log('  + shift Morning Shift');
  } else {
    shiftId = rows[0].id;
  }
  await pool.execute('UPDATE employees SET shift_id = ? WHERE shift_id IS NULL AND deleted_at IS NULL', [shiftId]);
  return shiftId;
}

async function seedLeaveTypes() {
  const ids = [];
  for (const t of LEAVE_TYPES) {
    const [rows] = await pool.query('SELECT id FROM leave_types WHERE code = ?', [t.code]);
    if (rows.length) { ids.push({ ...t, id: rows[0].id }); continue; }
    const [res] = await pool.execute(
      `INSERT INTO leave_types (name, code, default_days, is_paid, status) VALUES (?, ?, ?, ?, 'active')`,
      [t.name, t.code, t.default_days, t.is_paid]
    );
    ids.push({ ...t, id: res.insertId });
    // eslint-disable-next-line no-console
    console.log(`  + leave type ${t.name}`);
  }
  return ids;
}

async function seedHoliday() {
  const year = new Date().getFullYear();
  const [rows] = await pool.query('SELECT id FROM holidays WHERE name = ?', ['Independence Day']);
  if (!rows.length) {
    await pool.execute(
      `INSERT INTO holidays (name, holiday_date, description, holiday_type, recurring, status)
       VALUES (?, ?, 'National holiday', 'national', 1, 'active')`,
      ['Independence Day', `${year}-08-15`]
    );
    // eslint-disable-next-line no-console
    console.log('  + holiday Independence Day');
  }
}

async function seedBalances(types) {
  const year = new Date().getFullYear();
  const [emps] = await pool.query('SELECT id FROM employees WHERE deleted_at IS NULL');
  for (const e of emps) {
    for (const t of types) {
      await pool.execute(
        `INSERT INTO leave_balances (employee_id, leave_type_id, year, allocated, used)
         VALUES (?, ?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE allocated = VALUES(allocated)`,
        [e.id, t.id, year, t.default_days]
      );
    }
  }
  // eslint-disable-next-line no-console
  console.log(`  + leave balances for ${emps.length} employee(s)`);
}

async function run() {
  // eslint-disable-next-line no-console
  console.log('Seeding attendance/leave reference data...');
  await seedShift();
  const types = await seedLeaveTypes();
  await seedHoliday();
  await seedBalances(types);
  // eslint-disable-next-line no-console
  console.log('✓ 3A seeding complete.');
  await pool.end();
}

run().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('✗ Seeding failed:', err.message);
  await pool.end();
  process.exit(1);
});
