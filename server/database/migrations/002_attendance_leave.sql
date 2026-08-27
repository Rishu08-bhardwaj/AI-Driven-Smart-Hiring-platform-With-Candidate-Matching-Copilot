-- ============================================================
--  Migration 002 — Attendance (shifts) & Leave (types, balances,
--  holidays, approval history). Extends Part 1/2 schema.
-- ============================================================
SET NAMES utf8mb4;

-- ── Shifts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  shift_name    VARCHAR(80)  NOT NULL,
  start_time    TIME         NOT NULL,
  end_time      TIME         NOT NULL,
  break_minutes INT          NOT NULL DEFAULT 0,
  grace_minutes INT          NOT NULL DEFAULT 0,
  weekly_off    VARCHAR(40)  NULL,           -- e.g. "sunday" or "saturday,sunday"
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  deleted_at    DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_shift_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- assign employees to shifts
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS shift_id INT UNSIGNED NULL AFTER shift,
  ADD KEY idx_emp_shift (shift_id);

-- ── Attendance: extend to enterprise fields ────────────────
ALTER TABLE attendance
  MODIFY COLUMN status ENUM(
    'present','absent','half_day','paid_leave','unpaid_leave',
    'holiday','weekend','wfh','late','early_exit'
  ) NOT NULL DEFAULT 'present',
  ADD COLUMN IF NOT EXISTS break_minutes      INT NOT NULL DEFAULT 0 AFTER check_out,
  ADD COLUMN IF NOT EXISTS working_minutes    INT NOT NULL DEFAULT 0 AFTER break_minutes,
  ADD COLUMN IF NOT EXISTS overtime_minutes   INT NOT NULL DEFAULT 0 AFTER working_minutes,
  ADD COLUMN IF NOT EXISTS late_minutes       INT NOT NULL DEFAULT 0 AFTER overtime_minutes,
  ADD COLUMN IF NOT EXISTS early_exit_minutes INT NOT NULL DEFAULT 0 AFTER late_minutes,
  ADD COLUMN IF NOT EXISTS shift_id           INT UNSIGNED NULL AFTER early_exit_minutes,
  ADD COLUMN IF NOT EXISTS created_by         INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS updated_by         INT UNSIGNED NULL;

-- ── Leave types (admin-defined) ────────────────────────────
CREATE TABLE IF NOT EXISTS leave_types (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(80)  NOT NULL,
  code         VARCHAR(20)  NOT NULL,
  default_days DECIMAL(5,1) NOT NULL DEFAULT 0,
  is_paid      TINYINT(1)   NOT NULL DEFAULT 1,
  status       ENUM('active','inactive') NOT NULL DEFAULT 'active',
  deleted_at   DATETIME     NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_type_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Leave balances (per employee / type / year) ────────────
CREATE TABLE IF NOT EXISTS leave_balances (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id   INT UNSIGNED NOT NULL,
  leave_type_id INT UNSIGNED NOT NULL,
  year          SMALLINT     NOT NULL,
  allocated     DECIMAL(6,1) NOT NULL DEFAULT 0,
  used          DECIMAL(6,1) NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_balance (employee_id, leave_type_id, year),
  CONSTRAINT fk_bal_employee FOREIGN KEY (employee_id)   REFERENCES employees (id)   ON DELETE CASCADE,
  CONSTRAINT fk_bal_type     FOREIGN KEY (leave_type_id) REFERENCES leave_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Holidays ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holidays (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  holiday_date  DATE         NOT NULL,
  description   VARCHAR(255) NULL,
  holiday_type  ENUM('national','state','company') NOT NULL DEFAULT 'company',
  recurring     TINYINT(1)   NOT NULL DEFAULT 0,
  applicable_departments VARCHAR(255) NULL,   -- CSV of dept ids; NULL = all
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  deleted_at    DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_holiday_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Leaves: extend to typed leaves + attachments ───────────
ALTER TABLE leaves
  MODIFY COLUMN leave_type ENUM('casual','sick','earned','unpaid','maternity','paternity','other') NULL,
  ADD COLUMN IF NOT EXISTS leave_type_id     INT UNSIGNED NULL AFTER leave_type,
  ADD COLUMN IF NOT EXISTS half_day          TINYINT(1) NOT NULL DEFAULT 0 AFTER total_days,
  ADD COLUMN IF NOT EXISTS attachment_url    VARCHAR(255) NULL AFTER reason,
  ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(60) NULL AFTER attachment_url,
  ADD COLUMN IF NOT EXISTS remarks           VARCHAR(500) NULL AFTER approved_at,
  ADD KEY idx_leave_type_id (leave_type_id);

-- ── Leave approval history ─────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_approvals (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  leave_id   INT UNSIGNED NOT NULL,
  action     ENUM('applied','approved','rejected','cancelled') NOT NULL,
  actor_id   INT UNSIGNED NULL,
  remarks    VARCHAR(500) NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_approval_leave (leave_id),
  CONSTRAINT fk_approval_leave FOREIGN KEY (leave_id) REFERENCES leaves (id) ON DELETE CASCADE,
  CONSTRAINT fk_approval_actor FOREIGN KEY (actor_id) REFERENCES users (id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Foreign keys for the new reference columns ─────────────
ALTER TABLE employees   ADD CONSTRAINT fk_emp_shift   FOREIGN KEY (shift_id)      REFERENCES shifts (id)      ON DELETE SET NULL;
ALTER TABLE attendance  ADD CONSTRAINT fk_att_shift   FOREIGN KEY (shift_id)      REFERENCES shifts (id)      ON DELETE SET NULL;
ALTER TABLE attendance  ADD CONSTRAINT fk_att_creator FOREIGN KEY (created_by)    REFERENCES users (id)       ON DELETE SET NULL;
ALTER TABLE attendance  ADD CONSTRAINT fk_att_updater FOREIGN KEY (updated_by)    REFERENCES users (id)       ON DELETE SET NULL;
ALTER TABLE leaves      ADD CONSTRAINT fk_leave_type  FOREIGN KEY (leave_type_id) REFERENCES leave_types (id) ON DELETE SET NULL;
