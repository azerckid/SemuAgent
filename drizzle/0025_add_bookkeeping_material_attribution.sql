CREATE TABLE `bookkeeping_material_attribution` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `upload_session_id` text NOT NULL,
  `upload_file_id` text,
  `status` text DEFAULT 'active' NOT NULL,
  `source_kind` text DEFAULT 'file_summary' NOT NULL,
  `source_label` text NOT NULL,
  `evidence_date` text,
  `attributed_period` text,
  `requested_period` text NOT NULL,
  `close_period` text NOT NULL,
  `period_relation` text DEFAULT 'unknown' NOT NULL,
  `amount_krw` integer,
  `counterparty` text,
  `description` text,
  `duplicate_status` text DEFAULT 'none' NOT NULL,
  `duplicate_basis` text,
  `recommendation` text DEFAULT 'include' NOT NULL,
  `staff_decision` text,
  `staff_note` text,
  `decided_by_staff_id` text,
  `decided_at` text,
  `created_by_staff_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`upload_file_id`) REFERENCES `upload_file`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`decided_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bookkeeping_attr_session_idx` ON `bookkeeping_material_attribution` (`tenant_id`,`upload_session_id`,`status`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_attr_file_idx` ON `bookkeeping_material_attribution` (`tenant_id`,`upload_file_id`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_attr_period_idx` ON `bookkeeping_material_attribution` (`tenant_id`,`attributed_period`,`period_relation`);
