-- 고객 업로드 포털의 자료 항목 선언(없음 표시 / 나중에 제출)을 저장한다.
-- request_item_validation(AI/담당자, itemName 키, 평가 시 생성)과 분리해
-- 세션 × 체크리스트 항목 단위로 보관한다. 완료 판정은 담당자 게이트를
-- 유지하며 이 선언이 자동 충족시키지 않는다.
-- ref: docs/03_Technical_Specs/34_CLIENT_ITEM_DECLARATION_SPEC.md
CREATE TABLE `upload_item_declaration` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `upload_session_id` text NOT NULL,
  `checklist_item_id` text NOT NULL,
  `declaration` text NOT NULL,
  `note` text,
  `declared_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
-- 한 세션의 한 항목에 선언은 하나만 (조건절 없는 일반 복합 unique).
CREATE UNIQUE INDEX `uid_tenant_session_item_uidx`
  ON `upload_item_declaration` (`tenant_id`, `upload_session_id`, `checklist_item_id`);
--> statement-breakpoint
CREATE INDEX `uid_tenant_session_idx`
  ON `upload_item_declaration` (`tenant_id`, `upload_session_id`);
