import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, buildMeta } from '../utils/response.js';
import * as Audit from '../models/audit.model.js';

// GET /api/audit-logs
export const listAuditLogs = asyncHandler(async (req, res) => {
  const { rows, total, page, limit } = await Audit.list({
    search: req.query.search || '',
    action: req.query.action || '',
    entity: req.query.entity || '',
    userId: req.query.userId || '',
    from: req.query.from || '',
    to: req.query.to || '',
    page: req.query.page || 1,
    limit: req.query.limit || 25,
  });
  return sendSuccess(res, { data: rows, meta: buildMeta({ page, limit, total }) });
});

// GET /api/audit-logs/actions
export const listActions = asyncHandler(async (req, res) => {
  const data = await Audit.actions();
  return sendSuccess(res, { data });
});
