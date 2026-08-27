import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import * as Designation from '../models/designation.model.js';
import { recordAudit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';

// GET /api/designations
export const listDesignations = asyncHandler(async (req, res) => {
  const data = await Designation.list({
    search: req.query.search || '',
    status: req.query.status || '',
    departmentId: req.query.departmentId || '',
    sort: req.query.sort || 'name',
    order: req.query.order || 'asc',
    includeDeleted: req.query.includeDeleted === 'true',
  });
  return sendSuccess(res, { data });
});

// GET /api/designations/:id
export const getDesignation = asyncHandler(async (req, res) => {
  const item = await Designation.findById(req.params.id);
  if (!item || item.deleted_at) throw ApiError.notFound('Designation not found.');
  return sendSuccess(res, { data: item });
});

// POST /api/designations
export const createDesignation = asyncHandler(async (req, res) => {
  const item = await Designation.create(req.body);
  await recordAudit({ req, action: 'designation.create', entity: 'designation', entityId: item.id, description: item.designation_name });
  await notify({ title: 'Designation created', description: `${item.designation_name} was added.`, type: 'designation' });
  return sendSuccess(res, { statusCode: 201, message: 'Designation created.', data: item });
});

// PUT /api/designations/:id
export const updateDesignation = asyncHandler(async (req, res) => {
  const existing = await Designation.findById(req.params.id);
  if (!existing || existing.deleted_at) throw ApiError.notFound('Designation not found.');
  const item = await Designation.update(req.params.id, req.body);
  await recordAudit({ req, action: 'designation.update', entity: 'designation', entityId: item.id, description: item.designation_name });
  return sendSuccess(res, { message: 'Designation updated.', data: item });
});

// DELETE /api/designations/:id
export const deleteDesignation = asyncHandler(async (req, res) => {
  const item = await Designation.findById(req.params.id);
  if (!item || item.deleted_at) throw ApiError.notFound('Designation not found.');

  const count = await Designation.employeeCount(req.params.id);
  if (count > 0) {
    throw ApiError.conflict(`This designation is assigned to ${count} employee(s). Reassign them before deleting.`);
  }

  await Designation.softDelete(req.params.id);
  await recordAudit({ req, action: 'designation.delete', entity: 'designation', entityId: item.id, description: item.designation_name });
  return sendSuccess(res, { message: 'Designation deleted.' });
});

// PATCH /api/designations/:id/archive
export const archiveDesignation = asyncHandler(async (req, res) => {
  const item = await Designation.findById(req.params.id);
  if (!item || item.deleted_at) throw ApiError.notFound('Designation not found.');
  const updated = await Designation.setStatus(req.params.id, 'archived');
  await recordAudit({ req, action: 'designation.archive', entity: 'designation', entityId: item.id });
  return sendSuccess(res, { message: 'Designation archived.', data: updated });
});

// PATCH /api/designations/:id/restore
export const restoreDesignation = asyncHandler(async (req, res) => {
  const updated = await Designation.restore(req.params.id);
  if (!updated) throw ApiError.notFound('Designation not found.');
  await recordAudit({ req, action: 'designation.restore', entity: 'designation', entityId: updated.id });
  return sendSuccess(res, { message: 'Designation restored.', data: updated });
});
