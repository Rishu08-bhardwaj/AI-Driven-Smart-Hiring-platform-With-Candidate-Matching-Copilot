/**
 * Client-side mirror of the server permission matrix, used only to show/hide
 * UI. The server remains the source of truth and re-checks every request.
 *
 * Keep this in sync with server/utils/permissions.js.
 */

const PEOPLE_READONLY = [
  'employee:read', 'department:read', 'designation:read',
  'attendance:read', 'leave:read', 'leavetype:read', 'document:read',
];

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

const PAYROLL_MANAGE = [
  'salary:read', 'salary:write',
  'salaryprofile:read', 'salaryprofile:write',
  'payroll:read', 'payroll:write', 'payroll:generate', 'payroll:lock', 'payroll:revoke',
  'salaryslip:read', 'payment:write',
  'advance:read', 'advance:write', 'advance:approve',
  'loan:read', 'loan:write',
];

const HR = [
  'dashboard:read', ...PEOPLE_MANAGE,
  'holiday:read', 'holiday:write', 'report:read', 'audit:read',
  // No standalone Payroll section — HR sees salary status per-employee (profile)
  // and owns the salary structure. Payroll operations belong to the Accountant.
  'salary:read', 'salaryslip:read',
  'salaryprofile:read', 'salaryprofile:write',
];

const ACCOUNTANT = [
  'dashboard:read', ...PEOPLE_READONLY,
  'holiday:read', 'holiday:write', 'report:read', 'audit:read',
  ...PAYROLL_MANAGE,
];

const ADMIN = [
  ...new Set([
    'dashboard:read', ...PEOPLE_MANAGE, ...PAYROLL_MANAGE,
    'holiday:read', 'holiday:write', 'report:read', 'audit:read',
    'payroll:unlock', 'payroll:void',
    'user:read', 'user:create', 'user:update', 'user:delete',
    'company:read', 'company:update',
  ]),
];

const EMPLOYEE = [
  'self:dashboard:read',
  'self:profile:read', 'self:profile:update',
  'self:attendance:read',
  'self:leave:read', 'self:leave:apply', 'self:leave:cancel',
  'self:salary:read', 'self:slip:download',
  'self:advance:read', 'self:advance:request',
  'self:loan:read', 'self:loan:request',
  'self:document:read', 'self:document:upload',
  'self:notification:read',
  'holiday:read',
];

const PERMISSIONS = {
  super_admin: ['*'],
  admin: ADMIN,
  hr: HR,
  accountant: ACCOUNTANT,
  employee: EMPLOYEE,
};

export function roleHasPermission(role, permission) {
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

/** Where to send a user after login, based on their role. */
export function landingPath(role) {
  if (roleHasPermission(role, 'dashboard:read')) return '/dashboard';
  if (roleHasPermission(role, 'self:dashboard:read')) return '/me/dashboard';
  return '/403';
}

/** Route prefix → permission required to open it (mirror of the guards in App.jsx). */
const ROUTE_PERMISSIONS = {
  '/dashboard': 'dashboard:read',
  '/employees': 'employee:read',
  '/departments': 'department:read',
  '/designations': 'designation:read',
  '/attendance': 'attendance:read',
  '/shifts': 'shift:read',
  '/leave-types': 'leavetype:read',
  '/leaves': 'leave:read',
  '/holidays': 'holiday:read',
  '/payroll': 'payroll:read',
  '/advances': 'advance:read',
  '/loans': 'loan:read',
  '/users': 'user:read',
  '/reports': 'report:read',
  '/settings': 'company:read',
  '/audit-logs': 'audit:read',
  '/me/dashboard': 'self:dashboard:read',
  '/me/profile': 'self:profile:read',
  '/me/attendance': 'self:attendance:read',
  '/me/leaves': 'self:leave:read',
  '/me/salary': 'self:salary:read',
  '/me/documents': 'self:document:read',
};

/**
 * Can this role open the given path? Neutral paths (/, /403, unknown) return
 * true so navigation isn't blocked; guarded routes are checked by permission.
 * Used to avoid dropping a user onto a 403 page right after login.
 */
export function canOpenPath(path, role) {
  if (!path) return false;
  const match = Object.keys(ROUTE_PERMISSIONS)
    .filter((p) => path === p || path.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (!match) return true;
  return roleHasPermission(role, ROUTE_PERMISSIONS[match]);
}
