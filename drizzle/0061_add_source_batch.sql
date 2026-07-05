-- JC-031 Slice 3a: SemuAgent 내부 source lineage 모델 도입.
-- upload_session은 Slice 4 전까지 compatibility table로 유지한다.

CREATE TABLE `source_batch` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `created_by_staff_id` text NOT NULL,
  `source_kind` text DEFAULT 'staff_direct' NOT NULL,
  `accounting_period` text NOT NULL,
  `bookkeeping_period_type` text,
  `bookkeeping_period_start` text,
  `bookkeeping_period_end` text,
  `display_label` text,
  `legacy_upload_session_id` text,
  `deleted_at` text,
  `deleted_by_staff_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`legacy_upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`deleted_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_batch_legacy_upload_session_uidx`
  ON `source_batch` (`legacy_upload_session_id`);
--> statement-breakpoint
CREATE INDEX `source_batch_tenant_client_period_idx`
  ON `source_batch` (`tenant_id`, `client_id`, `accounting_period`);
--> statement-breakpoint
CREATE INDEX `source_batch_tenant_created_idx`
  ON `source_batch` (`tenant_id`, `created_at`);
--> statement-breakpoint
ALTER TABLE `upload_file` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `upload_file_source_batch_idx`
  ON `upload_file` (`tenant_id`, `source_batch_id`);
--> statement-breakpoint
INSERT INTO `source_batch` (
  `id`,
  `tenant_id`,
  `client_id`,
  `created_by_staff_id`,
  `source_kind`,
  `accounting_period`,
  `bookkeeping_period_type`,
  `bookkeeping_period_start`,
  `bookkeeping_period_end`,
  `display_label`,
  `legacy_upload_session_id`,
  `deleted_at`,
  `deleted_by_staff_id`,
  `created_at`,
  `updated_at`
)
SELECT
  'source_batch_' || `id`,
  `tenant_id`,
  `client_id`,
  `created_by_staff_id`,
  CASE
    WHEN `source` IN ('staff_direct', 'customer_upload') THEN `source`
    ELSE 'legacy_upload_session'
  END,
  `accounting_period`,
  `bookkeeping_period_type`,
  `bookkeeping_period_start`,
  `bookkeeping_period_end`,
  `staff_direct_label`,
  `id`,
  `deleted_at`,
  `deleted_by_staff_id`,
  `created_at`,
  `created_at`
FROM `upload_session`;
--> statement-breakpoint
UPDATE `upload_file`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `upload_file`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
