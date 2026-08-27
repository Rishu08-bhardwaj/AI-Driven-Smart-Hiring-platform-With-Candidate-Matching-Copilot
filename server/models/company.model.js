import { pool } from '../config/db.js';

const FIELDS = [
  'company_name', 'logo_url', 'address', 'phone', 'email', 'gst_number', 'website',
  'currency', 'timezone', 'salary_cycle', 'working_days', 'office_start', 'office_end',
  'default_leave_count',
];

/** The company is a singleton row. Returns it (or null on a fresh install). */
export async function get() {
  const [rows] = await pool.query('SELECT * FROM companies ORDER BY id LIMIT 1');
  return rows[0] || null;
}

/** Update the singleton, creating it if it does not exist yet. */
export async function upsert(data) {
  const existing = await get();
  const payload = {};
  for (const f of FIELDS) if (data[f] !== undefined) payload[f] = data[f] === '' ? null : data[f];

  if (existing) {
    const assignments = Object.keys(payload).map((k) => `${k} = :${k}`).join(', ');
    if (assignments) {
      await pool.execute(`UPDATE companies SET ${assignments} WHERE id = :id`, { ...payload, id: existing.id });
    }
  } else {
    const cols = Object.keys(payload);
    const placeholders = cols.map((c) => `:${c}`).join(', ');
    await pool.execute(`INSERT INTO companies (${cols.join(', ')}) VALUES (${placeholders})`, payload);
  }
  return get();
}
