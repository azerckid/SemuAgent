CREATE TABLE `adaptive_structure_model_run` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`model_id` text,
	`upload_session_id` text NOT NULL,
	`status` text NOT NULL,
	`engine_version` text,
	`matched_row_count` integer DEFAULT 0 NOT NULL,
	`blocked_row_count` integer DEFAULT 0 NOT NULL,
	`warnings_json` text DEFAULT '[]' NOT NULL,
	`blockers_json` text DEFAULT '[]' NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`model_id`) REFERENCES `adaptive_structure_model`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `adaptive_structure_model_run_tenant_idx` ON `adaptive_structure_model_run` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `adaptive_structure_model_run_model_idx` ON `adaptive_structure_model_run` (`model_id`);
--> statement-breakpoint
CREATE INDEX `adaptive_structure_model_run_session_idx` ON `adaptive_structure_model_run` (`upload_session_id`);
