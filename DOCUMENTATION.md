# HRMS — Functional Documentation

A Human Resource Management System (HRMS) for managing employees, attendance,
leave, and payroll for a single company.

- **Frontend:** React + Vite (runs on `http://localhost:5173`)
- **Backend:** Node.js + Express REST API (runs on `http://localhost:5000`)
- **Database:** MySQL
- **Auth:** JWT access token + refresh token; passwords hashed; rate-limited login

---

## 1. Roles

The system has **5 roles**:

| Role | Who | Scope |
|------|-----|-------|
| **Super Admin** | Software owner (you) | Everything (`*`) — incl. companies, subscriptions, backups, users, system settings. |
| **Admin** | Business owner | Full access to all company data: employees, payroll, reports, users, company settings, audit logs. |
| **HR Manager** | HR team | Employees, attendance, leave, departments, designations, documents, reports, holidays. **Read-only** on payroll/salary slips — **cannot pay salaries or edit pay.** |
| **Accountant** | Finance | Payroll, salary payments, advances, loans, deductions, bonuses, salary slips, payroll reports. **Read-only** on employee records — **cannot modify employees/attendance/leave.** |
| **Employee** | Staff self-service | Sees **only their own** data (profile, attendance, leave, salary slips, documents, notifications) and submits requests. |

**Login linkage:** staff roles log in directly. An **Employee** account is linked
to one employee record via `employees.user_id`, so the portal can scope every
view to "own data only".

### Key distinctions

- **Super Admin vs Admin** — Admin has every *company-level* permission but not
  platform/system powers (creating companies, subscriptions, backups). Those are
  Super Admin only (`*`).
- **`payroll:unlock`** — once a payroll run is locked, only **Super Admin / Admin**
  can unlock it. HR and Accountant can lock but not unlock.
- **HR cannot touch money** (no `payment:write`, `salary:write`, `payroll:generate/lock`).
- **Accountant cannot touch people** (no `employee:create/update/delete`,
  `attendance:write`, `leave:write/approve`).
- **Employee** uses a separate `self:*` permission namespace, so the org-wide
  endpoints never match for them — they physically cannot read other employees' data.

---

## 2. Permission model

Access is controlled by coarse-grained **permission strings** (e.g. `employee:create`,
`payroll:generate`). The mapping lives in two mirrored files:

- `server/utils/permissions.js` — **source of truth**, enforced by the
  `authorize` middleware on every API request.
- `client/src/utils/permissions.js` — UI mirror, used only to show/hide menu
  items and buttons. The server re-checks every request, so the UI mirror is
  convenience only, not security.

`admin` holds `['*']` (all permissions). `hr` holds the explicit list covering
all modules below.

---

## 3. Modules & functionality

### 3.1 Authentication  (`/api/auth`)
Open to everyone (no role needed) except `me`.

| Action | Endpoint | Notes |
|--------|----------|-------|
| Login | `POST /auth/login` | Rate-limited; returns access token + sets refresh cookie |
| Refresh token | `POST /auth/refresh` | Silent re-auth |
| Logout | `POST /auth/logout` | |
| Current user | `GET /auth/me` | Requires login |
| Forgot password | `POST /auth/forgot-password` | Emails a reset link (rate-limited) |
| Reset password | `POST /auth/reset-password` | Consumes reset token |

### 3.2 Dashboard  (`/api/dashboard`) — perm `dashboard:read`
Landing page after login. Headline stats, charts, and widgets (head-count,
attendance, leave, payroll summaries).

### 3.3 Employees  (`/api/employees`) — perms `employee:*`
Core people directory.

- **List / search / filter** employees; auto-generate next employee code.
- **Create / Edit** employee (with **photo upload**).
- **Change status** (active, inactive, on_leave, resigned, terminated, retired).
- **Delete** employee.
- **Bulk actions** across many employees at once.
- Per-employee tabs: **salary history**, **attendance**, **leave history**,
  **documents**, and an activity **timeline**.

### 3.4 Departments  (`/api/departments`) — perms `department:*`
CRUD plus **archive / restore** (soft delete).

### 3.5 Designations  (`/api/designations`) — perms `designation:*`
Job titles linked to departments; CRUD plus **archive / restore**.

### 3.6 Attendance  (`/api/attendance`) — perms `attendance:read` / `attendance:write`
- View attendance records, **summary**, and **analytics**.
- **Mark** attendance for one employee, **bulk mark** for many.
- **Correct** an existing record; **delete** a record.
- Statuses: present, absent, half_day, paid/unpaid leave, holiday, weekend,
  WFH, late, early_exit.

### 3.7 Shifts  (`/api/shifts`) — perms `shift:read` / `shift:write`
Define work shifts (timings); CRUD plus **assign a shift** to employees.

### 3.8 Leave  (`/api/leaves`) — perms `leave:read` / `leave:write` / `leave:approve`
- **Apply** for leave (with optional **attachment** upload).
- **Approve / reject** a request (`leave:approve`).
- **Cancel** a request.
- **Leave calendar** view.
- **Leave balances** per employee; **set/allocate** balances.

### 3.9 Leave Types  (`/api/leave-types`) — perms `leavetype:*`
Define leave categories (e.g. casual, sick, earned); CRUD.

### 3.10 Holidays  (`/api/holidays`) — perms `holiday:*`
Company holiday calendar; CRUD.

### 3.11 Payroll  (`/api/payroll`) — perms `payroll:*`, `payment:write`
The salary-processing engine.

| Action | Endpoint | Permission |
|--------|----------|------------|
| List payroll runs | `GET /payroll` | `payroll:read` |
| Payroll dashboard | `GET /payroll/dashboard` | `payroll:read` |
| **Preview** a run | `POST /payroll/preview` | `payroll:generate` |
| **Generate** a run | `POST /payroll/generate` | `payroll:generate` |
| View a run | `GET /payroll/:id` | `payroll:read` |
| Payment history | `GET /payroll/:id/payments` | `payroll:read` |
| Change history | `GET /payroll/:id/history` | `payroll:read` |
| **Download salary slip** (PDF) | `GET /payroll/:id/slip` | `payroll:read` |
| **Pay** salary | `POST /payroll/:id/pay` | `payment:write` |
| Add a pay component | `POST /payroll/:id/components` | `payroll:write` |
| **Lock** a run | `PATCH /payroll/:id/lock` | `payroll:lock` |
| **Unlock** a run | `PATCH /payroll/:id/unlock` | `payroll:unlock` ⚠️ **Admin only** |

Payment statuses: generated, pending, partial, paid, cancelled, refunded.

### 3.12 Salary Profiles  (`/api/salary-profiles`) — perms `salaryprofile:read` / `salaryprofile:write`
Per-employee salary structure (basic + allowances/deductions) that feeds payroll.
Get and upsert.

### 3.13 Advances  (`/api/advances`) — perms `advance:read` / `advance:write` / `advance:approve`
Salary advance requests: list, view, **create**, **approve/decline**. Recovered via payroll.

### 3.14 Loans  (`/api/loans`) — perms `loan:read` / `loan:write`
Employee loans: list, view, **create**. Recovered via payroll.

### 3.15 Notifications  (`/api/notifications`) — any logged-in user
In-app notifications: list, mark one read, mark all read. No special permission —
available to every authenticated user.

---

## 4. Navigation (what each role sees in the sidebar)

Sidebar items are gated by permission, so both Admin and HR see the full menu:

Dashboard · Employees · Departments · Designations · Attendance · Leave ·
Payroll · Reports *(coming soon)* · Settings *(coming soon)*

Pages reachable but not on the main sidebar: Shifts, Leave Types, Holidays,
Advances, Loans (linked from within their parent modules).

---

## 5. Role → functionality summary

Legend: ✅ full · 👀 read-only · 👤 own only · ❌ none

| Module | Super Admin | Admin | HR | Accountant | Employee |
|--------|:-----------:|:-----:|:--:|:----------:|:--------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | 👤 own |
| Employee Management | ✅ | ✅ | ✅ | 👀 | 👤 own |
| Attendance | ✅ | ✅ | ✅ | 👀 | 👤 own |
| Leave | ✅ | ✅ | ✅ | 👀 | apply/view own |
| Payroll | ✅ | ✅ | 👀 | ✅ | 👤 own |
| Salary Payment | ✅ | ✅ | ❌ | ✅ | ❌ |
| Salary Slip | ✅ | ✅ | 👀 | ✅ | download own |
| Reports | ✅ | ✅ | ✅ | ✅ | ❌ |
| Documents | ✅ | ✅ | ✅ | 👀 | 👤 own |
| Holidays | ✅ | ✅ | ✅ | ✅ | view |
| Notifications | ✅ | ✅ | ✅ | ✅ | 👤 own |
| Company Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| User Management | ✅ | ✅ | ❌ | ❌ | ❌ |
| Audit Logs | ✅ | ✅ | 👀 | 👀 | ❌ |

> **Status:** the permission matrix above is fully defined and enforced by the
> `authorize` middleware, and all referenced modules are now implemented:
> User Management (`/users`), Company Settings (`/settings` → `/api/company`),
> Reports (`/reports`), the Audit-log viewer (`/audit-logs`), and the Employee
> self-service portal (`/me/*` API + `/me/...` pages). Employee logins are
> provisioned by Admin/HR from the employee profile ("Create Login").

---

## 6. Default seeded logins

After `npm run db:seed`:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `superadmin@hrms.local` | `Super@123` |
| Admin | `admin@hrms.local` | `Admin@123` |
| HR Manager | `hr@hrms.local` | `Hr@12345` |
| Accountant | `accounts@hrms.local` | `Acc@12345` |
| Employee | `employee@hrms.local` | `Emp@12345` |

> Backing services: audit logging, email (password reset & notifications),
> in-app notifications, payroll calculation, PDF salary-slip generation, and
> file storage for photos/attachments.
