import { body } from 'express-validator';

export const leaveTypeRules = [
  body('name').isString().trim().notEmpty().withMessage('Leave type name is required.').isLength({ max: 80 }),
  body('code').isString().trim().notEmpty().withMessage('Code is required.').isLength({ max: 20 }),
  body('default_days').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Default days must be ≥ 0.'),
  body('is_paid').optional().isBoolean(),
  body('status').optional().isIn(['active', 'inactive']),
];

export const applyLeaveRules = [
  body('employee_id').isInt({ min: 1 }).withMessage('Valid employee is required.'),
  body('leave_type_id').isInt({ min: 1 }).withMessage('Valid leave type is required.'),
  body('start_date').isISO8601().withMessage('Valid start date is required.'),
  body('end_date').isISO8601().withMessage('Valid end date is required.'),
  body('half_day').optional().isBoolean(),
  body('reason').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('emergency_contact').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 60 }),
];

export const decisionRules = [
  body('status').isIn(['approved', 'rejected']).withMessage('Decision must be approved or rejected.'),
  body('remarks').optional({ nullable: true }).isString().isLength({ max: 500 }),
];

// Self-service apply: employee_id is injected from the session, not the body.
export const selfApplyLeaveRules = [
  body('leave_type_id').isInt({ min: 1 }).withMessage('Valid leave type is required.'),
  body('start_date').isISO8601().withMessage('Valid start date is required.'),
  body('end_date').isISO8601().withMessage('Valid end date is required.'),
  body('half_day').optional().isBoolean(),
  body('reason').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('emergency_contact').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 60 }),
];

export const holidayRules = [
  body('name').isString().trim().notEmpty().withMessage('Holiday name is required.').isLength({ max: 120 }),
  body('holiday_date').isISO8601().withMessage('Valid holiday date is required.'),
  body('description').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('holiday_type').optional().isIn(['national', 'state', 'company']),
  body('recurring').optional().isBoolean(),
  body('status').optional().isIn(['active', 'inactive']),
];

export const allocationRules = [
  body('employee_id').isInt({ min: 1 }),
  body('leave_type_id').isInt({ min: 1 }),
  body('year').isInt({ min: 2000, max: 2100 }),
  body('allocated').isFloat({ min: 0 }),
];
