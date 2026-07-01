CREATE TABLE `inbound_email_event` (
  `id` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL,
  `provider_event_id` text NOT NULL,
  `event_type` text NOT NULL,
  `to_email` text NOT NULL,
  `mailbox_alias` text NOT NULL,
  `attachment_count` integer DEFAULT 0 NOT NULL,
  `received_at` text,
  `raw_payload_hash` text NOT NULL,
  `created_at` text NOT NULL
);

CREATE UNIQUE INDEX `inbound_email_event_provider_event_uidx`
  ON `inbound_email_event` (`provider`, `provider_event_id`);
