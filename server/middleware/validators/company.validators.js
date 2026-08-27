import { body } from 'express-validator';

export const companyRules = [
  body('company_name').optional().isString().trim().notEmpty().withMessage('Company name cannot be empty.').isLength({ max: 160 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email.'),
  body('phone').optional({ nullable: true }).isString().isLength({ max: 40 }),
  body('address').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('gst_number').optional({ nullable: true }).isString().isLength({ max: 40 }),
  body('website').optional({ nullable: true }).isString().isLength({ max: 160 }),
  body('currency').optional().isString().isLength({ max: 10 }),
  body('timezone').optional().isString().isLength({ max: 60 }),
  body('salary_cycle').optional().isIn(['monthly', 'weekly', 'daily', 'hourly']),
  body('working_days').optional({ nullable: true }).isInt({ min: 1, max: 7 }),
  body('default_leave_count').optional({ nullable: true }).isInt({ min: 0 }),
  body('shift_start').optional({ nullable: true, checkFalsy: true }).matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Invalid shift start time.'),
  body('shift_end').optional({ nullable: true, checkFalsy: true }).matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Invalid shift end time.'),
  body('grace_minutes').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0, max: 240 }).withMessage('Grace must be 0–240 minutes.'),
  body('overtime_multiplier').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 10 }).withMessage('Overtime rate must be between 0 and 10× hourly.'),
  // Attendance pay policy
  body('pay_pct_absent').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('Absent paid % must be 0–100.'),
  body('pay_pct_unpaid_leave').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('Unpaid-leave paid % must be 0–100.'),
  body('pay_pct_half_day').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('Half-day paid % must be 0–100.'),
  body('late_penalty_per_min').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Late penalty must be ≥ 0.'),
  body('early_exit_penalty_per_min').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Early-exit penalty must be ≥ 0.'),
];
