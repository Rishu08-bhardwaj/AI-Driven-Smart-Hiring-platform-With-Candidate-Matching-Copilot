import { body } from 'express-validator';

export const periodRules = [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be 1–12.'),
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('Valid year is required.'),
  body('employee_ids').optional({ nullable: true }).isArray().withMessage('employee_ids must be an array.'),
  body('employee_ids.*').optional().isInt({ min: 1 }),
];

export const payRules = [
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.'),
  body('payment_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body('payment_method').optional({ nullable: true, checkFalsy: true })
    .isIn(['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'online', 'other']).withMessage('Invalid payment method.'),
  body('transaction_id').optional({ nullable: true }).isString().isLength({ max: 120 }),
  body('reference_number').optional({ nullable: true }).isString().isLength({ max: 120 }),
  body('remarks').optional({ nullable: true }).isString().isLength({ max: 255 }),
];

export const selfAdvanceRules = [
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.'),
  body('reason').isString().trim().notEmpty().withMessage('Please provide a reason.').isLength({ max: 500 }),
];

export const componentRules = [
  body('kind').isIn(['earning', 'deduction']).withMessage('Kind must be earning or deduction.'),
  body('category').isString().trim().notEmpty().withMessage('Category is required.').isLength({ max: 60 }),
  body('label').isString().trim().notEmpty().withMessage('Label is required.').isLength({ max: 120 }),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.'),
  body('remarks').optional({ nullable: true }).isString().isLength({ max: 255 }),
];

export const profileRules = [
  body('base_salary').optional({ nullable: true }).isFloat({ min: 0 }),
  body('salary_type').optional({ nullable: true, checkFalsy: true }).isIn(['monthly', 'weekly', 'daily', 'hourly', 'contract']),
  body('salary_cycle').optional({ nullable: true, checkFalsy: true }).isIn(['monthly', 'weekly', 'daily', 'hourly']),
  body('payment_day').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: 31 }),
  body('house_allowance').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('House allowance must be ≥ 0.'),
  body('medical_allowance').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Medical allowance must be ≥ 0.'),
  body('travel_allowance').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Travel allowance must be ≥ 0.'),
  body('food_allowance').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Food allowance must be ≥ 0.'),
  body('overtime_rate').optional({ nullable: true }).isFloat({ min: 0 }),
  body('tax_percent').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('pf_percent').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('esi_percent').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('bonus_eligible').optional().isBoolean(),
  body('overtime_eligible').optional().isBoolean(),
  body('advance_eligible').optional().isBoolean(),
  body('loan_eligible').optional().isBoolean(),
];

export const advanceRules = [
  body('employee_id').isInt({ min: 1 }).withMessage('Valid employee is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.'),
  body('request_date').isISO8601().withMessage('Valid request date is required.'),
  body('recovery_per_month').optional({ nullable: true }).isFloat({ min: 0 }),
  body('reason').optional({ nullable: true }).isString().isLength({ max: 500 }),
];

export const loanRules = [
  body('employee_id').isInt({ min: 1 }).withMessage('Valid employee is required.'),
  body('principal').isFloat({ gt: 0 }).withMessage('Principal must be greater than zero.'),
  body('interest_percent').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('tenure_months').isInt({ min: 1, max: 600 }).withMessage('Tenure (months) is required.'),
  body('emi').optional({ nullable: true, checkFalsy: true }).isFloat({ gt: 0 }),
  body('start_month').isInt({ min: 1, max: 12 }),
  body('start_year').isInt({ min: 2000, max: 2100 }),
];

// Accountant approves an employee's loan request with final terms.
export const approveLoanRules = [
  body('principal').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Principal must be greater than zero.'),
  body('interest_percent').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('tenure_months').isInt({ min: 1, max: 600 }).withMessage('Tenure (months) is required.'),
  body('start_month').isInt({ min: 1, max: 12 }).withMessage('Start month is required.'),
  body('start_year').isInt({ min: 2000, max: 2100 }).withMessage('Start year is required.'),
];

// Employee-initiated loan request.
export const selfLoanRules = [
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.'),
  body('tenure_months').isInt({ min: 1, max: 600 }).withMessage('Preferred tenure (months) is required.'),
  body('reason').isString().trim().notEmpty().withMessage('Please provide a reason.').isLength({ max: 500 }),
];
