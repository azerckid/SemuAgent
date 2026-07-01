-- request_item_validation에 criterion_type 컬럼 추가
-- 목적: 요청자료/대사검증/형식검증/기타 검증을 AI 자유문구가 아니라 구조화 값으로 분리

ALTER TABLE `request_item_validation` ADD COLUMN `criterion_type` text;
