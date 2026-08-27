import { body } from 'express-validator';

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'intern', 'contract', 'temporary', 'freelancer'];
const STATUSES = ['active', 'inactive', 'on_leave', 'resigned', 'terminated', 'retired'];
const SALARY_TYPES = ['monthly', 'weekly', 'daily', 'hourly'];

/** Shared field rules; on create, name+salary required, others optional. */
export const employeeRules = [
  body('first_name').isString().trim().notEmpty().withMessage('First name is required.').isLength({ max: 80 }),
  body('last_name').optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
  body('middle_name').optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email.').normalizeEmail(),
  body('phone').optional({ nullable: true, checkFalsy: true })
    .matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Invalid phone number.'),
  body('alternate_phone').optional({ nullable: true, checkFalsy: true })
    .matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Invalid alternate phone.'),
  body('gender').optional({ nullable: true, checkFalsy: true }).isIn(['male', 'female', 'other']),
  body('dob').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Invalid date of birth.'),
  body('joining_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Invalid joining date.'),
  body('salary').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Salary must be a positive number.'),
  body('salary_type').optional({ nullable: true, checkFalsy: true }).isIn(SALARY_TYPES),
  body('employment_type').optional({ nullable: true, checkFalsy: true }).isIn(EMPLOYMENT_TYPES),
  body('status').optional({ nullable: true, checkFalsy: true }).isIn(STATUSES),
  body('department_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('designation_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('manager_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('zip_code').optional({ nullable: true, checkFalsy: true }).isLength({ max: 20 }),
];

export const statusRules = [
  body('status').isIn(STATUSES).withMessage('Invalid employee status.'),
];

export const bulkRules = [
  body('action').isString().notEmpty().withMessage('Action is required.'),
  body('ids').isArray({ min: 1 }).withMessage('At least one employee must be selected.'),
  body('ids.*').isInt({ min: 1 }).withMessage('Invalid employee id.'),
];
