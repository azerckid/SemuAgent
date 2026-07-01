-- 업무 메일함 Slice 2 정식 데이터 모델. Slice 1 PoC 샌드박스(inbound_email_event)를 대체.
DROP TABLE IF EXISTS `inbound_email_event`;

CREATE TABLE `staff_mailbox` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `staff_id` text NOT NULL,
  `alias` text NOT NULL,
  `address` text NOT NULL,
  `state` text DEFAULT 'active' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE UNIQUE INDEX `staff_mailbox_address_uidx` ON `staff_mailbox` (`address`);
CREATE INDEX `staff_mailbox_tenant_idx` ON `staff_mailbox` (`tenant_id`);

CREATE TABLE `inbound_email` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `staff_mailbox_id` text NOT NULL,
  `provider` text NOT NULL,
  `provider_message_id` text NOT NULL,
  `direction` text DEFAULT 'inbound' NOT NULL,
  `from_email` text,
  `to_email` text NOT NULL,
  `cc_email` text,
  `subject` text,
  `text_body` text,
  `html_body` text,
  `received_at` text,
  `client_label_id` text,
  `processing_status` text DEFAULT 'stored' NOT NULL,
  `raw_payload_hash` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE UNIQUE INDEX `inbound_email_provider_message_uidx`
  ON `inbound_email` (`provider`, `provider_message_id`);
CREATE INDEX `inbound_email_mailbox_idx` ON `inbound_email` (`staff_mailbox_id`);
CREATE INDEX `inbound_email_tenant_idx` ON `inbound_email` (`tenant_id`);
CREATE INDEX `inbound_email_client_label_idx` ON `inbound_email` (`client_label_id`);

CREATE TABLE `inbound_email_attachment` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `inbound_email_id` text NOT NULL,
  `provider_attachment_id` text,
  `original_filename` text,
  `content_type` text,
  `file_size` integer,
  `storage_key` text,
  `content_hash` text,
  `status` text DEFAULT 'stored' NOT NULL,
  `created_at` text NOT NULL
);

CREATE INDEX `inbound_email_attachment_email_idx` ON `inbound_email_attachment` (`inbound_email_id`);
CREATE INDEX `inbound_email_attachment_tenant_idx` ON `inbound_email_attachment` (`tenant_id`);
