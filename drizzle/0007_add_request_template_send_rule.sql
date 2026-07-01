-- 수동 증분 SQL: request_template.send_rule 컬럼 추가
-- 적용 대상: 0006까지 적용된 DB
-- SQLite는 ADD COLUMN을 지원합니다 (NOT NULL 없이)

ALTER TABLE `request_template` ADD COLUMN `send_rule` text;
