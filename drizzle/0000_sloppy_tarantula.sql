-- =====================================================================
-- BASELINE MIGRATION: 전체 스키마 (신규 설치 전용)
-- =====================================================================
-- 대상: 테이블이 없는 신규 환경에만 적용합니다.
-- 기존 DB: 0001_add_scheduling_tables.sql 을 사용하세요.
-- =====================================================================

CREATE TABLE `analysis_run` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_file_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`raw_output` text,
	`parsed_output` text,
	`confidence` text DEFAULT 'unknown' NOT NULL,
	`consensus_group` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`applied_analysis_notes` text,
	`criteria_summary` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`upload_file_id`) REFERENCES `upload_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_proof` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_file_id` text,
	`upload_session_id` text,
	`tenant_id` text NOT NULL,
	`tx_hash` text,
	`proof_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`upload_file_id`) REFERENCES `upload_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `checklist_item` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`template_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`required` integer DEFAULT true NOT NULL,
	`analysis_rules` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `checklist_template`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `checklist_template` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `client` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`staff_id` text,
	`email` text NOT NULL,
	`contact_name` text,
	`name` text NOT NULL,
	`analysis_notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_tenant_email_uidx` ON `client` (`tenant_id`,lower(`email`));--> statement-breakpoint
CREATE TABLE `client_checklist` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text NOT NULL,
	`template_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `checklist_template`(`id`) ON UPDATE no action ON DELETE no action
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
	`deleted_at` text,
	`deleted_by_staff_id` text,
	`created_by_staff_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_schedule_id`) REFERENCES `client_request_schedule`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_template_id`) REFERENCES `request_template`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deleted_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `client_request_schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text NOT NULL,
	`request_template_id` text,
	`frequency` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`timezone` text DEFAULT 'Asia/Seoul' NOT NULL,
	`generation_policy` text DEFAULT 'manual' NOT NULL,
	`send_policy` text DEFAULT 'approval_required' NOT NULL,
	`due_rule` text,
	`send_rule` text,
	`email_subject_template` text,
	`email_body_template` text,
	`email_greeting_template` text,
	`sender_phone_template` text,
	`analysis_criteria_template` text,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` text,
	`deleted_by_staff_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_template_id`) REFERENCES `request_template`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deleted_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cron_run` (
	`id` text PRIMARY KEY NOT NULL,
	`job_name` text NOT NULL,
	`run_key` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cron_run_job_key_uidx` ON `cron_run` (`job_name`,`run_key`);--> statement-breakpoint
CREATE TABLE `material_match` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_file_id` text NOT NULL,
	`checklist_item_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`analysis_run_id` text,
	`status` text NOT NULL,
	`confidence` text NOT NULL,
	`explanation` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`upload_file_id`) REFERENCES `upload_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`checklist_item_id`) REFERENCES `checklist_item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`analysis_run_id`) REFERENCES `analysis_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `request_item_validation` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`upload_session_id` text NOT NULL,
	`request_event_id` text,
	`item_name` text NOT NULL,
	`item_group` text,
	`criterion_type` text,
	`requiredness` text DEFAULT 'required' NOT NULL,
	`condition_text` text,
	`period_start` text,
	`period_end` text,
	`validation_status` text DEFAULT 'uncertain' NOT NULL,
	`review_status` text DEFAULT 'ai_suggested' NOT NULL,
	`ai_reasoning` text,
	`requested_action` text,
	`staff_note` text,
	`reviewed_by_staff_id` text,
	`reviewed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_event_id`) REFERENCES `client_request_event`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `riv_tenant_session_idx` ON `request_item_validation` (`tenant_id`, `upload_session_id`);
--> statement-breakpoint
CREATE TABLE `request_item_validation_file` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`validation_id` text NOT NULL,
	`upload_file_id` text NOT NULL,
	`contribution` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`validation_id`) REFERENCES `request_item_validation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`upload_file_id`) REFERENCES `upload_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rivf_validation_idx` ON `request_item_validation_file` (`validation_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `rivf_tenant_validation_file_uidx` ON `request_item_validation_file` (`tenant_id`, `validation_id`, `upload_file_id`);
--> statement-breakpoint
CREATE TABLE `outbound_email` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_session_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`to_email` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`applied_analysis_notes` text,
	`criteria_summary` text,
	`request_event_id` text,
	`request_template_id` text,
	`approved_by_staff_id` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_event_id`) REFERENCES `client_request_event`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_template_id`) REFERENCES `request_template`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'STAFF' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_userId_tenantId_uidx` ON `staff` (`user_id`,`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenant` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`subdomain` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`timezone` text DEFAULT 'Asia/Seoul' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_subdomain_unique` ON `tenant` (`subdomain`);--> statement-breakpoint
CREATE TABLE `upload_file` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_session_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`original_filename` text NOT NULL,
	`storage_key` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`content_hash` text NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`uploaded_at` text NOT NULL,
	FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `upload_session` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text NOT NULL,
	`created_by_staff_id` text NOT NULL,
	`accounting_period` text NOT NULL,
	`token_hash` text NOT NULL,
	`upload_url` text,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`analysis_notes` text,
	`session_evaluation` text,
	`request_email_subject` text,
	`request_email_body` text,
	`extracted_criteria` text,
	`additional_criteria` text,
	`last_accessed_at` text,
	`request_event_id` text,
	`deleted_at` text,
	`deleted_by_staff_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deleted_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upload_session_token_hash_unique` ON `upload_session` (`token_hash`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`inviter_id` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`created_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_uidx` ON `organization` (`slug`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`active_organization_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);
