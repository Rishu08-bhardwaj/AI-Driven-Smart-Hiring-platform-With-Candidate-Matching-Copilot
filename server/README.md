# HRMS API Server

Backend for the Business Employee & Payroll Management System.
Node.js + Express + MySQL/MariaDB (`mysql2`), JWT auth with refresh rotation, RBAC.

## Prerequisites
- Node.js ≥ 18
- MySQL or MariaDB running locally

## Setup

```bash
cd server
cp .env.example .env          # adjust DB creds / secrets if needed
npm install
```

Provision the database (one-time), then load schema + seed data:

```bash
# create DB + user (run once, as a DB admin)
mysql -u root <<'SQL'
CREATE DATABASE IF NOT EXISTS hrms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'hrms_user'@'localhost' IDENTIFIED BY 'hrms_pass';
GRANT ALL PRIVILEGES ON hrms_db.* TO 'hrms_user'@'localhost';
FLUSH PRIVILEGES;
SQL

npm run db:init    # apply schema.sql
mysql -u root hrms_db < database/migrations/002_attendance_leave.sql   # attendance + leave tables
mysql -u root hrms_db < database/migrations/003_payroll.sql            # payroll tables (renames salary→payroll)
npm run db:seed    # admin user + sample departments/designations/employees
node database/seed-3a.js   # shifts, leave types, holidays, leave balances
node database/seed-3b.js   # payroll settings, salary profiles, sample advance + loan
```

## Run

```bash
npm run dev        # nodemon, http://localhost:5000
# or
npm start
```

Health check: `GET http://localhost:5000/api/health`

## Seeded logins

| Role        | Email                 | Password    |
|-------------|-----------------------|-------------|
| Admin       | admin@hrms.local      | `Admin@123` |
| HR          | hr@hrms.local         | `Hr@12345`  |
| Accountant  | accounts@hrms.local   | `Acc@12345` |

## API surface (implemented so far)

```
GET  /api/health

# Auth
POST /api/auth/login          { email, password, remember }
POST /api/auth/refresh        (httpOnly cookie or body.refreshToken)
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password

# Dashboard
GET  /api/dashboard/stats
GET  /api/dashboard/charts?months=6
GET  /api/dashboard/widgets

# Employees
GET    /api/employees           ?page&limit&search&sort&status&department_id&...
GET    /api/employees/next-code
POST   /api/employees           (multipart: photo + fields)
GET    /api/employees/:id
PUT    /api/employees/:id
PATCH  /api/employees/:id/status
DELETE /api/employees/:id       ?archive=true
POST   /api/employees/bulk      { action, ids[], ... }
GET    /api/employees/:id/{salary-history|attendance|leaves|documents|timeline}

# Departments / Designations
GET/POST/PUT/DELETE  /api/departments   (+ /:id/archive, /:id/restore)
GET/POST/PUT/DELETE  /api/designations  (+ /:id/archive, /:id/restore)

# Notifications
GET   /api/notifications
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all

# Shifts
GET/POST/PUT/DELETE  /api/shifts
POST   /api/shifts/:id/assign          { employeeIds: [] }

# Attendance (Module 5)
GET    /api/attendance                 ?date&from&to&month&year&status&employee_id&department_id&shift_id&search&page&limit
GET    /api/attendance/summary         ?employee_id&month&year&working_days
GET    /api/attendance/analytics       ?date&month&year&months
GET    /api/attendance/:id
POST   /api/attendance                 mark/update one (auto late/OT/working-hours from shift)
POST   /api/attendance/bulk            { date, status, employee_ids[] }  (transactional)
PUT    /api/attendance/:id             correction (requires reason; logs old⇒new)
DELETE /api/attendance/:id

# Leave (Module 6)
GET/POST/PUT/DELETE  /api/leave-types
GET    /api/leaves                     ?employee_id&leave_type_id&status&department_id&from&to&page&limit
GET    /api/leaves/calendar            ?from&to
GET    /api/leaves/:id                 (includes approval history)
POST   /api/leaves                     apply (multipart: attachment) — validates overlap/balance/dates
PATCH  /api/leaves/:id/decision        { status: approved|rejected, remarks }  (transactional balance update)
PATCH  /api/leaves/:id/cancel          (releases balance if was approved)
GET    /api/leaves/balances/:employeeId  ?year
POST   /api/leaves/balances            { employee_id, leave_type_id, year, allocated }

# Holidays
GET/POST/PUT/DELETE  /api/holidays      ?year&type

# Payroll (Module 3B) — financial ops are transactional + audited
GET    /api/payroll                    ?month&year&employee_id&department_id&payment_status&locked&search&page&limit
GET    /api/payroll/dashboard          ?month&year   (KPIs, dept payroll, trends, status breakdown)
POST   /api/payroll/preview            { month, year, employee_ids? }  compute without saving
POST   /api/payroll/generate           { month, year, employee_ids?, regenerate? }  (transactional batch)
GET    /api/payroll/:id                full breakdown + components
GET    /api/payroll/:id/payments       immutable payment ledger
GET    /api/payroll/:id/history        payroll change history
GET    /api/payroll/:id/slip           PDF salary slip
POST   /api/payroll/:id/pay            { amount, payment_method, transaction_id, ... }  partial/full
POST   /api/payroll/:id/components     { kind:earning|deduction, category, label, amount }  bonus/deduction
PATCH  /api/payroll/:id/lock           lock after approval
PATCH  /api/payroll/:id/unlock         admin only

# Salary profiles / Advances / Loans
GET/PUT              /api/salary-profiles/:employeeId
GET/POST             /api/advances          + PATCH /api/advances/:id/decision
GET/POST             /api/loans
```

### Payroll business rules (all enforced + tested)
One payroll per employee per month · unlimited partial payments · auto remaining/status ·
**unpaid balance carries forward** (`previous_pending` → `outstanding`) · payment cannot exceed
remaining · duplicate transaction IDs blocked · payroll locks after approval (unlock = admin) ·
payment history is immutable · advance & loan recovery auto-applied at generation ·
every financial mutation runs in a DB transaction and writes an audit log + payroll_history.

## Architecture

```
config/      env + db pool (+ transactions)
models/      SQL query layer (parameterized, mass-assignment whitelist)
controllers/ request handling, business rules
routes/      express routers (auth + RBAC per route)
middleware/  auth, authorize, validate, error, rate-limit, upload + validators/
services/    storage (local/cloudinary), mailer, audit, notification
utils/       ApiError, response, jwt, password, permissions, ms
database/    schema.sql, migrate.js, seed.js
```

### Security
Helmet, CORS (credentialed), rate limiting (global + stricter on auth),
bcrypt password hashing, JWT access + rotating refresh tokens (hashed at rest),
express-validator on every write, parameterized queries (SQL-injection safe),
upload type + size limits, RBAC permission matrix (`utils/permissions.js`).
