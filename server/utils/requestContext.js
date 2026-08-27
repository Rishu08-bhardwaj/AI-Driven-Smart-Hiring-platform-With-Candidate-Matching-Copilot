/** Extract client IP (respecting proxy header) and user-agent from a request. */
export function clientInfo(req) {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]) || req.ip || req.socket?.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;
  return { ip, userAgent };
}
