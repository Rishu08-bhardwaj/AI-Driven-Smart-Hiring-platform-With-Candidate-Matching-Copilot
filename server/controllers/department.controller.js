import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import * as Department from '../models/department.model.js';
import { recordAudit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';

// GET /api/departments
export const listDepartments = asyncHandler(async (req, res) => {
  const data = await Department.list({
    search: req.query.search || '',
    status: req.query.status || '',
    sort: req.query.sort || 'name',
    order: req.query.order || 'asc',
    includeDeleted: req.query.includeDeleted === 'true',
  });
  return sendSuccess(res, { data });
});

// GET /api/departments/:id
export const getDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept || dept.deleted_at) throw ApiError.notFound('Department not found.');
  return sendSuccess(res, { data: dept });
});

// POST /api/departments
export const createDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.create(req.body);
  await recordAudit({ req, action: 'department.create', entity: 'department', entityId: dept.id, description: dept.department_name });
  await notify({ title: 'Department created', description: `${dept.department_name} was added.`, type: 'department' });
  return sendSuccess(res, { statusCode: 201, message: 'Department created.', data: dept });
});

// PUT /api/departments/:id
export const updateDepartment = asyncHandler(async (req, res) => {
  const existing = await Department.findById(req.params.id);
  if (!existing || existing.deleted_at) throw ApiError.notFound('Department not found.');
  const dept = await Department.update(req.params.id, req.body);
  await recordAudit({ req, action: 'department.update', entity: 'department', entityId: dept.id, description: dept.department_name });
  return sendSuccess(res, { message: 'Department updated.', data: dept });
});

// DELETE /api/departments/:id  (?moveTo=<id> to reassign employees)
export const deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept || dept.deleted_at) throw ApiError.notFound('Department not found.');

  const count = await Department.employeeCount(req.params.id);
  if (count > 0) {
    const moveTo = req.query.moveTo ? Number(req.query.moveTo) : null;
    if (!moveTo) {
      throw ApiError.conflict(
        `This department has ${count} employee(s). Provide ?moveTo=<departmentId> to reassign them before deleting.`
      );
    }
    if (moveTo === Number(req.params.id)) {
      throw ApiError.badRequest('Cannot reassign employees to the same department.');
    }
    const target = await Department.findById(moveTo);
    if (!target || target.deleted_at) throw ApiError.badRequest('Target department does not exist.');
    await Department.reassignEmployees(req.params.id, moveTo);
  }

  await Department.softDelete(req.params.id);
  await recordAudit({ req, action: 'department.delete', entity: 'department', entityId: dept.id, description: dept.department_name });
  return sendSuccess(res, { message: 'Department deleted.' });
});

// PATCH /api/departments/:id/archive
export const archiveDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept || dept.deleted_at) throw ApiError.notFound('Department not found.');
  const updated = await Department.setStatus(req.params.id, 'archived');
  await recordAudit({ req, action: 'department.archive', entity: 'department', entityId: dept.id });
  return sendSuccess(res, { message: 'Department archived.', data: updated });
});

// PATCH /api/departments/:id/restore
export const restoreDepartment = asyncHandler(async (req, res) => {
  const updated = await Department.restore(req.params.id);
  if (!updated) throw ApiError.notFound('Department not found.');
  await recordAudit({ req, action: 'department.restore', entity: 'department', entityId: updated.id });
  return sendSuccess(res, { message: 'Department restored.', data: updated });
});
