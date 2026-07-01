-- =====================================================================
-- 수동 증분 SQL: 정기 요청 자동화 필드 추가
-- =====================================================================
-- 목적:
--   request_template에 send_rule,
--   client_request_schedule에 send_rule + 인라인 메일 초안 필드 추가
--
-- 적용 대상:
--   0003_add_greeting_phone_fields.sql까지 적용된 DB
--
-- 적용 제외:
--   신규 설치 환경 → 0000_sloppy_tarantula.sql 하나만 적용하면 됩니다.
-- =====================================================================

ALTER TABLE `request_template` ADD COLUMN `send_rule` text;
--> statement-breakpoint
ALTER TABLE `client_request_schedule` ADD COLUMN `due_rule` text;
--> statement-breakpoint
ALTER TABLE `client_request_schedule` ADD COLUMN `send_rule` text;
--> statement-breakpoint
ALTER TABLE `client_request_schedule` ADD COLUMN `email_subject_template` text;
--> statement-breakpoint
ALTER TABLE `client_request_schedule` ADD COLUMN `email_body_template` text;
--> statement-breakpoint
ALTER TABLE `client_request_schedule` ADD COLUMN `email_greeting_template` text;
--> statement-breakpoint
ALTER TABLE `client_request_schedule` ADD COLUMN `analysis_criteria_template` text;
