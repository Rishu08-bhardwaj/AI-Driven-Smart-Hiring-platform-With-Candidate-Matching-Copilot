import { body } from 'express-validator';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const STATUSES = ['present', 'absent', 'half_day', 'paid_leave', 'unpaid_leave', 'holiday', 'weekend', 'wfh', 'late', 'early_exit'];

export const shiftRules = [
  body('shift_name').isString().trim().notEmpty().withMessage('Shift name is required.').isLength({ max: 80 }),
  body('start_time').matches(TIME_RE).withMessage('Start time must be HH:MM.'),
  body('end_time').matches(TIME_RE).withMessage('End time must be HH:MM.'),
  body('break_minutes').optional({ nullable: true }).isInt({ min: 0, max: 480 }),
  body('grace_minutes').optional({ nullable: true }).isInt({ min: 0, max: 120 }),
  body('weekly_off').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 40 }),
  body('status').optional().isIn(['active', 'inactive']),
];

export const markAttendanceRules = [
  body('employee_id').isInt({ min: 1 }).withMessage('Valid employee is required.'),
  body('date').isISO8601().withMessage('Valid date is required.'),
  body('status').optional({ nullable: true, checkFalsy: true }).isIn(STATUSES).withMessage('Invalid attendance status.'),
  body('check_in').optional({ nullable: true, checkFalsy: true }).matches(TIME_RE).withMessage('Check-in must be HH:MM.'),
  body('check_out').optional({ nullable: true, checkFalsy: true }).matches(TIME_RE).withMessage('Check-out must be HH:MM.'),
  body('break_minutes').optional({ nullable: true }).isInt({ min: 0, max: 480 }),
  body('remarks').optional({ nullable: true }).isString().isLength({ max: 255 }),
];

export const bulkAttendanceRules = [
  body('date').isISO8601().withMessage('Valid date is required.'),
  body('status').isIn(STATUSES).withMessage('Invalid attendance status.'),
  body('employee_ids').isArray({ min: 1 }).withMessage('Select at least one employee.'),
  body('employee_ids.*').isInt({ min: 1 }).withMessage('Invalid employee id.'),
];

export const correctionRules = [
  body('reason').isString().trim().notEmpty().withMessage('A correction reason is required.').isLength({ max: 255 }),
  body('status').optional({ nullable: true, checkFalsy: true }).isIn(STATUSES),
  body('check_in').optional({ nullable: true, checkFalsy: true }).matches(TIME_RE),
  body('check_out').optional({ nullable: true, checkFalsy: true }).matches(TIME_RE),
  body('break_minutes').optional({ nullable: true }).isInt({ min: 0, max: 480 }),
];
