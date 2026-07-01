-- 수동 증분 SQL: client_payroll_rule_profile, client_payroll_rule_profile_source,
--               payroll_rule_profile_application 테이블 추가
-- 적용 대상: 0050까지 적용된 DB
-- 목적: 고객사별 급여기준 프로필(AI 초안 → 담당자 승인 → 결정론적 적용)의
--       저장소. profile_json은 Zod ClientPayrollRuleProfileV1로 검증하며 직원 원자료는 담지 않는다.

CREATE TABLE `client_payroll_rule_profile` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `effective_from` text NOT NULL,
  `effective_to` text,
  `profile_json` text NOT NULL,
  `source_summary_json` text NOT NULL,
  `approval_notes` text,
  `approved_by_staff_id` text,
  `approved_at` text,
  `created_by_staff_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`approved_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `client_payroll_rule_profile_lookup_idx` ON `client_payroll_rule_profile` (`tenant_id`, `client_id`, `status`);
--> statement-breakpoint
CREATE TABLE `client_payroll_rule_profile_source` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `profile_id` text NOT NULL,
  `client_id` text NOT NULL,
  `source_type` text NOT NULL,
  `source_file_id` text,
  `source_hash` text NOT NULL,
  `source_effective_from` text,
  `security_lane` text DEFAULT 'normal' NOT NULL,
  `ai_provider_metadata_json` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`profile_id`) REFERENCES `client_payroll_rule_profile`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `client_payroll_rule_profile_source_profile_idx` ON `client_payroll_rule_profile_source` (`tenant_id`, `profile_id`);
--> statement-breakpoint
CREATE TABLE `payroll_rule_profile_application` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `profile_id` text NOT NULL,
  `profile_version` integer NOT NULL,
  `upload_session_id` text NOT NULL,
  `batch_id` text,
  `snapshot_json` text NOT NULL,
  `applied_at` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`profile_id`) REFERENCES `client_payroll_rule_profile`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`batch_id`) REFERENCES `payroll_extraction_batch`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payroll_rule_profile_application_session_idx` ON `payroll_rule_profile_application` (`tenant_id`, `upload_session_id`);
