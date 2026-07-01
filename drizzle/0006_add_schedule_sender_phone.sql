-- 수동 증분 SQL: client_request_schedule.sender_phone_template 컬럼 추가
-- 적용 대상: 0005까지 적용된 DB
-- SQLite는 ADD COLUMN을 지원합니다 (NOT NULL 없이)

ALTER TABLE `client_request_schedule` ADD COLUMN `sender_phone_template` text;
