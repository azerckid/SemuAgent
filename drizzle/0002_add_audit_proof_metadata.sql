-- =====================================================================
-- 수동 증분 SQL: audit_proof 온체인 메타 컬럼 추가
-- =====================================================================
-- 목적: audit_proof 테이블에 Giwa Chain proof layer용 컬럼 6개를 추가합니다.
--       (chain, chain_id, contract_address, explorer_url, payload_hash, confirmed_at)
--
-- 적용 대상:
--   - 0000 또는 0001이 적용된 DB (audit_proof 테이블이 이미 존재하는 환경)
--
-- 적용 제외:
--   - 신규 설치 환경 → 0000_sloppy_tarantula.sql 하나만 적용하면 됩니다.
--
-- 주의:
--   이 파일은 Drizzle _journal.json에 등록되지 않은 수동 파일입니다.
--   pnpm db:migrate로 자동 적용되지 않습니다.
--   Turso CLI 또는 db:studio에서 직접 실행하세요.
--   자세한 내용: drizzle/README.md
-- =====================================================================

ALTER TABLE `audit_proof` ADD COLUMN `chain` text;
--> statement-breakpoint
ALTER TABLE `audit_proof` ADD COLUMN `chain_id` integer;
--> statement-breakpoint
ALTER TABLE `audit_proof` ADD COLUMN `contract_address` text;
--> statement-breakpoint
ALTER TABLE `audit_proof` ADD COLUMN `explorer_url` text;
--> statement-breakpoint
ALTER TABLE `audit_proof` ADD COLUMN `payload_hash` text;
--> statement-breakpoint
ALTER TABLE `audit_proof` ADD COLUMN `confirmed_at` text;
