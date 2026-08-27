/**
 * Role → permission matrix.
 *
 * Roles
 *  super_admin → platform owner (software owner). Everything, including
 *                companies, subscriptions, backups, users and system settings.
 *  admin       → business owner. Full access to all *company* data: employees,
 *                payroll, reports, users, company settings, audit logs.
 *  hr          → HR Manager. People side: employees, attendance, leave,
 *                departments, designations, documents, reports. Read-only on
 *                payroll/salary slips. CANNOT pay salaries or edit pay.
 *  accountant  → Payroll, salary payments, advances, loans, deductions,
 *                bonuses, salary slips, payroll reports. Read-only on employee
 *                records. CANNOT modify employees/attendance/leave.
 *  employee    → Self-service only. Sees ONLY their own data and submits
 *                requests (uses distinct `self:*` permissions so the org-wide
 *                endpoints never match for them).
 *
 * Permissions are coarse-grained capability strings checked by the
 * `authorize` middleware. '*' grants all.
 *
 * Legend used below: ✅ full · 👀 read-only · 👤 own-only · ❌ none
 */

// ── Reusable capability groups ───────────────────────────────

/** Read-only visibility into people data (used by accountant). */
const PEOPLE_READONLY = [
  'employee:read',
  'department:read',
  'designation:read',
  'attendance:read',
  'leave:read',
  'leavetype:read',
  'document:read',
];

/** Full people management (used by HR + admin). */
const PEOPLE_MANAGE = [
  'employee:read', 'employee:create', 'employee:update', 'employee:delete',
  'department:read', 'department:create', 'department:update', 'department:delete',
  'designation:read', 'designation:create', 'designation:update', 'designation:delete',
  'attendance:read', 'attendance:write',
  'shift:read', 'shift:write',
  'leave:read', 'leave:write', 'leave:approve',
  'leavetype:read', 'leavetype:write',
  'document:read', 'document:write',
];

/** Full payroll/finance management (used by accountant + admin). */
const PAYROLL_MANAGE = [
  'salary:read', 'salary:write',
  'salaryprofile:read', 'salaryprofile:write',
  'payroll:read', 'payroll:write', 'payroll:generate', 'payroll:lock', 'payroll:revoke',
  'salaryslip:read',
  'payment:write',
  'advance:read', 'advance:write', 'advance:approve',
  'loan:read', 'loan:write',
];

// ── Per-role permission sets ─────────────────────────────────

const HR = [
  'dashboard:read',
  ...PEOPLE_MANAGE,
  'holiday:read', 'holiday:write',
  'report:read',
  'audit:read',
  // No standalone Payroll section (that's an Accountant operations screen). HR
  // views salary status per-employee via the profile and defines the structure.
  'salary:read', 'salaryslip:read',
  // HR owns the compensation structure (base + allowances + PF/ESI setup).
  'salaryprofile:read', 'salaryprofile:write',
];

const ACCOUNTANT = [
  'dashboard:read',
  ...PEOPLE_READONLY,
  'holiday:read', 'holiday:write',
  'report:read',
  'audit:read',
  ...PAYROLL_MANAGE,
];

const ADMIN = [
  ...new Set([
    'dashboard:read',
    ...PEOPLE_MANAGE,
    ...PAYROLL_MANAGE,
    'holiday:read', 'holiday:write',
    'report:read',
    'audit:read',
    // Business-owner extras
    'payroll:unlock', 'payroll:void',
    'user:read', 'user:create', 'user:update', 'user:delete',
    'company:read', 'company:update',
  ]),
];

const EMPLOYEE = [
  // Self-service only — distinct namespace so org-wide routes never match.
  'self:dashboard:read',
  'self:profile:read', 'self:profile:update',
  'self:attendance:read',
  'self:leave:read', 'self:leave:apply', 'self:leave:cancel',
  'self:salary:read', 'self:slip:download',
  'self:advance:read', 'self:advance:request',
  'self:loan:read', 'self:loan:request',
  'self:document:read', 'self:document:upload',
  'self:notification:read',
  // Shared, view-only company info
  'holiday:read',
];

export const PERMISSIONS = {
  super_admin: ['*'],
  admin: ADMIN,
  hr: HR,
  accountant: ACCOUNTANT,
  employee: EMPLOYEE,
};

/** Does this role hold the given permission? */
export function roleHasPermission(role, permission) {
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}
