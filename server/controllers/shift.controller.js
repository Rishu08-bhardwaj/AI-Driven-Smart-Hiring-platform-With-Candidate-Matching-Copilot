import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import * as Shift from '../models/shift.model.js';
import { recordAudit } from '../services/audit.service.js';

// GET /api/shifts
export const listShifts = asyncHandler(async (req, res) => {
  const data = await Shift.list({
    status: req.query.status || '',
    includeDeleted: req.query.includeDeleted === 'true',
  });
  return sendSuccess(res, { data });
});

// GET /api/shifts/:id
export const getShift = asyncHandler(async (req, res) => {
  const shift = await Shift.findById(req.params.id);
  if (!shift || shift.deleted_at) throw ApiError.notFound('Shift not found.');
  return sendSuccess(res, { data: shift });
});

// POST /api/shifts
export const createShift = asyncHandler(async (req, res) => {
  const shift = await Shift.create(req.body);
  await recordAudit({ req, action: 'shift.create', entity: 'shift', entityId: shift.id, description: shift.shift_name });
  return sendSuccess(res, { statusCode: 201, message: 'Shift created.', data: shift });
});

// PUT /api/shifts/:id
export const updateShift = asyncHandler(async (req, res) => {
  const existing = await Shift.findById(req.params.id);
  if (!existing || existing.deleted_at) throw ApiError.notFound('Shift not found.');
  const shift = await Shift.update(req.params.id, req.body);
  await recordAudit({ req, action: 'shift.update', entity: 'shift', entityId: shift.id, description: shift.shift_name });
  return sendSuccess(res, { message: 'Shift updated.', data: shift });
});

// DELETE /api/shifts/:id
export const deleteShift = asyncHandler(async (req, res) => {
  const existing = await Shift.findById(req.params.id);
  if (!existing || existing.deleted_at) throw ApiError.notFound('Shift not found.');
  await Shift.softDelete(req.params.id);
  await recordAudit({ req, action: 'shift.delete', entity: 'shift', entityId: existing.id, description: existing.shift_name });
  return sendSuccess(res, { message: 'Shift deleted.' });
});

// POST /api/shifts/:id/assign  { employeeIds: [] }
export const assignShift = asyncHandler(async (req, res) => {
  const { employeeIds = [] } = req.body;
  if (!Array.isArray(employeeIds) || !employeeIds.length) throw ApiError.badRequest('No employees selected.');
  const shift = await Shift.findById(req.params.id);
  if (!shift || shift.deleted_at) throw ApiError.notFound('Shift not found.');
  const affected = await Shift.assignEmployees(req.params.id, employeeIds);
  await recordAudit({ req, action: 'shift.assign', entity: 'shift', entityId: shift.id, description: `${affected} employee(s)` });
  return sendSuccess(res, { message: `Shift assigned to ${affected} employee(s).`, data: { affected } });
});
