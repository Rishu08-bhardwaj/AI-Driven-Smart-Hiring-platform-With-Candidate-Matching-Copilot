import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess, buildMeta } from '../utils/response.js';
import { withTransaction } from '../config/db.js';
import * as Attendance from '../models/attendance.model.js';
import * as Shift from '../models/shift.model.js';
import * as Employee from '../models/employee.model.js';
import { computeAttendance } from '../utils/attendanceCalc.js';
import { resyncEmployeePayrolls } from '../services/payroll.service.js';
import { recordAudit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';

/**
 * The working-hours reference used for late / overtime / early-exit math.
 * The SHIFT is the single source of truth for the schedule (times, grace, break):
 * an employee's assigned shift, or the company default shift when none is assigned.
 * Company Settings edits the default shift, so there is exactly one place that
 * defines working hours — nothing can drift out of sync.
 */
export async function workReference(employeeId) {
  const shift = (await Shift.shiftForEmployee(employeeId)) || (await Shift.getDefault());
  return {
    id: shift?.id || null,
    start_time: shift?.start_time || '09:00:00',
    end_time: shift?.end_time || '18:00:00',
    grace_minutes: shift?.grace_minutes ?? 15,
    break_minutes: shift?.break_minutes ?? 60,
  };
}

// GET /api/attendance
export const listAttendance = asyncHandler(async (req, res) => {
  const { rows, total, page, limit } = await Attendance.list(req.query);
  return sendSuccess(res, { data: rows, meta: buildMeta({ page, limit, total }) });
});

// GET /api/attendance/:id
export const getAttendance = asyncHandler(async (req, res) => {
  const record = await Attendance.findById(req.params.id);
  if (!record) throw ApiError.notFound('Attendance record not found.');
  return sendSuccess(res, { data: record });
});

// POST /api/attendance  — mark/update one employee for a date
export const markAttendance = asyncHandler(async (req, res) => {
  const { employee_id, date } = req.body;
  const employee = await Employee.findById(employee_id);
  if (!employee) throw ApiError.notFound('Employee not found.');

  const shift = await workReference(employee_id);
  const metrics = computeAttendance({
    checkIn: req.body.check_in,
    checkOut: req.body.check_out,
    breakMinutes: req.body.break_minutes,
    shift,
    status: req.body.status,
  });

  await Attendance.upsert({
    employee_id,
    date,
    status: metrics.status,
    check_in: req.body.check_in,
    check_out: req.body.check_out,
    break_minutes: req.body.break_minutes ?? shift?.break_minutes ?? 0,
    working_minutes: metrics.workingMinutes,
    overtime_minutes: metrics.overtimeMinutes,
    late_minutes: metrics.lateMinutes,
    early_exit_minutes: metrics.earlyExitMinutes,
    shift_id: shift?.id || null,
    remarks: req.body.remarks,
    actor: req.user.id,
  });

  // Push the recomputed OT / late / absent days into the employee's pending payroll
  // so an already-generated month reflects the attendance change immediately.
  await withTransaction((conn) => resyncEmployeePayrolls(employee_id, conn));

  const record = await Attendance.findByEmployeeDate(employee_id, date);
  await recordAudit({
    req, action: 'attendance.mark', entity: 'attendance', entityId: record.id,
    description: `${employee.first_name} ${employee.last_name || ''} → ${metrics.status} on ${date}`,
  });
  if (metrics.status === 'absent') {
    await notify({ title: 'Employee absent', description: `${employee.first_name} ${employee.last_name || ''} marked absent on ${date}.`, type: 'attendance' });
  } else if (metrics.lateMinutes > 0) {
    await notify({ title: 'Late arrival', description: `${employee.first_name} ${employee.last_name || ''} was ${metrics.lateMinutes} min late on ${date}.`, type: 'attendance' });
  }

  return sendSuccess(res, { statusCode: 201, message: 'Attendance saved.', data: await Attendance.findById(record.id) });
});

// POST /api/attendance/bulk  — same status for many employees on a date
export const bulkAttendance = asyncHandler(async (req, res) => {
  const { date, status, employee_ids } = req.body;

  const affected = await withTransaction(async (conn) => {
    let count = 0;
    for (const employeeId of employee_ids) {
      const shift = await workReference(employeeId);
      const metrics = computeAttendance({ shift, status });
      await Attendance.upsert(
        {
          employee_id: employeeId,
          date,
          status,
          break_minutes: shift?.break_minutes ?? 0,
          working_minutes: metrics.workingMinutes,
          overtime_minutes: metrics.overtimeMinutes,
          late_minutes: metrics.lateMinutes,
          early_exit_minutes: metrics.earlyExitMinutes,
          shift_id: shift?.id || null,
          actor: req.user.id,
        },
        conn
      );
      await resyncEmployeePayrolls(employeeId, conn);
      count += 1;
    }
    return count;
  });

  await recordAudit({ req, action: 'attendance.bulk_mark', entity: 'attendance', description: `${affected} employee(s) → ${status} on ${date}` });
  return sendSuccess(res, { message: `Attendance marked for ${affected} employee(s).`, data: { affected } });
});

// PUT /api/attendance/:id  — correction (stores old → new + reason in audit)
export const correctAttendance = asyncHandler(async (req, res) => {
  const existing = await Attendance.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Attendance record not found.');

  const shift = await workReference(existing.employee_id);
  const checkIn = req.body.check_in ?? existing.check_in;
  const checkOut = req.body.check_out ?? existing.check_out;
  const breakMinutes = req.body.break_minutes ?? existing.break_minutes;

  const metrics = computeAttendance({
    checkIn, checkOut, breakMinutes, shift,
    status: req.body.status ?? existing.status,
  });

  const updated = await Attendance.applyCorrection(
    req.params.id,
    {
      status: metrics.status,
      check_in: checkIn,
      check_out: checkOut,
      break_minutes: breakMinutes,
      working_minutes: metrics.workingMinutes,
      overtime_minutes: metrics.overtimeMinutes,
      late_minutes: metrics.lateMinutes,
      early_exit_minutes: metrics.earlyExitMinutes,
      remarks: req.body.remarks ?? existing.remarks,
    },
    req.user.id
  );

  await withTransaction((conn) => resyncEmployeePayrolls(existing.employee_id, conn));

  const before = `${existing.status} (${existing.check_in || '--'}→${existing.check_out || '--'})`;
  const after = `${updated.status} (${updated.check_in || '--'}→${updated.check_out || '--'})`;
  await recordAudit({
    req, action: 'attendance.correct', entity: 'attendance', entityId: updated.id,
    description: `Correction: ${before} ⇒ ${after}. Reason: ${req.body.reason}`,
  });
  await notify({ title: 'Attendance corrected', description: `Record for ${updated.first_name} ${updated.last_name || ''} on ${updated.date} was corrected.`, type: 'attendance' });

  return sendSuccess(res, { message: 'Attendance corrected.', data: updated });
});

// DELETE /api/attendance/:id
export const deleteAttendance = asyncHandler(async (req, res) => {
  const existing = await Attendance.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Attendance record not found.');
  await Attendance.remove(req.params.id);
  await withTransaction((conn) => resyncEmployeePayrolls(existing.employee_id, conn));
  await recordAudit({ req, action: 'attendance.delete', entity: 'attendance', entityId: existing.id, description: `Deleted ${existing.date} for ${existing.employee_code}` });
  return sendSuccess(res, { message: 'Attendance record deleted.' });
});

// GET /api/attendance/summary?employee_id=&month=&year=
export const summary = asyncHandler(async (req, res) => {
  const employeeId = Number(req.query.employee_id);
  if (!employeeId) throw ApiError.badRequest('employee_id is required.');
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const data = await Attendance.monthlySummary({ employeeId, month, year, workingDays: Number(req.query.working_days) || null });
  return sendSuccess(res, { data, meta: { month, year } });
});

// GET /api/attendance/analytics
export const analytics = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const months = Math.min(24, Math.max(3, Number(req.query.months) || 6));

  const [dailyBreakdown, departmentAttendance, attendanceTrends] = await Promise.all([
    Attendance.dailyStatusBreakdown(req.query.date || today),
    Attendance.departmentAttendance(month, year),
    Attendance.trends(months),
  ]);
  return sendSuccess(res, { data: { dailyBreakdown, departmentAttendance, attendanceTrends } });
});
