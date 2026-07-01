-- 수동 증분 SQL: bookkeeping_transaction_purpose_request,
--               bookkeeping_transaction_purpose_request_row 테이블 추가
-- 적용 대상: 0051까지 적용된 DB
-- 목적: 계정항목 정리 중 확정이 어려운 거래를 고객에게 "거래 용도 확인"으로
--       묻는 요청 batch와 그 row. 고객 답변은 최종 회계처리가 아니라 담당자
--       판단 근거로 저장된다.
--       (docs/03_Technical_Specs/40_TRANSACTION_PURPOSE_CONFIRMATION_SPEC.md §4)
-- 참고: outbound_email.type enum에 transaction_purpose_request 값을 추가했으나
--       SQLite text enum은 앱 전용 제약이라 별도 DDL은 불필요(코드 전용 변경).

CREATE TABLE `bookkeeping_transaction_purpose_request` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `upload_session_id` text NOT NULL,
  `classification_run_id` text,
  `client_id` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `subject_snapshot` text NOT NULL,
  `body_snapshot` text NOT NULL,
  `due_at` text,
  `sent_email_id` text,
  `created_by_staff_id` text NOT NULL,
  `sent_by_staff_id` text,
  `sent_at` text,
  `submitted_at` text,
  `closed_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`classification_run_id`) REFERENCES `bookkeeping_classification_run`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`sent_email_id`) REFERENCES `outbound_email`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`sent_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bk_purpose_request_session_created_idx` ON `bookkeeping_transaction_purpose_request` (`tenant_id`, `upload_session_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `bk_purpose_request_status_idx` ON `bookkeeping_transaction_purpose_request` (`tenant_id`, `status`);
--> statement-breakpoint
CREATE INDEX `bk_purpose_request_client_created_idx` ON `bookkeeping_transaction_purpose_request` (`tenant_id`, `client_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `bookkeeping_transaction_purpose_request_row` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `purpose_request_id` text NOT NULL,
  `classification_row_id` text,
  `source_display_date` text,
  `source_display_counterparty` text,
  `source_display_amount_krw` integer,
  `source_display_memo` text,
  `staff_question` text NOT NULL,
  `ai_recommended_account` text,
  `ambiguity_reason` text,
  `client_purpose_code` text,
  `client_purpose_memo` text,
  `client_answered_at` text,
  `staff_final_account` text,
  `staff_memo` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`purpose_request_id`) REFERENCES `bookkeeping_transaction_purpose_request`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`classification_row_id`) REFERENCES `bookkeeping_transaction_classification`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bk_purpose_row_request_idx` ON `bookkeeping_transaction_purpose_request_row` (`tenant_id`, `purpose_request_id`);
--> statement-breakpoint
CREATE INDEX `bk_purpose_row_classification_idx` ON `bookkeeping_transaction_purpose_request_row` (`tenant_id`, `classification_row_id`);
--> statement-breakpoint
CREATE INDEX `bk_purpose_row_status_idx` ON `bookkeeping_transaction_purpose_request_row` (`tenant_id`, `status`);
