-- 0023_add_mail_template_work_type.sql
-- Mail template work-type metadata for the email workspace.
-- Additive only: existing request templates are preserved.

ALTER TABLE request_template ADD COLUMN work_type text;
ALTER TABLE request_template ADD COLUMN is_default_for_work_type integer NOT NULL DEFAULT 0;

UPDATE request_template
SET work_type = CASE
  WHEN name LIKE '%급여%' OR email_subject_template LIKE '%급여%' OR email_body_template LIKE '%급여%' THEN 'payroll'
  WHEN name LIKE '%부가세%' OR email_subject_template LIKE '%부가세%' OR email_body_template LIKE '%부가세%' OR name LIKE '%VAT%' OR email_subject_template LIKE '%VAT%' OR email_body_template LIKE '%VAT%' THEN 'vat'
  ELSE 'bookkeeping'
END
WHERE work_type IS NULL;

CREATE INDEX IF NOT EXISTS request_template_work_type_default_idx
ON request_template (tenant_id, work_type, is_default_for_work_type);
