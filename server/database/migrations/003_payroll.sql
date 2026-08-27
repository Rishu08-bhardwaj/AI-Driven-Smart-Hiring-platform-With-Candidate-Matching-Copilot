-- ============================================================
--  Migration 003 — Payroll & Salary Management (Part 3B)
--  The Part-1 `salary` table becomes the rich monthly `payroll`
--  record. Adds salary profiles, components, advances, loans,
--  payroll history and settings. Money columns use DECIMAL(12,2).
-- ============================================================
SET NAMES utf8mb4;

-- ── Rename salary → payroll (FKs follow automatically in InnoDB) ──
RENAME TABLE salary TO payroll;

-- ── Extend payroll with full earnings/deductions breakdown ──
ALTER TABLE payroll
  MODIFY COLUMN payment_status ENUM('generated','pending','partial','paid','cancelled','refunded')
    NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS basic              DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER salary_amount,
  ADD COLUMN IF NOT EXISTS house_allowance    DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER basic,
  ADD COLUMN IF NOT EXISTS medical_allowance  DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER house_allowance,
  ADD COLUMN IF NOT EXISTS travel_allowance   DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER medical_allowance,
  ADD COLUMN IF NOT EXISTS food_allowance     DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER travel_allowance,
  ADD COLUMN IF NOT EXISTS bonus_total        DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER food_allowance,
  ADD COLUMN IF NOT EXISTS overtime_hours     DECIMAL(7,2)  NOT NULL DEFAULT 0 AFTER bonus_total,
  ADD COLUMN IF NOT EXISTS overtime_amount    DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER overtime_hours,
  ADD COLUMN IF NOT EXISTS incentives         DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER overtime_amount,
  ADD COLUMN IF NOT EXISTS commission         DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER incentives,
  ADD COLUMN IF NOT EXISTS other_earnings     DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER commission,
  ADD COLUMN IF NOT EXISTS gross_amount       DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER other_earnings,
  ADD COLUMN IF NOT EXISTS tax                DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER gross_amount,
  ADD COLUMN IF NOT EXISTS pf                 DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER tax,
  ADD COLUMN IF NOT EXISTS esi                DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER pf,
  ADD COLUMN IF NOT EXISTS advance_recovery   DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER esi,
  ADD COLUMN IF NOT EXISTS loan_recovery      DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER advance_recovery,
  ADD COLUMN IF NOT EXISTS late_penalty       DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER loan_recovery,
  ADD COLUMN IF NOT EXISTS absent_deduction   DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER late_penalty,
  ADD COLUMN IF NOT EXISTS halfday_deduction  DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER absent_deduction,
  ADD COLUMN IF NOT EXISTS other_deductions   DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER halfday_deduction,
  ADD COLUMN IF NOT EXISTS total_deductions   DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER other_deductions,
  ADD COLUMN IF NOT EXISTS net_amount         DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total_deductions,
  ADD COLUMN IF NOT EXISTS previous_pending   DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER net_amount,
  ADD COLUMN IF NOT EXISTS outstanding        DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER remaining_amount,
  ADD COLUMN IF NOT EXISTS present_days       DECIMAL(5,1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absent_days        DECIMAL(5,1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS half_days          DECIMAL(5,1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_leave_days    DECIMAL(5,1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_leave_days  DECIMAL(5,1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS working_days       DECIMAL(5,1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_date  DATE          NULL,
  ADD COLUMN IF NOT EXISTS locked             TINYINT(1)    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_by          INT UNSIGNED  NULL,
  ADD COLUMN IF NOT EXISTS locked_at          DATETIME      NULL,
  ADD COLUMN IF NOT EXISTS generated_by       INT UNSIGNED  NULL;

ALTER TABLE payroll ADD CONSTRAINT fk_payroll_locker FOREIGN KEY (locked_by) REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE payroll ADD CONSTRAINT fk_payroll_generator FOREIGN KEY (generated_by) REFERENCES users (id) ON DELETE SET NULL;

-- ── Salary payments: immutable ledger, richer fields ───────
ALTER TABLE salary_payments
  ADD COLUMN IF NOT EXISTS reference_number VARCHAR(120) NULL AFTER transaction_id,
  ADD COLUMN IF NOT EXISTS remaining_after  DECIMAL(12,2) NULL AFTER amount;

-- ── Salary profiles (per employee payroll config) ──────────
CREATE TABLE IF NOT EXISTS salary_profiles (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id        INT UNSIGNED NOT NULL,
  base_salary        DECIMAL(12,2) NOT NULL DEFAULT 0,
  salary_type        ENUM('monthly','weekly','daily','hourly','contract') NOT NULL DEFAULT 'monthly',
  salary_cycle       ENUM('monthly','weekly','daily','hourly') NOT NULL DEFAULT 'monthly',
  payment_day        TINYINT      NULL,             -- day of month salary is paid
  house_allowance    DECIMAL(12,2) NOT NULL DEFAULT 0,
  medical_allowance  DECIMAL(12,2) NOT NULL DEFAULT 0,
  travel_allowance   DECIMAL(12,2) NOT NULL DEFAULT 0,
  food_allowance     DECIMAL(12,2) NOT NULL DEFAULT 0,
  overtime_rate      DECIMAL(10,2) NOT NULL DEFAULT 0,  -- per hour; 0 = derive from base
  tax_percent        DECIMAL(5,2)  NOT NULL DEFAULT 0,
  pf_percent         DECIMAL(5,2)  NOT NULL DEFAULT 0,
  esi_percent        DECIMAL(5,2)  NOT NULL DEFAULT 0,
  bank_name          VARCHAR(120) NULL,
  account_number     VARCHAR(40)  NULL,
  ifsc               VARCHAR(20)  NULL,
  upi_id             VARCHAR(120) NULL,
  tax_number         VARCHAR(40)  NULL,
  pf_number          VARCHAR(40)  NULL,
  esi_number         VARCHAR(40)  NULL,
  bonus_eligible     TINYINT(1)   NOT NULL DEFAULT 1,
  overtime_eligible  TINYINT(1)   NOT NULL DEFAULT 1,
  advance_eligible   TINYINT(1)   NOT NULL DEFAULT 1,
  loan_eligible      TINYINT(1)   NOT NULL DEFAULT 1,
  deduction_rules    JSON         NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_profile_employee (employee_id),
  CONSTRAINT fk_profile_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Salary components (line items per payroll) ─────────────
CREATE TABLE IF NOT EXISTS salary_components (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  payroll_id  INT UNSIGNED NOT NULL,
  kind        ENUM('earning','deduction') NOT NULL,
  category    VARCHAR(60)  NOT NULL,          -- e.g. performance_bonus, late_penalty
  label       VARCHAR(120) NOT NULL,
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  remarks     VARCHAR(255) NULL,
  created_by  INT UNSIGNED NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_component_payroll (payroll_id),
  CONSTRAINT fk_component_payroll FOREIGN KEY (payroll_id) REFERENCES payroll (id) ON DELETE CASCADE,
  CONSTRAINT fk_component_user    FOREIGN KEY (created_by) REFERENCES users (id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Salary advances ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_advances (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id        INT UNSIGNED NOT NULL,
  amount             DECIMAL(12,2) NOT NULL,
  request_date       DATE         NOT NULL,
  reason             VARCHAR(500) NULL,
  status             ENUM('pending','approved','rejected','closed') NOT NULL DEFAULT 'pending',
  approved_by        INT UNSIGNED NULL,
  approved_at        DATETIME     NULL,
  recovery_per_month DECIMAL(12,2) NOT NULL DEFAULT 0,
  recovered          DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_advance_employee (employee_id),
  KEY idx_advance_status (status),
  CONSTRAINT fk_advance_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_advance_approver FOREIGN KEY (approved_by) REFERENCES users (id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Employee loans ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_loans (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id     INT UNSIGNED NOT NULL,
  principal       DECIMAL(12,2) NOT NULL,
  interest_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_payable   DECIMAL(12,2) NOT NULL,
  emi             DECIMAL(12,2) NOT NULL,
  start_month     TINYINT      NOT NULL,
  start_year      SMALLINT     NOT NULL,
  recovered       DECIMAL(12,2) NOT NULL DEFAULT 0,
  status          ENUM('active','closed','cancelled') NOT NULL DEFAULT 'active',
  created_by      INT UNSIGNED NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_loan_employee (employee_id),
  KEY idx_loan_status (status),
  CONSTRAINT fk_loan_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_loan_user     FOREIGN KEY (created_by) REFERENCES users (id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Payroll history (immutable per-payroll trail) ──────────
CREATE TABLE IF NOT EXISTS payroll_history (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  payroll_id INT UNSIGNED NOT NULL,
  action     VARCHAR(60)  NOT NULL,
  old_value  TEXT         NULL,
  new_value  TEXT         NULL,
  actor_id   INT UNSIGNED NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_phist_payroll (payroll_id),
  CONSTRAINT fk_phist_payroll FOREIGN KEY (payroll_id) REFERENCES payroll (id) ON DELETE CASCADE,
  CONSTRAINT fk_phist_actor   FOREIGN KEY (actor_id)  REFERENCES users (id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Payroll settings (singleton) ───────────────────────────
CREATE TABLE IF NOT EXISTS payroll_settings (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  overtime_rate_default DECIMAL(10,2) NOT NULL DEFAULT 0,
  overtime_multiplier   DECIMAL(4,2)  NOT NULL DEFAULT 1,
  late_penalty_per_min  DECIMAL(8,2)  NOT NULL DEFAULT 0,
  early_exit_penalty_per_min DECIMAL(8,2) NOT NULL DEFAULT 0,
  absent_deduction_mode ENUM('per_day_basic','none') NOT NULL DEFAULT 'per_day_basic',
  halfday_deduction_factor DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  -- Attendance pay policy: % of a day's salary the employee KEEPS for each status.
  pay_pct_absent        DECIMAL(5,2)  NOT NULL DEFAULT 0,
  pay_pct_unpaid_leave  DECIMAL(5,2)  NOT NULL DEFAULT 0,
  pay_pct_half_day      DECIMAL(5,2)  NOT NULL DEFAULT 50,
  default_tax_percent   DECIMAL(5,2)  NOT NULL DEFAULT 0,
  default_pf_percent    DECIMAL(5,2)  NOT NULL DEFAULT 0,
  default_esi_percent   DECIMAL(5,2)  NOT NULL DEFAULT 0,
  default_working_days  TINYINT       NOT NULL DEFAULT 26,
  payday                TINYINT       NOT NULL DEFAULT 1,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
