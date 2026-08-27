-- ─────────────────────────────────────────────────────────────
-- 005: Employee-initiated loan requests
-- Employees request a loan (amount + tenure + reason); the accountant
-- approves with proper interest % and tenure, which computes the total
-- payable and monthly EMI, then the loan is recovered via payroll.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE employee_loans
  MODIFY status ENUM('pending','active','rejected','closed','cancelled') NOT NULL DEFAULT 'pending',
  MODIFY total_payable DECIMAL(12,2) NULL,
  MODIFY emi           DECIMAL(12,2) NULL,
  MODIFY start_month   TINYINT       NULL,
  MODIFY start_year    SMALLINT      NULL,
  ADD COLUMN requested_amount DECIMAL(12,2)     NULL AFTER principal,
  ADD COLUMN tenure_months    SMALLINT UNSIGNED NULL AFTER emi,
  ADD COLUMN reason           VARCHAR(500)      NULL AFTER tenure_months,
  ADD COLUMN request_date     DATE              NULL AFTER reason,
  ADD COLUMN approved_by      INT UNSIGNED      NULL AFTER created_by,
  ADD COLUMN approved_at      DATETIME          NULL AFTER approved_by,
  ADD KEY idx_loan_approved_by (approved_by),
  ADD CONSTRAINT fk_loan_approved_by FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL;
