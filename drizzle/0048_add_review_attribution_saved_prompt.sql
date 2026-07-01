CREATE TABLE `review_attribution_saved_prompt` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`prompt_text` text NOT NULL,
	`compiled_filter_json` text NOT NULL,
	`filter_version` integer DEFAULT 1 NOT NULL,
	`scope` text DEFAULT 'tenant' NOT NULL,
	`work_type` text DEFAULT 'bookkeeping' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by_staff_id` text,
	`updated_by_staff_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_attr_saved_prompt_tenant_active_sort_idx` ON `review_attribution_saved_prompt` (`tenant_id`,`is_active`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `review_attr_saved_prompt_tenant_name_idx` ON `review_attribution_saved_prompt` (`tenant_id`,`name`);
