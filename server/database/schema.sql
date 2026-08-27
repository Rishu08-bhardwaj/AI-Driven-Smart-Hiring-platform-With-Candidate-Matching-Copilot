-- ============================================================
--  HRMS — Business Employee & Payroll Management System
--  MySQL / MariaDB schema
--  Charset: utf8mb4, Engine: InnoDB (FK + transactions)
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── Users (auth + roles) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(160)  NOT NULL,
  password      VARCHAR(255)  NOT NULL,
  role          ENUM('super_admin','admin','hr','accountant','employee') NOT NULL DEFAULT 'employee',
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  last_login_at DATETIME      NULL,
  deleted_at    DATETIME      NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Refresh tokens (token rotation / session) ──────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  CHAR(64)     NOT NULL,
  expires_at  DATETIME     NOT NULL,
  revoked_at  DATETIME     NULL,
  user_agent  VARCHAR(255) NULL,
  ip_address  VARCHAR(64)  NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  KEY idx_refresh_user (user_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Password resets ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  CHAR(64)     NOT NULL,
  expires_at  DATETIME     NOT NULL,
  used_at     DATETIME     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pwreset_user (user_id),
  KEY idx_pwreset_token (token_hash),
  CONSTRAINT fk_pwreset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Company settings ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_name        VARCHAR(160) NOT NULL,
  logo_url            VARCHAR(255) NULL,
  address             VARCHAR(255) NULL,
  phone               VARCHAR(40)  NULL,
  email               VARCHAR(160) NULL,
  gst_number          VARCHAR(40)  NULL,
  website             VARCHAR(160) NULL,
  currency            VARCHAR(10)  NOT NULL DEFAULT 'INR',
  timezone            VARCHAR(60)  NOT NULL DEFAULT 'Asia/Kolkata',
  salary_cycle        ENUM('monthly','weekly','daily','hourly') NOT NULL DEFAULT 'monthly',
  working_days        TINYINT      NOT NULL DEFAULT 6,
  office_start        TIME         NULL,
  office_end          TIME         NULL,
  default_leave_count INT          NOT NULL DEFAULT 12,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Departments ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_name VARCHAR(120) NOT NULL,
  department_code VARCHAR(40)  NULL,
  description     VARCHAR(500) NULL,
  head_id         INT UNSIGNED NULL,
  status          ENUM('active','archived','inactive') NOT NULL DEFAULT 'active',
  deleted_at      DATETIME     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dept_code (department_code),
  KEY idx_dept_status (status),
  KEY idx_dept_head (head_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Designations ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS designations (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  designation_name VARCHAR(120) NOT NULL,
  department_id    INT UNSIGNED NULL,
  level            VARCHAR(40)  NULL,
  description      VARCHAR(500) NULL,
  status           ENUM('active','archived','inactive') NOT NULL DEFAULT 'active',
  deleted_at       DATETIME     NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_desig_status (status),
  KEY idx_desig_dept (department_id),
  CONSTRAINT fk_desig_dept FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Employees ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_code         VARCHAR(40)  NOT NULL,
  first_name            VARCHAR(80)  NOT NULL,
  middle_name           VARCHAR(80)  NULL,
  last_name             VARCHAR(80)  NULL,
  photo_url             VARCHAR(255) NULL,
  gender                ENUM('male','female','other') NULL,
  dob                   DATE         NULL,
  blood_group           VARCHAR(8)   NULL,
  marital_status        ENUM('single','married','divorced','widowed') NULL,
  nationality           VARCHAR(80)  NULL,
  -- contact
  phone                 VARCHAR(40)  NULL,
  alternate_phone       VARCHAR(40)  NULL,
  email                 VARCHAR(160) NULL,
  emergency_name        VARCHAR(120) NULL,
  emergency_phone       VARCHAR(40)  NULL,
  emergency_relation    VARCHAR(60)  NULL,
  current_address       VARCHAR(255) NULL,
  permanent_address     VARCHAR(255) NULL,
  city                  VARCHAR(80)  NULL,
  state                 VARCHAR(80)  NULL,
  country               VARCHAR(80)  NULL,
  zip_code              VARCHAR(20)  NULL,
  -- employment
  joining_date          DATE         NULL,
  department_id         INT UNSIGNED NULL,
  designation_id        INT UNSIGNED NULL,
  manager_id            INT UNSIGNED NULL,
  work_location         VARCHAR(120) NULL,
  shift                 VARCHAR(60)  NULL,
  employment_type       ENUM('full_time','part_time','intern','contract','temporary','freelancer') NOT NULL DEFAULT 'full_time',
  probation_period      INT          NULL,
  status                ENUM('active','inactive','on_leave','resigned','terminated','retired') NOT NULL DEFAULT 'active',
  -- salary
  salary                DECIMAL(12,2) NOT NULL DEFAULT 0,
  salary_type           ENUM('monthly','weekly','daily','hourly') NOT NULL DEFAULT 'monthly',
  salary_cycle          ENUM('monthly','weekly','daily','hourly') NOT NULL DEFAULT 'monthly',
  bank_name             VARCHAR(120) NULL,
  account_holder_name   VARCHAR(120) NULL,
  account_number        VARCHAR(40)  NULL,
  ifsc                  VARCHAR(20)  NULL,
  branch                VARCHAR(120) NULL,
  upi_id                VARCHAR(120) NULL,
  -- government ids
  aadhaar_number        VARCHAR(20)  NULL,
  pan_number            VARCHAR(20)  NULL,
  passport_number       VARCHAR(40)  NULL,
  driving_license       VARCHAR(40)  NULL,
  esi_number            VARCHAR(40)  NULL,
  pf_number             VARCHAR(40)  NULL,
  tax_number            VARCHAR(40)  NULL,
  -- misc
  internal_notes        TEXT         NULL,
  -- self-service login link (set when this employee has a portal account)
  user_id               INT UNSIGNED NULL,
  deleted_at            DATETIME     NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_emp_code (employee_code),
  UNIQUE KEY uq_emp_email (email),
  KEY idx_emp_status (status),
  KEY idx_emp_department (department_id),
  KEY idx_emp_designation (designation_id),
  KEY idx_emp_manager (manager_id),
  KEY idx_emp_name (first_name, last_name),
  KEY idx_emp_joining (joining_date),
  UNIQUE KEY uq_emp_user (user_id),
  CONSTRAINT fk_emp_department  FOREIGN KEY (department_id)  REFERENCES departments (id)  ON DELETE SET NULL,
  CONSTRAINT fk_emp_designation FOREIGN KEY (designation_id) REFERENCES designations (id) ON DELETE SET NULL,
  CONSTRAINT fk_emp_manager     FOREIGN KEY (manager_id)     REFERENCES employees (id)    ON DELETE SET NULL,
  CONSTRAINT fk_emp_user        FOREIGN KEY (user_id)        REFERENCES users (id)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FK for department head (added after employees exists)
ALTER TABLE departments
  ADD CONSTRAINT fk_dept_head FOREIGN KEY (head_id) REFERENCES employees (id) ON DELETE SET NULL;

-- ── Attendance ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id   INT UNSIGNED NOT NULL,
  date          DATE         NOT NULL,
  status        ENUM('present','absent','half_day','leave','holiday','week_off') NOT NULL DEFAULT 'present',
  check_in      TIME         NULL,
  check_out     TIME         NULL,
  working_hours DECIMAL(5,2) NULL,
  remarks       VARCHAR(255) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_att_emp_date (employee_id, date),
  KEY idx_att_date (date),
  KEY idx_att_status (status),
  CONSTRAINT fk_att_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Salary (monthly payroll record) ────────────────────────
CREATE TABLE IF NOT EXISTS salary (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id      INT UNSIGNED NOT NULL,
  month            TINYINT      NOT NULL,
  year             SMALLINT     NOT NULL,
  salary_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status   ENUM('generated','pending','partial','paid','cancelled','refunded') NOT NULL DEFAULT 'pending',
  void_disbursed   DECIMAL(12,2) NULL DEFAULT NULL,
  void_recovered   DECIMAL(12,2) NULL DEFAULT NULL,
  void_settled_at  DATETIME     NULL DEFAULT NULL,
  void_settled_by  INT          NULL DEFAULT NULL,
  void_resolution  VARCHAR(20)  NULL DEFAULT NULL,
  void_settle_note VARCHAR(255) NULL DEFAULT NULL,
  generated_date   DATE         NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_salary_emp_period (employee_id, month, year),
  KEY idx_salary_status (payment_status),
  KEY idx_salary_period (year, month),
  CONSTRAINT fk_salary_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Salary payments (partial payment ledger) ───────────────
CREATE TABLE IF NOT EXISTS salary_payments (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  salary_id      INT UNSIGNED NOT NULL,
  payment_date   DATE         NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  payment_method ENUM('cash','bank_transfer','upi','cheque','card','other') NOT NULL DEFAULT 'bank_transfer',
  transaction_id VARCHAR(120) NULL,
  remarks        VARCHAR(255) NULL,
  created_by     INT UNSIGNED NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pay_salary (salary_id),
  KEY idx_pay_date (payment_date),
  CONSTRAINT fk_pay_salary FOREIGN KEY (salary_id)  REFERENCES salary (id) ON DELETE CASCADE,
  CONSTRAINT fk_pay_user   FOREIGN KEY (created_by) REFERENCES users (id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Leaves ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leaves (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id  INT UNSIGNED NOT NULL,
  leave_type   ENUM('casual','sick','earned','unpaid','maternity','paternity','other') NOT NULL DEFAULT 'casual',
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  total_days   DECIMAL(4,1) NULL,
  reason       VARCHAR(500) NULL,
  status       ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  approved_by  INT UNSIGNED NULL,
  approved_at  DATETIME     NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leave_employee (employee_id),
  KEY idx_leave_status (status),
  KEY idx_leave_range (start_date, end_date),
  CONSTRAINT fk_leave_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_approver FOREIGN KEY (approved_by) REFERENCES users (id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Documents ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id   INT UNSIGNED NOT NULL,
  document_name VARCHAR(160) NOT NULL,
  document_type VARCHAR(60)  NULL,
  file_url      VARCHAR(255) NOT NULL,
  file_size     INT UNSIGNED NULL,
  mime_type     VARCHAR(120) NULL,
  uploaded_by   INT UNSIGNED NULL,
  deleted_at    DATETIME     NULL,
  uploaded_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_doc_employee (employee_id),
  KEY idx_doc_type (document_type),
  CONSTRAINT fk_doc_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_user     FOREIGN KEY (uploaded_by) REFERENCES users (id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title       VARCHAR(160) NOT NULL,
  description VARCHAR(500) NULL,
  user_id     INT UNSIGNED NULL,
  type        VARCHAR(60)  NULL,
  is_read     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id),
  KEY idx_notif_read (is_read),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Audit logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,
  action      VARCHAR(80)  NOT NULL,
  entity      VARCHAR(60)  NULL,
  entity_id   INT UNSIGNED NULL,
  description VARCHAR(500) NULL,
  ip_address  VARCHAR(64)  NULL,
  user_agent  VARCHAR(255) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_user (user_id),
  KEY idx_audit_action (action),
  KEY idx_audit_entity (entity, entity_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
