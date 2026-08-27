import { body } from 'express-validator';

const strongPassword = body('password')
  .isString()
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters.')
  .matches(/[a-z]/)
  .withMessage('Password must contain a lowercase letter.')
  .matches(/[A-Z]/)
  .withMessage('Password must contain an uppercase letter.')
  .matches(/[0-9]/)
  .withMessage('Password must contain a number.');

export const loginRules = [
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required.'),
  body('remember').optional().isBoolean().withMessage('Remember must be true or false.'),
];

export const forgotRules = [
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
];

export const resetRules = [
  body('token').isString().notEmpty().withMessage('Reset token is required.'),
  strongPassword,
];
