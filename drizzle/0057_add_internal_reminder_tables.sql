-- 수동 증분 SQL: internal_reminder_* 테이블 추가
-- 적용 대상: 0056까지 적용된 DB
-- 목적: JC-016 내부 리마인드. 회사 내부 staff에게 업무 마감과 확인 필요 상태를 알린다.
--       GIWA 고객 요청 메일/외부 업로드 포털/자동 홈택스 제출 흐름과 분리한다.

CREATE TABLE `internal_reminder_rule` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `domain` text NOT NULL,
  `trigger_type` text NOT NULL,
  `offset_days` integer,
  `enabled` integer DEFAULT true NOT NULL,
  `recipient_source` text DEFAULT 'staff' NOT NULL,
  `subject_template` text NOT NULL,
  `body_template` text NOT NULL,
  `created_by_staff_id` text,
  `updated_by_staff_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`updated_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `internal_reminder_rule_scope_uidx`
  ON `internal_reminder_rule` (`tenant_id`, `client_id`, `domain`, `trigger_type`, `offset_days`);
--> statement-breakpoint
CREATE INDEX `internal_reminder_rule_domain_idx`
  ON `internal_reminder_rule` (`tenant_id`, `client_id`, `domain`);
--> statement-breakpoint
CREATE INDEX `internal_reminder_rule_enabled_idx`
  ON `internal_reminder_rule` (`tenant_id`, `client_id`, `enabled`);
--> statement-breakpoint

CREATE TABLE `internal_reminder_recipient_override` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `rule_id` text NOT NULL,
  `recipient_type` text NOT NULL,
  `staff_id` text,
  `employee_id` text,
  `email_hash` text,
  `email_label` text,
  `enabled` integer DEFAULT true NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`rule_id`) REFERENCES `internal_reminder_rule`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`employee_id`) REFERENCES `employee_profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `internal_reminder_recipient_override_rule_idx`
  ON `internal_reminder_recipient_override` (`tenant_id`, `client_id`, `rule_id`);
--> statement-breakpoint
CREATE INDEX `internal_reminder_recipient_override_staff_idx`
  ON `internal_reminder_recipient_override` (`tenant_id`, `staff_id`);
--> statement-breakpoint
CREATE INDEX `internal_reminder_recipient_override_employee_idx`
  ON `internal_reminder_recipient_override` (`tenant_id`, `employee_id`);
--> statement-breakpoint

CREATE TABLE `internal_reminder_send_log` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `rule_id` text,
  `domain` text NOT NULL,
  `context_key` text NOT NULL,
  `recipient_type` text DEFAULT 'staff' NOT NULL,
  `recipient_ref_id` text,
  `recipient_label` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `status` text NOT NULL,
  `provider_message_id` text,
  `error_message` text,
  `queued_at` text NOT NULL,
  `sent_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`rule_id`) REFERENCES `internal_reminder_rule`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `internal_reminder_send_log_idempotency_uidx`
  ON `internal_reminder_send_log` (`tenant_id`, `client_id`, `idempotency_key`);
--> statement-breakpoint
CREATE INDEX `internal_reminder_send_log_status_idx`
  ON `internal_reminder_send_log` (`tenant_id`, `client_id`, `status`);
--> statement-breakpoint
CREATE INDEX `internal_reminder_send_log_domain_idx`
  ON `internal_reminder_send_log` (`tenant_id`, `client_id`, `domain`);
--> statement-breakpoint
CREATE INDEX `internal_reminder_send_log_rule_idx`
  ON `internal_reminder_send_log` (`tenant_id`, `client_id`, `rule_id`);
