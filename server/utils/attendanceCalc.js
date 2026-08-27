/**
 * Attendance time math: working hours, lateness, early exit and overtime,
 * derived from a shift definition and the employee's check-in / check-out.
 *
 * All times are "HH:MM" or "HH:MM:SS" strings on the same calendar day.
 * Overnight shifts (end < start) are supported by rolling end past midnight.
 */

/** Parse "HH:MM[:SS]" into minutes-since-midnight. Returns null if blank. */
export function toMinutes(time) {
  if (!time) return null;
  const [h, m] = String(time).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Format minutes-since-midnight back to "HH:MM:SS". */
export function toTime(minutes) {
  if (minutes == null) return null;
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/**
 * Compute derived attendance metrics.
 * @param {object} p
 * @param {string} [p.checkIn]
 * @param {string} [p.checkOut]
 * @param {number} [p.breakMinutes]
 * @param {object} [p.shift]   { start_time, end_time, grace_minutes, break_minutes }
 * @param {string} [p.status]  optional explicit status; auto-derived if absent
 * @returns {{workingMinutes,overtimeMinutes,lateMinutes,earlyExitMinutes,status}}
 */
export function computeAttendance({ checkIn, checkOut, breakMinutes, shift, status }) {
  const inMin = toMinutes(checkIn);
  let outMin = toMinutes(checkOut);
  const brk = Number.isFinite(breakMinutes) ? breakMinutes : shift?.break_minutes ?? 0;

  let workingMinutes = 0;
  let overtimeMinutes = 0;
  let lateMinutes = 0;
  let earlyExitMinutes = 0;

  if (inMin != null && outMin != null) {
    if (outMin < inMin) outMin += 1440; // crossed midnight
    workingMinutes = Math.max(0, outMin - inMin - brk);
  }

  if (shift) {
    const shiftStart = toMinutes(shift.start_time);
    let shiftEnd = toMinutes(shift.end_time);
    if (shiftEnd != null && shiftStart != null && shiftEnd < shiftStart) shiftEnd += 1440;
    const grace = shift.grace_minutes ?? 0;

    if (inMin != null && shiftStart != null) {
      const lateBy = inMin - (shiftStart + grace);
      lateMinutes = lateBy > 0 ? lateBy : 0;
    }
    if (outMin != null && shiftEnd != null) {
      const earlyBy = shiftEnd - outMin;
      earlyExitMinutes = earlyBy > 0 ? earlyBy : 0;
      const otBy = outMin - shiftEnd;
      overtimeMinutes = otBy > 0 ? otBy : 0;
    }
  }

  // Auto-derive a status when one wasn't explicitly provided.
  let finalStatus = status;
  if (!finalStatus) {
    if (inMin == null && outMin == null) finalStatus = 'absent';
    else if (lateMinutes > 0) finalStatus = 'late';
    else if (earlyExitMinutes > 0) finalStatus = 'early_exit';
    else finalStatus = 'present';
  }

  return { workingMinutes, overtimeMinutes, lateMinutes, earlyExitMinutes, status: finalStatus };
}
