-- =====================================================================
-- 수동 증분 SQL: 인삿말·전화번호 스냅샷 + 담당자 전화번호 컬럼 추가
-- =====================================================================
-- 목적:
--   client_request_event에 인삿말·전화번호 스냅샷 컬럼 2개,
--   staff에 전화번호 컬럼 1개를 추가합니다.
--
-- 적용 대상:
--   0002_add_audit_proof_metadata.sql까지 적용된 DB
--
-- 적용 제외:
--   신규 설치 환경 → 0000_sloppy_tarantula.sql 하나만 적용하면 됩니다.
--
-- 주의:
--   이 파일은 Drizzle _journal.json에 등록되지 않은 수동 파일입니다.
--   pnpm db:migrate로 자동 적용되지 않습니다.
--   자세한 내용: drizzle/README.md
-- =====================================================================

ALTER TABLE `client_request_event` ADD COLUMN `email_greeting_snapshot` text;
--> statement-breakpoint
ALTER TABLE `client_request_event` ADD COLUMN `sender_phone_snapshot` text;
--> statement-breakpoint
ALTER TABLE `staff` ADD COLUMN `phone` text;
