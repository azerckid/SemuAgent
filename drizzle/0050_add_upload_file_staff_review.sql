ALTER TABLE `upload_file` ADD `staff_review_status` text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE `upload_file` ADD `staff_review_note` text;
--> statement-breakpoint
ALTER TABLE `upload_file` ADD `staff_reviewed_by_staff_id` text REFERENCES `staff`(`id`);
--> statement-breakpoint
ALTER TABLE `upload_file` ADD `staff_reviewed_at` text;
