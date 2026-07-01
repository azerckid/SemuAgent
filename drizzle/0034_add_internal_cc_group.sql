CREATE TABLE `internal_cc_group` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `name` text NOT NULL,
  `purpose` text DEFAULT 'general' NOT NULL,
  `emails` text NOT NULL,
  `is_default` integer DEFAULT false NOT NULL,
  `created_by_staff_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `internal_cc_group_tenant_idx`
  ON `internal_cc_group` (`tenant_id`);

CREATE UNIQUE INDEX `internal_cc_group_name_uidx`
  ON `internal_cc_group` (`tenant_id`, lower(`name`));
