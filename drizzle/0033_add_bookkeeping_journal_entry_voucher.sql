CREATE TABLE `bookkeeping_journal_entry_voucher` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `journal_entry_run_id` text NOT NULL,
  `upload_session_id` text NOT NULL,
  `classification_row_id` text NOT NULL,
  `source_classification_row_ids` text,
  `voucher_number` text NOT NULL,
  `entry_date` text,
  `requested_period` text NOT NULL,
  `attributed_period` text,
  `close_period` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `reason` text,
  `staff_memo` text,
  `confirmed_by_staff_id` text,
  `confirmed_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`journal_entry_run_id`) REFERENCES `bookkeeping_journal_entry_run`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`classification_row_id`) REFERENCES `bookkeeping_transaction_classification`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`confirmed_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `bookkeeping_journal_voucher_run_idx`
  ON `bookkeeping_journal_entry_voucher` (`tenant_id`, `journal_entry_run_id`);

CREATE INDEX `bookkeeping_journal_voucher_session_idx`
  ON `bookkeeping_journal_entry_voucher` (`tenant_id`, `upload_session_id`);

CREATE INDEX `bookkeeping_journal_voucher_number_idx`
  ON `bookkeeping_journal_entry_voucher` (`tenant_id`, `journal_entry_run_id`, `voucher_number`);

CREATE TABLE `bookkeeping_journal_entry_voucher_line` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `voucher_id` text NOT NULL,
  `line_sequence` integer NOT NULL,
  `side` text NOT NULL,
  `account_name` text,
  `account_code` text,
  `amount_krw` integer DEFAULT 0 NOT NULL,
  `counterparty` text,
  `counterparty_code` text,
  `memo` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`voucher_id`) REFERENCES `bookkeeping_journal_entry_voucher`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `bookkeeping_journal_voucher_line_voucher_idx`
  ON `bookkeeping_journal_entry_voucher_line` (`tenant_id`, `voucher_id`, `line_sequence`);
