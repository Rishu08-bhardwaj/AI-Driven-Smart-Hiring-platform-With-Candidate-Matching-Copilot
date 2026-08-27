import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import * as LeaveType from '../models/leaveType.model.js';
import { recordAudit } from '../services/audit.service.js';

export const listTypes = asyncHandler(async (req, res) => {
  const data = await LeaveType.list({ status: req.query.status || '', includeDeleted: req.query.includeDeleted === 'true' });
  return sendSuccess(res, { data });
});

export const getType = asyncHandler(async (req, res) => {
  const item = await LeaveType.findById(req.params.id);
  if (!item || item.deleted_at) throw ApiError.notFound('Leave type not found.');
  return sendSuccess(res, { data: item });
});

export const createType = asyncHandler(async (req, res) => {
  const item = await LeaveType.create(req.body);
  await recordAudit({ req, action: 'leavetype.create', entity: 'leave_type', entityId: item.id, description: item.name });
  return sendSuccess(res, { statusCode: 201, message: 'Leave type created.', data: item });
});

export const updateType = asyncHandler(async (req, res) => {
  const existing = await LeaveType.findById(req.params.id);
  if (!existing || existing.deleted_at) throw ApiError.notFound('Leave type not found.');
  const item = await LeaveType.update(req.params.id, req.body);
  await recordAudit({ req, action: 'leavetype.update', entity: 'leave_type', entityId: item.id, description: item.name });
  return sendSuccess(res, { message: 'Leave type updated.', data: item });
});

export const deleteType = asyncHandler(async (req, res) => {
  const existing = await LeaveType.findById(req.params.id);
  if (!existing || existing.deleted_at) throw ApiError.notFound('Leave type not found.');
  await LeaveType.softDelete(req.params.id);
  await recordAudit({ req, action: 'leavetype.delete', entity: 'leave_type', entityId: existing.id, description: existing.name });
  return sendSuccess(res, { message: 'Leave type deleted.' });
});
