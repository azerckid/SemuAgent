-- JC-031 Slice 3c-4a: payroll extraction lineage에 범용 source_batch_id 추가.
-- upload_session_id는 Slice 4 전까지 compatibility로 유지한다.
-- 주의: payroll_employee_line.source_batch_id는 payroll_extraction_batch FK이므로 건드리지 않는다.

ALTER TABLE `payroll_rule_profile_application` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `payroll_rule_profile_application_source_batch_idx`
  ON `payroll_rule_profile_application` (`tenant_id`, `source_batch_id`);
--> statement-breakpoint
ALTER TABLE `payroll_extraction_batch` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `payroll_batch_source_batch_idx`
  ON `payroll_extraction_batch` (`tenant_id`, `source_batch_id`);
--> statement-breakpoint
ALTER TABLE `payroll_extraction_row` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `payroll_extraction_row_source_batch_idx`
  ON `payroll_extraction_row` (`tenant_id`, `source_batch_id`);
--> statement-breakpoint
ALTER TABLE `payroll_excel_draft` ADD COLUMN `source_batch_id` text REFERENCES `source_batch`(`id`);
--> statement-breakpoint
CREATE INDEX `payroll_excel_draft_source_batch_idx`
  ON `payroll_excel_draft` (`tenant_id`, `source_batch_id`);
--> statement-breakpoint
UPDATE `payroll_rule_profile_application`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `payroll_rule_profile_application`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
--> statement-breakpoint
UPDATE `payroll_extraction_batch`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `payroll_extraction_batch`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
--> statement-breakpoint
UPDATE `payroll_extraction_row`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `payroll_extraction_row`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
--> statement-breakpoint
UPDATE `payroll_excel_draft`
SET `source_batch_id` = (
  SELECT `source_batch`.`id`
  FROM `source_batch`
  WHERE `source_batch`.`legacy_upload_session_id` = `payroll_excel_draft`.`upload_session_id`
)
WHERE `source_batch_id` IS NULL;
