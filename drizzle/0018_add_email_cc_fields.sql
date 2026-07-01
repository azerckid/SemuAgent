-- 0018_add_email_cc_fields.sql
-- 요청 메일 참조(CC) 이메일 저장.

ALTER TABLE client_request_schedule ADD COLUMN cc_email_template text;
ALTER TABLE client_request_event ADD COLUMN cc_email_snapshot text;
ALTER TABLE upload_session ADD COLUMN request_email_cc text;
ALTER TABLE outbound_email ADD COLUMN cc_email text;
