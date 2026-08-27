import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess, buildMeta } from '../utils/response.js';
import { hashPassword } from '../utils/password.js';
import * as UserModel from '../models/user.model.js';
import { recordAudit } from '../services/audit.service.js';

export const ROLE_VALUES = ['super_admin', 'admin', 'hr', 'accountant', 'employee'];

/**
 * Which roles the acting user is allowed to assign. Only a Super Admin may
 * create or promote another Super Admin; everyone else (Admin) can assign
 * the lower roles.
 */
function assignableRoles(actorRole) {
  if (actorRole === 'super_admin') return ROLE_VALUES;
  return ROLE_VALUES.filter((r) => r !== 'super_admin');
}

function assertCanAssign(actor, role) {
  if (role && !assignableRoles(actor.role).includes(role)) {
    throw ApiError.forbidden(`You are not allowed to assign the "${role}" role.`);
  }
}

// GET /api/users
export const listUsers = asyncHandler(async (req, res) => {
  const { rows, total, page, limit } = await UserModel.list({
    search: req.query.search || '',
    role: req.query.role || '',
    status: req.query.status || '',
    sort: req.query.sort || 'created',
    order: req.query.order || 'desc',
    page: req.query.page || 1,
    limit: req.query.limit || 20,
  });
  return sendSuccess(res, { data: rows, meta: buildMeta({ page, limit, total }) });
});

// GET /api/users/:id
export const getUser = asyncHandler(async (req, res) => {
  const user = await UserModel.getPublicById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  return sendSuccess(res, { data: user });
});

// POST /api/users
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'employee', status = 'active' } = req.body;
  assertCanAssign(req.user, role);

  const existing = await UserModel.findByEmail(email);
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.', [
      { field: 'email', message: 'Email already in use.' },
    ]);
  }

  const hash = await hashPassword(password);
  const user = await UserModel.create({ name, email, password: hash, role, status });
  await recordAudit({ req, action: 'user.create', entity: 'user', entityId: user.id, description: `${name} <${email}> (${role})` });
  return sendSuccess(res, { statusCode: 201, message: 'User created.', data: user });
});

// PUT /api/users/:id
export const updateUser = asyncHandler(async (req, res) => {
  const target = await UserModel.findById(req.params.id);
  if (!target || target.deleted_at) throw ApiError.notFound('User not found.');

  const isSelf = Number(req.params.id) === req.user.id;
  const { name, role, status } = req.body;

  // Self-protection: you cannot change your own role or deactivate yourself.
  if (isSelf && role !== undefined && role !== target.role) {
    throw ApiError.badRequest('You cannot change your own role.');
  }
  if (isSelf && status !== undefined && status !== target.status) {
    throw ApiError.badRequest('You cannot change your own status.');
  }
  // Only a Super Admin may modify another Super Admin's account.
  if (target.role === 'super_admin' && req.user.role !== 'super_admin' && !isSelf) {
    throw ApiError.forbidden('Only a Super Admin can modify a Super Admin account.');
  }
  if (role !== undefined) assertCanAssign(req.user, role);

  const updated = await UserModel.update(req.params.id, { name, role, status });
  await recordAudit({ req, action: 'user.update', entity: 'user', entityId: updated.id, description: `${updated.name} (${updated.role})` });
  return sendSuccess(res, { message: 'User updated.', data: updated });
});

// PATCH /api/users/:id/password  — admin sets a new password
export const setUserPassword = asyncHandler(async (req, res) => {
  const target = await UserModel.findById(req.params.id);
  if (!target || target.deleted_at) throw ApiError.notFound('User not found.');
  if (target.role === 'super_admin' && req.user.role !== 'super_admin') {
    throw ApiError.forbidden('Only a Super Admin can reset a Super Admin password.');
  }
  const hash = await hashPassword(req.body.password);
  await UserModel.setPassword(target.id, hash);
  await recordAudit({ req, action: 'user.reset_password', entity: 'user', entityId: target.id, description: `Password reset for ${target.email}` });
  return sendSuccess(res, { message: 'Password updated.' });
});

// DELETE /api/users/:id
export const deleteUser = asyncHandler(async (req, res) => {
  const target = await UserModel.findById(req.params.id);
  if (!target || target.deleted_at) throw ApiError.notFound('User not found.');

  if (Number(req.params.id) === req.user.id) {
    throw ApiError.badRequest('You cannot delete your own account.');
  }
  if (target.role === 'super_admin' && req.user.role !== 'super_admin') {
    throw ApiError.forbidden('Only a Super Admin can delete a Super Admin account.');
  }

  await UserModel.softDelete(req.params.id);
  await recordAudit({ req, action: 'user.delete', entity: 'user', entityId: target.id, description: `${target.name} <${target.email}>` });
  return sendSuccess(res, { message: 'User deleted.' });
});
