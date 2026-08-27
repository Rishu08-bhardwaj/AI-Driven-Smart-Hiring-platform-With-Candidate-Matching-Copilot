import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import * as Holiday from '../models/holiday.model.js';
import { recordAudit } from '../services/audit.service.js';

export const listHolidays = asyncHandler(async (req, res) => {
  const data = await Holiday.list({
    year: req.query.year || '',
    type: req.query.type || '',
    includeDeleted: req.query.includeDeleted === 'true',
  });
  return sendSuccess(res, { data });
});

export const getHoliday = asyncHandler(async (req, res) => {
  const item = await Holiday.findById(req.params.id);
  if (!item || item.deleted_at) throw ApiError.notFound('Holiday not found.');
  return sendSuccess(res, { data: item });
});

export const createHoliday = asyncHandler(async (req, res) => {
  const item = await Holiday.create(req.body);
  await recordAudit({ req, action: 'holiday.create', entity: 'holiday', entityId: item.id, description: `${item.name} (${item.holiday_date})` });
  return sendSuccess(res, { statusCode: 201, message: 'Holiday created.', data: item });
});

export const updateHoliday = asyncHandler(async (req, res) => {
  const existing = await Holiday.findById(req.params.id);
  if (!existing || existing.deleted_at) throw ApiError.notFound('Holiday not found.');
  const item = await Holiday.update(req.params.id, req.body);
  await recordAudit({ req, action: 'holiday.update', entity: 'holiday', entityId: item.id, description: item.name });
  return sendSuccess(res, { message: 'Holiday updated.', data: item });
});

export const deleteHoliday = asyncHandler(async (req, res) => {
  const existing = await Holiday.findById(req.params.id);
  if (!existing || existing.deleted_at) throw ApiError.notFound('Holiday not found.');
  await Holiday.softDelete(req.params.id);
  await recordAudit({ req, action: 'holiday.delete', entity: 'holiday', entityId: existing.id, description: existing.name });
  return sendSuccess(res, { message: 'Holiday deleted.' });
});
