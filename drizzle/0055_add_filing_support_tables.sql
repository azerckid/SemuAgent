-- 수동 증분 SQL: filing support 신고 항목·접수증·사후 체크리스트 테이블 추가
-- 적용 대상: 0054까지 적용된 DB
-- 목적: JC-013 신고지원 화면에서 부가세·원천세·4대보험 패키지 상태,
--       사용자가 직접 제출 후 업로드한 접수증, 사후 확인 체크리스트를 저장한다.
--       홈택스/EDI 자동 제출, 자동 납부, 자격증명/공동인증서 저장은 제공하지 않는다.

CREATE TABLE `filing_item` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `filing_period_key` text NOT NULL,
  `payroll_period_key` text NOT NULL,
  `item_type` text NOT NULL,
  `source_module` text NOT NULL,
  `source_ref_id` text,
  `title` text NOT NULL,
  `description` text NOT NULL,
  `status` text DEFAULT 'locked' NOT NULL,
  `package_status` text DEFAULT 'locked' NOT NULL,
  `lock_reason` text,
  `package_storage_key` text,
  `generated_at` text,
  `submitted_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `filing_item_scope_uidx`
  ON `filing_item` (`tenant_id`, `client_id`, `filing_period_key`, `item_type`);
--> statement-breakpoint
CREATE INDEX `filing_item_status_idx`
  ON `filing_item` (`tenant_id`, `client_id`, `status`);
--> statement-breakpoint
CREATE INDEX `filing_item_package_idx`
  ON `filing_item` (`tenant_id`, `client_id`, `package_status`);
--> statement-breakpoint
CREATE TABLE `filing_receipt` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `filing_item_id` text NOT NULL,
  `receipt_type` text NOT NULL,
  `original_filename` text NOT NULL,
  `storage_key` text NOT NULL,
  `file_hash` text,
  `uploaded_by_staff_id` text,
  `uploaded_at` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`filing_item_id`) REFERENCES `filing_item`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`uploaded_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `filing_receipt_item_idx`
  ON `filing_receipt` (`tenant_id`, `client_id`, `filing_item_id`);
--> statement-breakpoint
CREATE INDEX `filing_receipt_type_idx`
  ON `filing_receipt` (`tenant_id`, `client_id`, `receipt_type`);
--> statement-breakpoint
CREATE TABLE `filing_checklist_item` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `filing_period_key` text NOT NULL,
  `filing_item_id` text,
  `code` text NOT NULL,
  `label` text NOT NULL,
  `description` text NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `completed` integer DEFAULT false NOT NULL,
  `completed_by_staff_id` text,
  `completed_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`filing_item_id`) REFERENCES `filing_item`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`completed_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `filing_checklist_item_scope_uidx`
  ON `filing_checklist_item` (`tenant_id`, `client_id`, `filing_period_key`, `code`);
--> statement-breakpoint
CREATE INDEX `filing_checklist_item_completed_idx`
  ON `filing_checklist_item` (`tenant_id`, `client_id`, `completed`);
