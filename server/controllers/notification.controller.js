import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as Notifications from '../services/notification.service.js';

// GET /api/notifications
export const list = asyncHandler(async (req, res) => {
  const data = await Notifications.listForUser(req.user.id, { limit: req.query.limit || 20 });
  return sendSuccess(res, { data });
});

// PATCH /api/notifications/:id/read
export const markRead = asyncHandler(async (req, res) => {
  await Notifications.markRead(req.params.id, req.user.id);
  return sendSuccess(res, { message: 'Notification marked read.' });
});

// PATCH /api/notifications/read-all
export const markAllRead = asyncHandler(async (req, res) => {
  await Notifications.markAllRead(req.user.id);
  return sendSuccess(res, { message: 'All notifications marked read.' });
});
