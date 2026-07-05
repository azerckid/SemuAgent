-- JC-031 Slice 2c: transaction-purpose는 self-use 내부 기록으로 유지하되
-- outbound_email FK(sent_email_id)를 제거한다. 발송 경로는 이미 410/삭제됨.
-- SQLite/Turso는 FK 정의가 남아 있는 컬럼을 DROP COLUMN으로 제거할 수 없으므로
-- 테이블을 재작성한다. 기존 컬럼·FK·인덱스는 sent_email_id 관련 항목만 제외하고 보존한다.

PRAGMA foreign_keys=OFF;

CREATE TABLE `__new_bookkeeping_transaction_purpose_request` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `upload_session_id` text NOT NULL,
  `classification_run_id` text,
  `client_id` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `subject_snapshot` text NOT NULL,
  `body_snapshot` text NOT NULL,
  `due_at` text,
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
  FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`sent_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);

INSERT INTO `__new_bookkeeping_transaction_purpose_request` (
  `id`,
  `tenant_id`,
  `upload_session_id`,
  `classification_run_id`,
  `client_id`,
  `status`,
  `subject_snapshot`,
  `body_snapshot`,
  `due_at`,
  `created_by_staff_id`,
  `sent_by_staff_id`,
  `sent_at`,
  `submitted_at`,
  `closed_at`,
  `created_at`,
  `updated_at`
)
SELECT
  `id`,
  `tenant_id`,
  `upload_session_id`,
  `classification_run_id`,
  `client_id`,
  `status`,
  `subject_snapshot`,
  `body_snapshot`,
  `due_at`,
  `created_by_staff_id`,
  `sent_by_staff_id`,
  `sent_at`,
  `submitted_at`,
  `closed_at`,
  `created_at`,
  `updated_at`
FROM `bookkeeping_transaction_purpose_request`;

DROP TABLE `bookkeeping_transaction_purpose_request`;

ALTER TABLE `__new_bookkeeping_transaction_purpose_request`
  RENAME TO `bookkeeping_transaction_purpose_request`;

CREATE INDEX `bk_purpose_request_session_created_idx`
  ON `bookkeeping_transaction_purpose_request` (`tenant_id`, `upload_session_id`, `created_at`);

CREATE INDEX `bk_purpose_request_status_idx`
  ON `bookkeeping_transaction_purpose_request` (`tenant_id`, `status`);

CREATE INDEX `bk_purpose_request_client_created_idx`
  ON `bookkeeping_transaction_purpose_request` (`tenant_id`, `client_id`, `created_at`);

PRAGMA foreign_keys=ON;
