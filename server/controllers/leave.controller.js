import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess, buildMeta } from '../utils/response.js';
import { withTransaction } from '../config/db.js';
import * as Leave from '../models/leave.model.js';
import * as LeaveType from '../models/leaveType.model.js';
import * as LeaveBalance from '../models/leaveBalance.model.js';
import * as Employee from '../models/employee.model.js';
import { persistFile } from '../services/storage.service.js';
import { recordAudit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';

/** Inclusive day count between two ISO dates; half-day single requests = 0.5. */
function computeTotalDays(startDate, endDate, halfDay) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.floor((end - start) / 86_400_000) + 1;
  if (halfDay && days === 1) return 0.5;
  return days;
}

// GET /api/leaves
export const listLeaves = asyncHandler(async (req, res) => {
  const { rows, total, page, limit } = await Leave.list(req.query);
  return sendSuccess(res, { data: rows, meta: buildMeta({ page, limit, total }) });
});

// GET /api/leaves/calendar?from=&to=
export const calendar = asyncHandler(async (req, res) => {
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const to = req.query.to || from;
  const data = await Leave.calendar({ from, to });
  return sendSuccess(res, { data });
});

// GET /api/leaves/:id
export const getLeave = asyncHandler(async (req, res) => {
  const leave = await Leave.findById(req.params.id);
  if (!leave) throw ApiError.notFound('Leave request not found.');
  const history = await Leave.approvalHistory(req.params.id);
  return sendSuccess(res, { data: { ...leave, history } });
});

// POST /api/leaves  — apply
export const applyLeave = asyncHandler(async (req, res) => {
  const { employee_id, leave_type_id, start_date, end_date } = req.body;
  const halfDay = req.body.half_day === true || req.body.half_day === 'true';

  if (new Date(end_date) < new Date(start_date)) {
    throw ApiError.badRequest('End date cannot be before start date.', [{ field: 'end_date', message: 'End date must be on or after start date.' }]);
  }

  const employee = await Employee.findById(employee_id);
  if (!employee) throw ApiError.notFound('Employee not found.');
  const leaveType = await LeaveType.findById(leave_type_id);
  if (!leaveType || leaveType.deleted_at) throw ApiError.badRequest('Invalid leave type.');

  if (await Leave.hasOverlap({ employeeId: employee_id, startDate: start_date, endDate: end_date })) {
    throw ApiError.conflict('This employee already has a leave request overlapping these dates.');
  }

  const totalDays = computeTotalDays(start_date, end_date, halfDay);
  const year = new Date(start_date).getFullYear();

  let attachmentUrl = null;
  if (req.file) {
    const stored = await persistFile(req.file, 'leaves');
    attachmentUrl = stored.url;
  }

  // Balance check (only for paid leave types with an allocation).
  const balance = await LeaveBalance.getOrCreate({
    employeeId: employee_id, leaveTypeId: leave_type_id, year,
    defaultAllocated: leaveType.default_days,
  });
  const remaining = Number(balance.allocated) - Number(balance.used);
  if (leaveType.is_paid && totalDays > remaining) {
    throw ApiError.badRequest(
      `Insufficient ${leaveType.name} balance: requested ${totalDays}, available ${remaining}.`,
      [{ field: 'leave_type_id', message: `Only ${remaining} day(s) remaining.` }]
    );
  }

  const leaveId = await withTransaction(async (conn) => {
    const id = await Leave.create(
      { employee_id, leave_type_id, start_date, end_date, total_days: totalDays, half_day: halfDay, reason: req.body.reason, attachment_url: attachmentUrl, emergency_contact: req.body.emergency_contact },
      conn
    );
    await Leave.addApproval({ leaveId: id, action: 'applied', actorId: req.user.id, remarks: req.body.reason }, conn);
    return id;
  });

  await recordAudit({
    req, action: 'leave.apply', entity: 'leave', entityId: leaveId,
    description: `${employee.first_name} ${employee.last_name || ''}: ${leaveType.name} ${start_date}→${end_date} (${totalDays}d)`,
  });
  await notify({ title: 'New leave request', description: `${employee.first_name} ${employee.last_name || ''} requested ${leaveType.name} (${totalDays}d).`, type: 'leave' });

  return sendSuccess(res, { statusCode: 201, message: 'Leave request submitted.', data: await Leave.findById(leaveId) });
});

// PATCH /api/leaves/:id/decision  { status: approved|rejected, remarks }
export const decideLeave = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body;
  const leave = await Leave.findById(req.params.id);
  if (!leave) throw ApiError.notFound('Leave request not found.');
  if (leave.status !== 'pending') {
    throw ApiError.badRequest(`This request is already ${leave.status} and cannot be changed.`);
  }

  const year = new Date(leave.start_date).getFullYear();
  await withTransaction(async (conn) => {
    await Leave.setStatus({ id: leave.id, status, approvedBy: req.user.id, remarks }, conn);
    await Leave.addApproval({ leaveId: leave.id, action: status, actorId: req.user.id, remarks }, conn);
    if (status === 'approved') {
      await LeaveBalance.adjustUsed(
        { employeeId: leave.employee_id, leaveTypeId: leave.leave_type_id, year, delta: Number(leave.total_days) },
        conn
      );
    }
  });

  await recordAudit({ req, action: `leave.${status}`, entity: 'leave', entityId: leave.id, description: `${leave.first_name} ${leave.last_name || ''} — ${status}` });
  await notify({
    title: `Leave ${status}`,
    description: `${leave.leave_type_name} request for ${leave.first_name} ${leave.last_name || ''} was ${status}.`,
    type: 'leave',
  });

  return sendSuccess(res, { message: `Leave ${status}.`, data: await Leave.findById(leave.id) });
});

// PATCH /api/leaves/:id/cancel
export const cancelLeave = asyncHandler(async (req, res) => {
  const leave = await Leave.findById(req.params.id);
  if (!leave) throw ApiError.notFound('Leave request not found.');
  if (leave.status === 'cancelled' || leave.status === 'rejected') {
    throw ApiError.badRequest(`This request is already ${leave.status}.`);
  }

  const wasApproved = leave.status === 'approved';
  const year = new Date(leave.start_date).getFullYear();
  await withTransaction(async (conn) => {
    await Leave.setStatus({ id: leave.id, status: 'cancelled', approvedBy: req.user.id, remarks: req.body.remarks }, conn);
    await Leave.addApproval({ leaveId: leave.id, action: 'cancelled', actorId: req.user.id, remarks: req.body.remarks }, conn);
    if (wasApproved) {
      // Release the previously consumed balance.
      await LeaveBalance.adjustUsed(
        { employeeId: leave.employee_id, leaveTypeId: leave.leave_type_id, year, delta: -Number(leave.total_days) },
        conn
      );
    }
  });

  await recordAudit({ req, action: 'leave.cancel', entity: 'leave', entityId: leave.id, description: `Cancelled leave for ${leave.first_name} ${leave.last_name || ''}` });
  await notify({ title: 'Leave cancelled', description: `${leave.leave_type_name} request for ${leave.first_name} ${leave.last_name || ''} was cancelled.`, type: 'leave' });

  return sendSuccess(res, { message: 'Leave cancelled.', data: await Leave.findById(leave.id) });
});

// ── Balances ───────────────────────────────────────────────

// GET /api/leaves/balances/:employeeId?year=
export const balances = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const data = await LeaveBalance.forEmployee(req.params.employeeId, year);
  return sendSuccess(res, { data, meta: { year } });
});

// POST /api/leaves/balances  — admin set allocation
export const setAllocation = asyncHandler(async (req, res) => {
  const { employee_id, leave_type_id, year, allocated } = req.body;
  await LeaveBalance.setAllocation({ employeeId: employee_id, leaveTypeId: leave_type_id, year, allocated });
  await recordAudit({ req, action: 'leave.allocate', entity: 'leave_balance', description: `Set ${allocated}d for employee ${employee_id}, type ${leave_type_id}, ${year}` });
  return sendSuccess(res, { message: 'Leave allocation updated.' });
});
