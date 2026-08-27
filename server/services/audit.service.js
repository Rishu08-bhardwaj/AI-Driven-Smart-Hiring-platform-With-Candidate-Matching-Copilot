import { pool } from '../config/db.js';
import { clientInfo } from '../utils/requestContext.js';

/**
 * Write an audit-log entry. Never throws into the request flow — auditing
 * must not break the operation it records.
 *
 * @param {object} opts
 * @param {import('express').Request} [opts.req]   request (for IP/UA/user)
 * @param {number} [opts.userId]
 * @param {string} opts.action                     e.g. 'employee.create'
 * @param {string} [opts.entity]                   e.g. 'employee'
 * @param {number} [opts.entityId]
 * @param {string} [opts.description]
 */
export async function recordAudit({ req, userId, action, entity = null, entityId = null, description = null }) {
  try {
    const info = req ? clientInfo(req) : { ip: null, userAgent: null };
    const uid = userId ?? req?.user?.id ?? null;
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, description, ip_address, user_agent)
       VALUES (:userId, :action, :entity, :entityId, :description, :ip, :ua)`,
      {
        userId: uid,
        action,
        entity,
        entityId,
        description,
        ip: info.ip,
        ua: info.userAgent ? String(info.userAgent).slice(0, 255) : null,
      }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record:', err.message);
  }
}
