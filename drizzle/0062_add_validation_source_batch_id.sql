-- JC-031 Slice 3c-2: source collection validation lineage에 source_batch_id 추가.
-- upload_session_id는 Slice 4 전까지 compatibility로 유지한다.

ALTER TABLE `request_item_validation` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `riv_tenant_source_batch_idx`
  ON `request_item_validation` (`tenant_id`, `source_batch_id`);
--> statement-breakpoint
ALTER TABLE `upload_item_declaration` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `uid_tenant_source_batch_idx`
  ON `upload_item_declaration` (`tenant_id`, `source_batch_id`);
--> statement-breakpoint
UPDATE `request_item_validation`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `request_item_validation`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
--> statement-breakpoint
UPDATE `upload_item_declaration`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `upload_item_declaration`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
