CREATE TABLE `bookkeeping_journal_entry_run` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `upload_session_id` text NOT NULL,
  `classification_run_id` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `row_count` integer DEFAULT 0 NOT NULL,
  `unresolved_row_count` integer DEFAULT 0 NOT NULL,
  `applied_rules_snapshot` text NOT NULL,
  `error_message` text,
  `created_by_staff_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`classification_run_id`) REFERENCES `bookkeeping_classification_run`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `bookkeeping_journal_run_session_created_idx`
  ON `bookkeeping_journal_entry_run` (`tenant_id`, `upload_session_id`, `created_at`);

CREATE INDEX `bookkeeping_journal_run_status_idx`
  ON `bookkeeping_journal_entry_run` (`tenant_id`, `status`);

CREATE TABLE `bookkeeping_journal_entry_row` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `journal_entry_run_id` text NOT NULL,
  `upload_session_id` text NOT NULL,
  `classification_row_id` text NOT NULL,
  `entry_date` text,
  `requested_period` text NOT NULL,
  `attributed_period` text,
  `close_period` text NOT NULL,
  `debit_account` text,
  `debit_amount_krw` integer,
  `credit_account` text,
  `credit_amount_krw` integer,
  `counterparty` text,
  `memo` text,
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

CREATE INDEX `bookkeeping_journal_row_run_idx`
  ON `bookkeeping_journal_entry_row` (`tenant_id`, `journal_entry_run_id`);

CREATE INDEX `bookkeeping_journal_row_session_idx`
  ON `bookkeeping_journal_entry_row` (`tenant_id`, `upload_session_id`);

CREATE INDEX `bookkeeping_journal_row_status_idx`
  ON `bookkeeping_journal_entry_row` (`tenant_id`, `status`);
