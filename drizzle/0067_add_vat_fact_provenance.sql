ALTER TABLE `bookkeeping_transaction_classification` ADD `vat_direction` text;
ALTER TABLE `bookkeeping_transaction_classification` ADD `vat_tax_type` text;
ALTER TABLE `bookkeeping_transaction_classification` ADD `vat_supply_amount_krw` integer;
ALTER TABLE `bookkeeping_transaction_classification` ADD `vat_tax_amount_krw` integer;
ALTER TABLE `bookkeeping_transaction_classification` ADD `vat_gross_amount_krw` integer;
ALTER TABLE `bookkeeping_transaction_classification` ADD `vat_fact_source` text;
ALTER TABLE `bookkeeping_transaction_classification` ADD `vat_fact_source_ref` text;
ALTER TABLE `bookkeeping_transaction_classification` ADD `vat_fact_status` text;
CREATE INDEX `bookkeeping_tx_vat_fact_idx` ON `bookkeeping_transaction_classification` (`tenant_id`,`vat_fact_status`,`vat_direction`);

ALTER TABLE `vat_period_summary` ADD `provenance_version` text;
ALTER TABLE `vat_period_summary` ADD `source_fingerprint` text;
ALTER TABLE `vat_period_summary` ADD `source_row_count` integer;
ALTER TABLE `vat_period_summary` ADD `rebuilt_at` text;
