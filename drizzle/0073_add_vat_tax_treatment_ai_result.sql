CREATE TABLE `vat_tax_treatment_ai_result` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `period_key` text NOT NULL,
  `classification_row_id` text NOT NULL,
  `input_fingerprint` text NOT NULL,
  `rule_version` text NOT NULL,
  `prompt_version` text NOT NULL,
  `status` text DEFAULT 'queued' NOT NULL,
  `payload_version` integer DEFAULT 1 NOT NULL,
  `result_payload_json` text,
  `result_fingerprint` text,
  `provider_trace_json` text DEFAULT '[]' NOT NULL,
  `execution_token` text,
  `attempt_count` integer DEFAULT 0 NOT NULL,
  `started_at` text,
  `completed_at` text,
  `next_retry_at` text,
  `created_at` text NOT NULL,
  `lease_expires_at` text,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`classification_row_id`) REFERENCES `bookkeeping_transaction_classification`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vat_tax_treatment_ai_result_scope_fingerprint_uidx`
  ON `vat_tax_treatment_ai_result` (`tenant_id`,`client_id`,`period_key`,`classification_row_id`,`input_fingerprint`,`rule_version`,`prompt_version`);
--> statement-breakpoint
CREATE UNIQUE INDEX `vat_tax_treatment_ai_result_active_scope_uidx`
  ON `vat_tax_treatment_ai_result` (`tenant_id`,`client_id`,`period_key`,`classification_row_id`)
  WHERE `status` IN ('queued','running');
--> statement-breakpoint
CREATE INDEX `vat_tax_treatment_ai_result_status_idx`
  ON `vat_tax_treatment_ai_result` (`tenant_id`,`client_id`,`period_key`,`status`);
--> statement-breakpoint
CREATE INDEX `vat_tax_treatment_ai_result_classification_idx`
  ON `vat_tax_treatment_ai_result` (`tenant_id`,`classification_row_id`);
