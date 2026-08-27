-- ─────────────────────────────────────────────────────────────
-- 004: Salary-advance disbursement (pay) flow
-- Lets an accountant PAY an advance with an arbitrary amount and
-- have it reflect against the employee's current payroll.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE salary_advances
  MODIFY status ENUM('pending','approved','rejected','paid','closed') NOT NULL DEFAULT 'pending',
  ADD COLUMN paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER recovered,
  ADD COLUMN paid_at     DATETIME     NULL             AFTER paid_amount,
  ADD COLUMN paid_by     INT UNSIGNED NULL             AFTER paid_at,
  ADD COLUMN payroll_id  INT UNSIGNED NULL             AFTER paid_by,
  ADD KEY idx_adv_paid_by (paid_by),
  ADD KEY idx_adv_payroll (payroll_id),
  ADD CONSTRAINT fk_adv_paid_by FOREIGN KEY (paid_by)    REFERENCES users (id)   ON DELETE SET NULL,
  ADD CONSTRAINT fk_adv_payroll FOREIGN KEY (payroll_id) REFERENCES payroll (id) ON DELETE SET NULL;
