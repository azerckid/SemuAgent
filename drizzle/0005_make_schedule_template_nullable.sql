-- =====================================================================
-- 수동 증분 SQL: client_request_schedule.request_template_id nullable 변경
-- =====================================================================
-- 목적: 인라인 메일 초안으로 정기 설정 저장 시 FK 제약 오류 방지.
--       SQLite는 ALTER COLUMN을 지원하지 않으므로 테이블 재생성 필요.
--
-- SQLite 제약: DROP/MODIFY COLUMN 미지원 → 재생성 패턴 사용
-- 적용 대상: 0004까지 적용된 DB
--
-- ⚠️  FK 주의사항:
--   client_request_event.request_schedule_id가 이 테이블을 참조합니다.
--   Turso/libSQL은 기본적으로 FK enforcement가 꺼져 있어 (PRAGMA foreign_keys = OFF)
--   기존 이벤트가 있어도 DROP이 성공합니다.
--   FK가 켜진 환경에서는 적용 전 'PRAGMA foreign_keys = OFF;'를 먼저 실행하세요.
--   데이터는 backup 테이블을 통해 완전히 보존됩니다.
-- =====================================================================

-- 1. 기존 데이터 백업용 임시 테이블 생성
CREATE TABLE `client_request_schedule_backup` AS SELECT * FROM `client_request_schedule`;
--> statement-breakpoint
-- 2. 기존 테이블 삭제
DROP TABLE `client_request_schedule`;
--> statement-breakpoint
-- 3. request_template_id nullable로 재생성
CREATE TABLE `client_request_schedule` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `request_template_id` text,
  `frequency` text NOT NULL,
  `starts_on` text NOT NULL,
  `ends_on` text,
  `timezone` text DEFAULT 'Asia/Seoul' NOT NULL,
  `generation_policy` text DEFAULT 'manual' NOT NULL,
  `send_policy` text DEFAULT 'approval_required' NOT NULL,
  `due_rule` text,
  `send_rule` text,
  `email_subject_template` text,
  `email_body_template` text,
  `email_greeting_template` text,
  `analysis_criteria_template` text,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`request_template_id`) REFERENCES `request_template`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- 4. 기존 데이터 복원
INSERT INTO `client_request_schedule` SELECT * FROM `client_request_schedule_backup`;
--> statement-breakpoint
-- 5. 백업 테이블 삭제
DROP TABLE `client_request_schedule_backup`;
