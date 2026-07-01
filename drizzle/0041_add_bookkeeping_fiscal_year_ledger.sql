-- 고객사 + 회계연도 단위의 기장 장부 read model.
-- 월별 업로드 세션은 입력 이벤트로 유지하고, 이 테이블은 연간 누적 상태를 보여주는 틀만 제공한다.
CREATE TABLE `bookkeeping_fiscal_year_ledger` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `fiscal_year` integer NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookkeeping_fiscal_ledger_tenant_client_year_uidx`
  ON `bookkeeping_fiscal_year_ledger` (`tenant_id`, `client_id`, `fiscal_year`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_fiscal_ledger_status_idx`
  ON `bookkeeping_fiscal_year_ledger` (`tenant_id`, `status`);
--> statement-breakpoint

-- 회계연도 장부의 12개월 슬롯. 자료가 없는 달도 빈 월로 표시하기 위해 별도 row로 둔다.
CREATE TABLE `bookkeeping_ledger_month` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `ledger_id` text NOT NULL,
  `period_month` text NOT NULL,
  `status` text DEFAULT 'not_requested' NOT NULL,
  `last_upload_session_id` text,
  `last_material_attribution_run_at` text,
  `last_classification_run_id` text,
  `last_journal_entry_run_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookkeeping_ledger_month_tenant_ledger_month_uidx`
  ON `bookkeeping_ledger_month` (`tenant_id`, `ledger_id`, `period_month`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_ledger_month_ledger_idx`
  ON `bookkeeping_ledger_month` (`tenant_id`, `ledger_id`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_ledger_month_status_idx`
  ON `bookkeeping_ledger_month` (`tenant_id`, `status`);
