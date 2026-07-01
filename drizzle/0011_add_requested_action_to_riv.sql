-- request_item_validation에 requested_action 컬럼 추가
-- 세션 평가 기준별 "클라이언트에게 요청할 조치"를 저장 (보충 요청 초안 생성에 사용)

ALTER TABLE `request_item_validation` ADD COLUMN `requested_action` text;
