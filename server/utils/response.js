/**
 * Standard success envelope used by every controller.
 * { success: true, message, data, meta? }
 */
export function sendSuccess(res, { statusCode = 200, message = 'OK', data = null, meta = undefined } = {}) {
  const body = { success: true, message, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(statusCode).json(body);
}

/** Build pagination metadata for list endpoints. */
export function buildMeta({ page, limit, total }) {
  const safeLimit = Math.max(1, limit);
  return {
    page,
    limit: safeLimit,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}
