import { body } from 'express-validator';
import { ROLE_VALUES } from '../../controllers/user.controller.js';

export const createUserRules = [
  body('name').isString().trim().notEmpty().withMessage('Name is required.').isLength({ max: 120 }),
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail().isLength({ max: 160 }),
  body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  body('role').optional().isIn(ROLE_VALUES).withMessage('Invalid role.'),
  body('status').optional().isIn(['active', 'inactive']),
];

export const updateUserRules = [
  body('name').optional().isString().trim().notEmpty().isLength({ max: 120 }),
  body('role').optional().isIn(ROLE_VALUES).withMessage('Invalid role.'),
  body('status').optional().isIn(['active', 'inactive']),
];

export const passwordRules = [
  body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
];
