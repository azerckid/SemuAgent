-- 수동 증분 SQL: vat_period_summary, vat_deduction_review 테이블 추가
-- 적용 대상: 0052까지 적용된 DB
-- 목적: JC-011 부가세 화면의 세액 스냅샷, 공제 검토, 신고 패키지 잠금 상태 저장.
--       홈택스 제출/납부 자격증명이나 외부 세무사 검토 흐름은 저장하지 않는다.

CREATE TABLE `vat_period_summary` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `period_key` text NOT NULL,
  `period_start_month` text NOT NULL,
  `period_end_month` text NOT NULL,
  `filing_type` text DEFAULT 'final' NOT NULL,
  `taxable_supply_krw` integer DEFAULT 0 NOT NULL,
  `taxable_output_tax_krw` integer DEFAULT 0 NOT NULL,
  `zero_rated_supply_krw` integer DEFAULT 0 NOT NULL,
  `exempt_supply_krw` integer DEFAULT 0 NOT NULL,
  `output_tax_krw` integer DEFAULT 0 NOT NULL,
  `input_tax_krw` integer DEFAULT 0 NOT NULL,
  `input_tax_deductible_krw` integer DEFAULT 0 NOT NULL,
  `payable_tax_krw` integer DEFAULT 0 NOT NULL,
  `pending_deduction_count` integer DEFAULT 0 NOT NULL,
  `is_final` integer DEFAULT false NOT NULL,
  `package_status` text DEFAULT 'locked' NOT NULL,
  `package_storage_key` text,
  `generated_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vat_period_summary_scope_uidx`
  ON `vat_period_summary` (`tenant_id`, `client_id`, `period_key`, `filing_type`);
--> statement-breakpoint
CREATE INDEX `vat_period_summary_period_idx`
  ON `vat_period_summary` (`tenant_id`, `client_id`, `period_key`);
--> statement-breakpoint
CREATE INDEX `vat_period_summary_package_idx`
  ON `vat_period_summary` (`tenant_id`, `client_id`, `package_status`);
--> statement-breakpoint
CREATE TABLE `vat_deduction_review` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `period_key` text NOT NULL,
  `source_voucher_id` text,
  `source_voucher_line_id` text,
  `classification_row_id` text,
  `description` text NOT NULL,
  `counterparty` text,
  `supply_amount_krw` integer DEFAULT 0 NOT NULL,
  `input_tax_krw` integer DEFAULT 0 NOT NULL,
  `kind` text DEFAULT 'deductible' NOT NULL,
  `decision` text DEFAULT 'pending' NOT NULL,
  `reason` text DEFAULT '' NOT NULL,
  `proration_rate_bps` integer,
  `confirmed_by_staff_id` text,
  `confirmed_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`source_voucher_id`) REFERENCES `bookkeeping_journal_entry_voucher`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`source_voucher_line_id`) REFERENCES `bookkeeping_journal_entry_voucher_line`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`classification_row_id`) REFERENCES `bookkeeping_transaction_classification`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`confirmed_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `vat_deduction_review_period_idx`
  ON `vat_deduction_review` (`tenant_id`, `client_id`, `period_key`);
--> statement-breakpoint
CREATE INDEX `vat_deduction_review_decision_idx`
  ON `vat_deduction_review` (`tenant_id`, `client_id`, `period_key`, `decision`);
--> statement-breakpoint
CREATE INDEX `vat_deduction_review_voucher_idx`
  ON `vat_deduction_review` (`tenant_id`, `source_voucher_id`);
--> statement-breakpoint
CREATE INDEX `vat_deduction_review_voucher_line_idx`
  ON `vat_deduction_review` (`tenant_id`, `source_voucher_line_id`);
