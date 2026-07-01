-- 0022_add_billing_webhook_event.sql
-- Toss Payments webhook idempotency and processing audit log.
-- This is additive only; it does not enable real charging.

CREATE TABLE IF NOT EXISTS billing_webhook_event (
  id text PRIMARY KEY,
  provider text NOT NULL,
  idempotency_key text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  tenant_id text REFERENCES tenant(id),
  subscription_id text REFERENCES tenant_subscription(id),
  billing_customer_id text REFERENCES billing_customer(id),
  provider_event_id text,
  transmission_id text,
  transmission_time text,
  retried_count integer,
  provider_code text,
  provider_message text,
  provider_payload text,
  received_at text NOT NULL,
  processed_at text,
  created_at text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_webhook_event_idempotency_uidx
ON billing_webhook_event (idempotency_key);

CREATE INDEX IF NOT EXISTS billing_webhook_event_status_idx
ON billing_webhook_event (status, received_at);

CREATE INDEX IF NOT EXISTS billing_webhook_event_tenant_idx
ON billing_webhook_event (tenant_id, received_at);
