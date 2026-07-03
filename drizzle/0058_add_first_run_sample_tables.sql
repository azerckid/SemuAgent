-- 수동 증분 SQL: first-run sample registry 테이블 추가
-- 적용 대상: 0057까지 적용된 DB
-- 목적: JC-019 첫 가입 샘플 데이터 묶음과 registry 기반 삭제 경계를 저장한다.

CREATE TABLE `sample_dataset` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `source` text NOT NULL,
  `status` text DEFAULT 'creating' NOT NULL,
  `seed_version` text NOT NULL,
  `period_key` text DEFAULT '2026-H1' NOT NULL,
  `payroll_period_key` text DEFAULT '2026-06' NOT NULL,
  `created_by_user_id` text,
  `created_by_staff_id` text,
  `error_message` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `deleted_at` text,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sample_dataset_scope_status_idx`
  ON `sample_dataset` (`tenant_id`, `client_id`, `status`);
--> statement-breakpoint
CREATE INDEX `sample_dataset_tenant_status_idx`
  ON `sample_dataset` (`tenant_id`, `status`);
--> statement-breakpoint

CREATE TABLE `sample_entity_ref` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `sample_dataset_id` text NOT NULL,
  `entity_table` text NOT NULL,
  `entity_id` text NOT NULL,
  `delete_order` integer DEFAULT 100 NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`sample_dataset_id`) REFERENCES `sample_dataset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sample_entity_ref_entity_uidx`
  ON `sample_entity_ref` (`tenant_id`, `client_id`, `sample_dataset_id`, `entity_table`, `entity_id`);
--> statement-breakpoint
CREATE INDEX `sample_entity_ref_dataset_delete_idx`
  ON `sample_entity_ref` (`sample_dataset_id`, `delete_order`);
--> statement-breakpoint
CREATE INDEX `sample_entity_ref_scope_idx`
  ON `sample_entity_ref` (`tenant_id`, `client_id`, `sample_dataset_id`);
