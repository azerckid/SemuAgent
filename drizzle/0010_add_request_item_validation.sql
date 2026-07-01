-- 수동 증분 SQL: request_item_validation, request_item_validation_file 테이블 추가
-- 적용 대상: 0009까지 적용된 DB
-- 목적: 요청 항목별 충족 상태(satisfied/partially_satisfied/missing/non_compliant/uncertain)를
--       파일-체크리스트 매칭(material_match)과 분리해 저장

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
