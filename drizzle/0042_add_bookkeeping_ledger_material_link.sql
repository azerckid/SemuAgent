-- 세션에서 포함 확정된 자료를 회계연도 ledger/month에 연결하는 레코드.
-- source_fingerprint로 같은 물리적 자료의 중복 반영을 막는다.
CREATE TABLE `bookkeeping_ledger_material_link` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `ledger_id` text NOT NULL,
  `period_month` text NOT NULL,
  `upload_session_id` text NOT NULL,
  `upload_file_id` text,
  `material_attribution_id` text,
  `source_fingerprint` text NOT NULL,
  `status` text DEFAULT 'included' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
-- status='included'인 row에만 unique 제약을 둬서 동시 merge 호출이 같은
-- fingerprint로 included row를 두 번 만들지 못하게 한다 (partial unique index).
CREATE UNIQUE INDEX `bookkeeping_ledger_link_included_fingerprint_uidx`
  ON `bookkeeping_ledger_material_link` (`tenant_id`, `ledger_id`, `period_month`, `source_fingerprint`)
  WHERE `status` = 'included';
--> statement-breakpoint
CREATE INDEX `bookkeeping_ledger_link_session_idx`
  ON `bookkeeping_ledger_material_link` (`tenant_id`, `upload_session_id`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_ledger_link_attribution_idx`
  ON `bookkeeping_ledger_material_link` (`tenant_id`, `material_attribution_id`);
--> statement-breakpoint
CREATE INDEX `bookkeeping_ledger_link_status_idx`
  ON `bookkeeping_ledger_material_link` (`tenant_id`, `status`);
