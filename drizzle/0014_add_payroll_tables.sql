-- 0014_add_payroll_tables.sql
-- request_kind 컬럼 추가 (기존 레코드는 'general' 기본값)
ALTER TABLE client_request_event ADD COLUMN request_kind TEXT NOT NULL DEFAULT 'general';
ALTER TABLE upload_session ADD COLUMN request_kind TEXT NOT NULL DEFAULT 'general';

-- payroll_excel_template
CREATE TABLE payroll_excel_template (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenant(id),
  client_id TEXT REFERENCES client(id),
  name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  header_row INTEGER NOT NULL,
  sub_header_row INTEGER,
  data_start_row INTEGER NOT NULL,
  mapping_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by_staff_id TEXT REFERENCES staff(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- payroll_extraction_batch
CREATE TABLE payroll_extraction_batch (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenant(id),
  upload_session_id TEXT NOT NULL REFERENCES upload_session(id),
  request_event_id TEXT REFERENCES client_request_event(id),
  status TEXT NOT NULL DEFAULT 'pending',
  source_upload_file_ids TEXT NOT NULL,
  model TEXT,
  error_message TEXT,
  created_by_staff_id TEXT REFERENCES staff(id),
  created_at TEXT NOT NULL,
  completed_at TEXT
);

-- payroll_extraction_row
CREATE TABLE payroll_extraction_row (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenant(id),
  batch_id TEXT NOT NULL REFERENCES payroll_extraction_batch(id),
  upload_session_id TEXT NOT NULL REFERENCES upload_session(id),
  payroll_period TEXT NOT NULL,
  employee_code TEXT,
  employee_name TEXT,
  department TEXT,
  job_title TEXT,
  job_type TEXT,
  base_salary INTEGER,
  bonus INTEGER,
  meal_allowance INTEGER,
  transportation_allowance INTEGER,
  holiday_work_allowance INTEGER,
  domestic_travel_allowance INTEGER,
  annual_leave_allowance INTEGER,
  rnd_allowance INTEGER,
  other_allowance INTEGER,
  performance_incentive INTEGER,
  night_work_allowance INTEGER,
  deduction_amount INTEGER,
  memo TEXT,
  source_reference TEXT,
  confidence TEXT NOT NULL DEFAULT 'unknown',
  review_status TEXT NOT NULL DEFAULT 'needs_review',
  reviewed_by_staff_id TEXT REFERENCES staff(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- payroll_excel_draft
CREATE TABLE payroll_excel_draft (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenant(id),
  upload_session_id TEXT NOT NULL REFERENCES upload_session(id),
  batch_id TEXT NOT NULL REFERENCES payroll_extraction_batch(id),
  template_id TEXT NOT NULL REFERENCES payroll_excel_template(id),
  status TEXT NOT NULL,
  storage_key TEXT,
  filename TEXT NOT NULL,
  confirmed_row_count INTEGER NOT NULL,
  excluded_row_count INTEGER NOT NULL,
  error_message TEXT,
  generated_by_staff_id TEXT NOT NULL REFERENCES staff(id),
  generated_at TEXT NOT NULL
);
