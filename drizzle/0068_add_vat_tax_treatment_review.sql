CREATE TABLE `vat_tax_treatment_review` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `period_key` text NOT NULL,
  `classification_row_id` text NOT NULL,
  `direction` text NOT NULL,
  `recommendation` text NOT NULL,
  `recommendation_source` text NOT NULL,
  `confidence` text NOT NULL,
  `basis_label` text NOT NULL,
  `rule_reference` text,
  `rule_version` text NOT NULL,
  `ai_provider` text,
  `ai_model_name` text,
  `ai_prompt_version` text,
  `required_evidence_json` text NOT NULL,
  `missing_facts_json` text NOT NULL,
  `hometax_comparison_mode` text NOT NULL,
  `hometax_action` text NOT NULL,
  `recommendation_fingerprint` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `final_decision` text,
  `final_reason` text,
  `proration_rate_bps` integer,
  `confirmed_by_staff_id` text,
  `confirmed_at` text,
  `recommended_at` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`classification_row_id`) REFERENCES `bookkeeping_transaction_classification`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`confirmed_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX `vat_tax_treatment_review_scope_uidx`
  ON `vat_tax_treatment_review` (`tenant_id`,`client_id`,`period_key`,`classification_row_id`);
CREATE INDEX `vat_tax_treatment_review_status_idx`
  ON `vat_tax_treatment_review` (`tenant_id`,`client_id`,`period_key`,`status`);
CREATE INDEX `vat_tax_treatment_review_classification_idx`
  ON `vat_tax_treatment_review` (`tenant_id`,`classification_row_id`);
