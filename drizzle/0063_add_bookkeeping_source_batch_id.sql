-- JC-031 Slice 3c-3: bookkeeping source lineage에 source_batch_id 추가.
-- upload_session_id는 Slice 4 전까지 compatibility로 유지한다.

ALTER TABLE `bookkeeping_material_attribution` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_attr_source_batch_idx`
  ON `bookkeeping_material_attribution` (`tenant_id`, `source_batch_id`);
--> statement-breakpoint
ALTER TABLE `bookkeeping_ledger_material_link` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_ledger_link_source_batch_idx`
  ON `bookkeeping_ledger_material_link` (`tenant_id`, `source_batch_id`);
--> statement-breakpoint
ALTER TABLE `bookkeeping_classification_run` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_run_source_batch_created_idx`
  ON `bookkeeping_classification_run` (`tenant_id`, `source_batch_id`, `created_at`);
--> statement-breakpoint
ALTER TABLE `bookkeeping_transaction_classification` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_tx_source_batch_idx`
  ON `bookkeeping_transaction_classification` (`tenant_id`, `source_batch_id`);
--> statement-breakpoint
ALTER TABLE `bookkeeping_journal_entry_run` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_journal_run_source_batch_created_idx`
  ON `bookkeeping_journal_entry_run` (`tenant_id`, `source_batch_id`, `created_at`);
--> statement-breakpoint
ALTER TABLE `bookkeeping_journal_entry_row` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_journal_row_source_batch_idx`
  ON `bookkeeping_journal_entry_row` (`tenant_id`, `source_batch_id`);
--> statement-breakpoint
ALTER TABLE `bookkeeping_journal_entry_voucher` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_journal_voucher_source_batch_idx`
  ON `bookkeeping_journal_entry_voucher` (`tenant_id`, `source_batch_id`);
--> statement-breakpoint
UPDATE `bookkeeping_material_attribution`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `bookkeeping_material_attribution`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
--> statement-breakpoint
UPDATE `bookkeeping_ledger_material_link`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `bookkeeping_ledger_material_link`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
--> statement-breakpoint
UPDATE `bookkeeping_classification_run`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `bookkeeping_classification_run`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
--> statement-breakpoint
UPDATE `bookkeeping_transaction_classification`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `bookkeeping_transaction_classification`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
--> statement-breakpoint
UPDATE `bookkeeping_journal_entry_run`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `bookkeeping_journal_entry_run`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
--> statement-breakpoint
UPDATE `bookkeeping_journal_entry_row`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `bookkeeping_journal_entry_row`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
--> statement-breakpoint
UPDATE `bookkeeping_journal_entry_voucher`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `bookkeeping_journal_entry_voucher`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
