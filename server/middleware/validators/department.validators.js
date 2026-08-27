import { body } from 'express-validator';

export const departmentRules = [
  body('department_name')
    .isString().trim().notEmpty().withMessage('Department name is required.')
    .isLength({ max: 120 }).withMessage('Department name is too long.'),
  body('department_code').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
  body('description').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('head_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Invalid department head.'),
  body('status').optional().isIn(['active', 'archived', 'inactive']),
];

export const designationRules = [
  body('designation_name')
    .isString().trim().notEmpty().withMessage('Designation name is required.')
    .isLength({ max: 120 }).withMessage('Designation name is too long.'),
  body('department_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Invalid department.'),
  body('level').optional({ nullable: true }).isString().isLength({ max: 40 }),
  body('description').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('status').optional().isIn(['active', 'archived', 'inactive']),
];
