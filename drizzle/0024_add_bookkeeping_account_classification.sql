-- 0024_add_bookkeeping_account_classification.sql
-- Bookkeeping transaction account classification after material sufficiency review.
-- Additive only: existing upload, review, and email rows are preserved.

CREATE TABLE IF NOT EXISTS bookkeeping_classification_run (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL,
  upload_session_id text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  source_file_count integer NOT NULL DEFAULT 0,
  extracted_row_count integer NOT NULL DEFAULT 0,
  confirmed_row_count integer NOT NULL DEFAULT 0,
  unclassified_row_count integer NOT NULL DEFAULT 0,
  model_provider text,
  model_name text,
  applied_category_notes text NOT NULL,
  error_message text,
  created_by_staff_id text,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  FOREIGN KEY (upload_session_id) REFERENCES upload_session(id),
  FOREIGN KEY (created_by_staff_id) REFERENCES staff(id)
);

CREATE INDEX IF NOT EXISTS bookkeeping_run_session_created_idx
ON bookkeeping_classification_run (tenant_id, upload_session_id, created_at);

CREATE INDEX IF NOT EXISTS bookkeeping_run_status_idx
ON bookkeeping_classification_run (tenant_id, status);

CREATE TABLE IF NOT EXISTS bookkeeping_transaction_classification (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL,
  classification_run_id text NOT NULL,
  upload_session_id text NOT NULL,
  upload_file_id text,
  source_type text NOT NULL DEFAULT 'other',
  transaction_date text,
  merchant_name text,
  description text,
  amount_krw integer,
  direction text NOT NULL DEFAULT 'unknown',
  recommended_account text,
  recommendation_confidence text NOT NULL DEFAULT 'low',
  recommendation_reason text,
  evidence_json text,
  final_account text,
  staff_memo text,
  status text NOT NULL DEFAULT 'suggested',
  confirmed_by_staff_id text,
  confirmed_at text,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  FOREIGN KEY (classification_run_id) REFERENCES bookkeeping_classification_run(id),
  FOREIGN KEY (upload_session_id) REFERENCES upload_session(id),
  FOREIGN KEY (upload_file_id) REFERENCES upload_file(id),
  FOREIGN KEY (confirmed_by_staff_id) REFERENCES staff(id)
);

CREATE INDEX IF NOT EXISTS bookkeeping_tx_run_idx
ON bookkeeping_transaction_classification (tenant_id, classification_run_id);

CREATE INDEX IF NOT EXISTS bookkeeping_tx_session_idx
ON bookkeeping_transaction_classification (tenant_id, upload_session_id);

CREATE INDEX IF NOT EXISTS bookkeeping_tx_status_idx
ON bookkeeping_transaction_classification (tenant_id, status);
