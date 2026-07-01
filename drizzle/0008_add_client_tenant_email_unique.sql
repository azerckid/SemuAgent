-- Prevent duplicate customer records inside the same accounting-firm tenant.
-- Precondition: existing duplicate rows for the same (tenant_id, email) must be merged or removed.

CREATE UNIQUE INDEX IF NOT EXISTS `client_tenant_email_uidx`
ON `client` (`tenant_id`, lower(`email`));
