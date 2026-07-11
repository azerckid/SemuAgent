CREATE TABLE `vat_tax_treatment_evidence_attestation` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `period_key` text NOT NULL,
  `classification_row_id` text NOT NULL,
  `evidence_code` text NOT NULL,
  `status` text DEFAULT 'present' NOT NULL,
  `confirmed_by_staff_id` text NOT NULL,
  `confirmed_at` text NOT NULL,
  `revoked_by_staff_id` text,
  `revoked_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`classification_row_id`) REFERENCES `bookkeeping_transaction_classification`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`confirmed_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`revoked_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vat_tax_treatment_evidence_attestation_scope_uidx`
  ON `vat_tax_treatment_evidence_attestation` (`tenant_id`,`client_id`,`period_key`,`classification_row_id`,`evidence_code`);
--> statement-breakpoint
CREATE INDEX `vat_tax_treatment_evidence_attestation_status_idx`
  ON `vat_tax_treatment_evidence_attestation` (`tenant_id`,`client_id`,`period_key`,`status`);
--> statement-breakpoint
CREATE INDEX `vat_tax_treatment_evidence_attestation_classification_idx`
  ON `vat_tax_treatment_evidence_attestation` (`tenant_id`,`classification_row_id`);
