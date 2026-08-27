/**
 * Seed the database with one login per role (super admin, admin, HR,
 * accountant, employee), company settings,
 * and a small set of departments, designations and employees so the dashboard
 * has real data to render. Idempotent: re-running won't duplicate the admin.
 *
 * Usage: npm run db:seed
 */
import { pool } from '../config/db.js';
import { hashPassword } from '../utils/password.js';

const USERS = [
  { name: 'Super Admin', email: 'superadmin@hrms.local', password: 'Super@123', role: 'super_admin' },
  { name: 'System Admin', email: 'admin@hrms.local', password: 'Admin@123', role: 'admin' },
  { name: 'HR Manager', email: 'hr@hrms.local', password: 'Hr@12345', role: 'hr' },
  { name: 'Accountant', email: 'accounts@hrms.local', password: 'Acc@12345', role: 'accountant' },
  { name: 'Employee Portal', email: 'employee@hrms.local', password: 'Emp@12345', role: 'employee' },
];

const DEPARTMENTS = [
  { department_name: 'Engineering', department_code: 'ENG', description: 'Product & platform engineering' },
  { department_name: 'Human Resources', department_code: 'HR', description: 'People operations' },
  { department_name: 'Finance', department_code: 'FIN', description: 'Accounts & payroll' },
  { department_name: 'Sales', department_code: 'SAL', description: 'Revenue & growth' },
];

const DESIGNATIONS = [
  { designation_name: 'Software Engineer', dept: 'ENG', level: 'L2' },
  { designation_name: 'Engineering Manager', dept: 'ENG', level: 'L4' },
  { designation_name: 'HR Executive', dept: 'HR', level: 'L2' },
  { designation_name: 'Accountant', dept: 'FIN', level: 'L2' },
  { designation_name: 'Sales Executive', dept: 'SAL', level: 'L2' },
];

const EMPLOYEES = [
  { first_name: 'Aarav', last_name: 'Sharma', email: 'aarav@company.com', phone: '9810000001', gender: 'male', dept: 'ENG', desig: 'Software Engineer', salary: 80000, employment_type: 'full_time' },
  { first_name: 'Priya', last_name: 'Verma', email: 'priya@company.com', phone: '9810000002', gender: 'female', dept: 'ENG', desig: 'Engineering Manager', salary: 150000, employment_type: 'full_time' },
  { first_name: 'Rohan', last_name: 'Gupta', email: 'rohan@company.com', phone: '9810000003', gender: 'male', dept: 'HR', desig: 'HR Executive', salary: 55000, employment_type: 'full_time' },
  { first_name: 'Neha', last_name: 'Singh', email: 'neha@company.com', phone: '9810000004', gender: 'female', dept: 'FIN', desig: 'Accountant', salary: 60000, employment_type: 'full_time' },
  { first_name: 'Karan', last_name: 'Mehta', email: 'karan@company.com', phone: '9810000005', gender: 'male', dept: 'SAL', desig: 'Sales Executive', salary: 45000, employment_type: 'contract' },
];

async function seedUsers() {
  for (const u of USERS) {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [u.email]);
    if (rows.length) continue;
    const hash = await hashPassword(u.password);
    await pool.execute(
      'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, "active")',
      [u.name, u.email, hash, u.role]
    );
    // eslint-disable-next-line no-console
    console.log(`  + user ${u.email} (${u.role}) / ${u.password}`);
  }
}

async function seedCompany() {
  const [rows] = await pool.query('SELECT id FROM companies LIMIT 1');
  if (rows.length) return;
  await pool.execute(
    `INSERT INTO companies (company_name, email, phone, currency, timezone, working_days, default_leave_count, office_start, office_end)
     VALUES ('Acme Corp', 'info@acme.com', '9800000000', 'INR', 'Asia/Kolkata', 6, 12, '09:30:00', '18:30:00')`
  );
  // eslint-disable-next-line no-console
  console.log('  + company settings');
}

async function seedDepartments() {
  const map = {};
  for (const d of DEPARTMENTS) {
    let [rows] = await pool.query('SELECT id FROM departments WHERE department_code = ?', [d.department_code]);
    if (!rows.length) {
      const [res] = await pool.execute(
        'INSERT INTO departments (department_name, department_code, description, status) VALUES (?, ?, ?, "active")',
        [d.department_name, d.department_code, d.description]
      );
      map[d.department_code] = res.insertId;
    } else {
      map[d.department_code] = rows[0].id;
    }
  }
  return map;
}

async function seedDesignations(deptMap) {
  const map = {};
  for (const d of DESIGNATIONS) {
    const [rows] = await pool.query('SELECT id FROM designations WHERE designation_name = ?', [d.designation_name]);
    if (!rows.length) {
      const [res] = await pool.execute(
        'INSERT INTO designations (designation_name, department_id, level, status) VALUES (?, ?, ?, "active")',
        [d.designation_name, deptMap[d.dept] || null, d.level]
      );
      map[d.designation_name] = res.insertId;
    } else {
      map[d.designation_name] = rows[0].id;
    }
  }
  return map;
}

async function seedEmployees(deptMap, desigMap) {
  let n = 1;
  for (const e of EMPLOYEES) {
    const [rows] = await pool.query('SELECT id FROM employees WHERE email = ?', [e.email]);
    if (rows.length) continue;
    const code = `EMP${String(n).padStart(4, '0')}`;
    await pool.execute(
      `INSERT INTO employees
        (employee_code, first_name, last_name, email, phone, gender, joining_date,
         department_id, designation_id, employment_type, status, salary, salary_type)
       VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, 'active', ?, 'monthly')`,
      [code, e.first_name, e.last_name, e.email, e.phone, e.gender,
       deptMap[e.dept] || null, desigMap[e.desig] || null, e.employment_type, e.salary]
    );
    n += 1;
    // eslint-disable-next-line no-console
    console.log(`  + employee ${e.first_name} ${e.last_name} (${code})`);
  }
}

async function run() {
  // eslint-disable-next-line no-console
  console.log('Seeding HRMS database...');
  await seedUsers();
  await seedCompany();
  const deptMap = await seedDepartments();
  const desigMap = await seedDesignations(deptMap);
  await seedEmployees(deptMap, desigMap);
  // eslint-disable-next-line no-console
  console.log('✓ Seeding complete.');
  await pool.end();
}

run().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('✗ Seeding failed:', err.message);
  await pool.end();
  process.exit(1);
});
