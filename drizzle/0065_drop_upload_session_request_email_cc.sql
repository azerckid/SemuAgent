-- JC-031 Slice 4-2c (micro): upload_session.request_email_cc 제거.
-- runtime read 0, null-only write, prod non-null 0 (Brief 26 §2.4.5).
-- SQLite/Turso는 FK가 걸린 컬럼 DROP COLUMN을 지원하지 않으므로 테이블 재작성.

PRAGMA foreign_keys=OFF;

CREATE TABLE `__new_upload_session` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `created_by_staff_id` text NOT NULL,
  `accounting_period` text NOT NULL,
  `bookkeeping_period_type` text,
  `bookkeeping_period_start` text,
  `bookkeeping_period_end` text,
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
  `request_kind` text DEFAULT 'general' NOT NULL,
  `source` text DEFAULT 'customer_upload' NOT NULL,
  `staff_direct_label` text,
  `deleted_at` text,
  `deleted_by_staff_id` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`deleted_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);

INSERT INTO `__new_upload_session` (
  `id`,
  `tenant_id`,
  `client_id`,
  `created_by_staff_id`,
  `accounting_period`,
  `bookkeeping_period_type`,
  `bookkeeping_period_start`,
  `bookkeeping_period_end`,
  `token_hash`,
  `upload_url`,
  `expires_at`,
  `status`,
  `analysis_notes`,
  `session_evaluation`,
  `request_email_subject`,
  `request_email_body`,
  `extracted_criteria`,
  `additional_criteria`,
  `last_accessed_at`,
  `request_event_id`,
  `request_kind`,
  `source`,
  `staff_direct_label`,
  `deleted_at`,
  `deleted_by_staff_id`,
  `created_at`
)
SELECT
  `id`,
  `tenant_id`,
  `client_id`,
  `created_by_staff_id`,
  `accounting_period`,
  `bookkeeping_period_type`,
  `bookkeeping_period_start`,
  `bookkeeping_period_end`,
  `token_hash`,
  `upload_url`,
  `expires_at`,
  `status`,
  `analysis_notes`,
  `session_evaluation`,
  `request_email_subject`,
  `request_email_body`,
  `extracted_criteria`,
  `additional_criteria`,
  `last_accessed_at`,
  `request_event_id`,
  `request_kind`,
  `source`,
  `staff_direct_label`,
  `deleted_at`,
  `deleted_by_staff_id`,
  `created_at`
FROM `upload_session`;

DROP TABLE `upload_session`;

ALTER TABLE `__new_upload_session` RENAME TO `upload_session`;

CREATE UNIQUE INDEX `upload_session_token_hash_unique` ON `upload_session` (`token_hash`);

PRAGMA foreign_keys=ON;
