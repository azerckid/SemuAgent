CREATE TABLE `adaptive_structure_model` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`target_workflow` text NOT NULL,
	`source_classification` text DEFAULT 'business_data' NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`engine_version` text NOT NULL,
	`model_version` integer DEFAULT 1 NOT NULL,
	`model_json` text NOT NULL,
	`sample_rows_preview_json` text NOT NULL,
	`validation_summary_json` text NOT NULL,
	`prompt_version` text NOT NULL,
	`source_upload_session_id` text NOT NULL,
	`source_upload_file_ids` text NOT NULL,
	`created_by_staff_id` text NOT NULL,
	`approved_by_staff_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`approved_at` text,
	`rejected_at` text,
	`retired_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `adaptive_structure_model_tenant_workflow_status_idx` ON `adaptive_structure_model` (`tenant_id`,`target_workflow`,`status`);
--> statement-breakpoint
CREATE INDEX `adaptive_structure_model_source_session_idx` ON `adaptive_structure_model` (`source_upload_session_id`);
