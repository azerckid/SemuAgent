-- =====================================================================
-- 수동 증분 SQL: 요청 스케줄링 테이블 추가
-- =====================================================================
-- 목적: 기존 DB에 스케줄링 테이블 3개와 nullable 컬럼 3개를 추가합니다.
--       (upload_session.request_event_id, outbound_email.request_event_id,
--        outbound_email.request_template_id)
--
-- 적용 대상:
--   - tenant, staff, client, upload_session 등 baseline 테이블이 이미 존재하는 DB
--   - request_template, client_request_schedule, client_request_event 테이블이
--     아직 존재하지 않는 DB (이미 있으면 "table already exists" 오류 발생)
--
-- 적용 제외:
--   - 신규 설치 환경 → 0000_sloppy_tarantula.sql 하나만 적용하면 됩니다.
--
-- 주의:
--   이 파일은 Drizzle _journal.json에 등록되지 않은 수동 파일입니다.
--   pnpm db:migrate로 자동 적용되지 않습니다.
--   Turso CLI 또는 db:studio에서 직접 실행하세요.
--   자세한 내용: drizzle/README.md
-- =====================================================================

CREATE TABLE `request_template` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text,
	`checklist_template_id` text,
	`name` text NOT NULL,
	`frequency` text NOT NULL,
	`request_items` text,
	`email_subject_template` text NOT NULL,
	`email_body_template` text NOT NULL,
	`analysis_criteria_template` text,
	`due_rule` text,
	`send_rule` text,
	`send_policy` text DEFAULT 'approval_required' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by_staff_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`checklist_template_id`) REFERENCES `checklist_template`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `client_request_schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text NOT NULL,
	`request_template_id` text NOT NULL,
	`frequency` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`timezone` text DEFAULT 'Asia/Seoul' NOT NULL,
	`generation_policy` text DEFAULT 'manual' NOT NULL,
	`send_policy` text DEFAULT 'approval_required' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_template_id`) REFERENCES `request_template`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `client_request_event` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text NOT NULL,
	`request_schedule_id` text,
	`request_template_id` text,
	`upload_session_id` text,
	`accounting_period` text NOT NULL,
	`frequency` text NOT NULL,
	`title` text NOT NULL,
	`due_at` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`request_items_snapshot` text,
	`email_subject_snapshot` text,
	`email_body_snapshot` text,
	`analysis_criteria_snapshot` text,
	`created_by_staff_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_schedule_id`) REFERENCES `client_request_schedule`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_template_id`) REFERENCES `request_template`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `upload_session` ADD COLUMN `request_event_id` text;
--> statement-breakpoint
ALTER TABLE `outbound_email` ADD COLUMN `request_event_id` text REFERENCES `client_request_event`(`id`) ON UPDATE no action ON DELETE no action;
--> statement-breakpoint
ALTER TABLE `outbound_email` ADD COLUMN `request_template_id` text REFERENCES `request_template`(`id`) ON UPDATE no action ON DELETE no action;
