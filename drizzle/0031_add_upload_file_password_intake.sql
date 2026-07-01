ALTER TABLE upload_file ADD COLUMN password_last_submitted_at text;
ALTER TABLE upload_file ADD COLUMN password_attempt_count integer DEFAULT 0 NOT NULL;
