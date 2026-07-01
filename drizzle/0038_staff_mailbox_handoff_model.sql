-- 업무 메일주소 소유/인계 모델 보정.
-- staff_mailbox.staff_id(NOT NULL) -> current_staff_id(nullable)로 변경하고
-- state enum에 handoff_required를 추가한다. state는 DB CHECK 제약이 없는
-- plain text 컬럼이라 enum 확장은 schema.ts 변경만으로 충분하며 이 마이그레이션
-- 대상이 아니다.
--
-- SQLite는 컬럼 rename + NOT NULL 해제를 한 번에 ALTER COLUMN으로 할 수 없어
-- 재생성 패턴을 쓴다 (참고: drizzle/0005_make_schedule_template_nullable.sql).
-- id 값은 명시적 컬럼 매핑으로 그대로 보존되므로 inbound_email.staff_mailbox_id
-- 연결은 깨지지 않는다 (이 마이그레이션은 inbound_email을 건드리지 않음).

CREATE TABLE `staff_mailbox_backup` AS SELECT * FROM `staff_mailbox`;
--> statement-breakpoint
DROP TABLE `staff_mailbox`;
--> statement-breakpoint
CREATE TABLE `staff_mailbox` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `current_staff_id` text,
  `alias` text NOT NULL,
  `address` text NOT NULL,
  `state` text DEFAULT 'active' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `staff_mailbox`
  (`id`, `tenant_id`, `current_staff_id`, `alias`, `address`, `state`, `created_at`, `updated_at`)
  SELECT `id`, `tenant_id`, `staff_id`, `alias`, `address`, `state`, `created_at`, `updated_at`
  FROM `staff_mailbox_backup`;
--> statement-breakpoint
DROP TABLE `staff_mailbox_backup`;
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_mailbox_address_uidx` ON `staff_mailbox` (`address`);
--> statement-breakpoint
CREATE INDEX `staff_mailbox_tenant_idx` ON `staff_mailbox` (`tenant_id`);
--> statement-breakpoint

CREATE TABLE `staff_mailbox_assignment_history` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `staff_mailbox_id` text NOT NULL,
  `from_staff_id` text,
  `to_staff_id` text,
  `action` text NOT NULL,
  `reason` text,
  `actor_staff_id` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_mailbox_assignment_history_mailbox_idx` ON `staff_mailbox_assignment_history` (`staff_mailbox_id`);
--> statement-breakpoint
CREATE INDEX `staff_mailbox_assignment_history_tenant_idx` ON `staff_mailbox_assignment_history` (`tenant_id`);
