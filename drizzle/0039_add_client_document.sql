-- 고객사 보관 문서(사업자등록증·통장사본 등). 직원이 직접 업로드하는
-- 내부 보관 용도이며, 클라이언트 업로드 포털(/upload/[token])과 무관하다.
CREATE TABLE `client_document` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `document_type` text NOT NULL,
  `original_filename` text NOT NULL,
  `storage_key` text NOT NULL,
  `content_type` text NOT NULL,
  `file_size` integer NOT NULL,
  `content_hash` text NOT NULL,
  `uploaded_by_staff_id` text NOT NULL,
  `memo` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `client_document_client_idx` ON `client_document` (`tenant_id`, `client_id`);
