-- 0021_add_billing_tables.sql
-- Toss Payments 정기결제 준비용 테이블.
-- 실제 과금 활성화는 TOSS_BILLING_ENABLED / TOSS_BILLING_AUTO_CHARGE_ENABLED env와
-- 운영 승인 절차로 별도 제어한다.

CREATE TABLE IF NOT EXISTS billing_plan (
  code text PRIMARY KEY,
  name text NOT NULL,
  max_clients integer,
  monthly_price_krw integer,
  currency text NOT NULL DEFAULT 'KRW',
  vat_included integer NOT NULL DEFAULT 0,
  active integer NOT NULL DEFAULT 1,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_customer (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenant(id),
  provider text NOT NULL,
  provider_customer_key text NOT NULL,
  provider_billing_key text,
  billing_email text,
  billing_name text,
  method_type text NOT NULL DEFAULT 'card',
  payment_method_snapshot text,
  billing_key_issued_at text,
  created_by_staff_id text REFERENCES staff(id),
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_customer_tenant_provider_uidx
ON billing_customer (tenant_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS billing_customer_provider_key_uidx
ON billing_customer (provider_customer_key);

CREATE TABLE IF NOT EXISTS tenant_subscription (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenant(id),
  plan_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment',
  contract_type text NOT NULL,
  provider text NOT NULL,
  billing_customer_id text REFERENCES billing_customer(id),
  billing_owner_staff_id text REFERENCES staff(id),
  current_period_start text,
  current_period_end text,
  next_billing_at text,
  cancel_at text,
  canceled_at text,
  provider_subscription_id text,
  provider_payment_method_id text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_subscription_tenant_uidx
ON tenant_subscription (tenant_id);

CREATE INDEX IF NOT EXISTS tenant_subscription_status_idx
ON tenant_subscription (status);

CREATE TABLE IF NOT EXISTS billing_invoice_event (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenant(id),
  subscription_id text REFERENCES tenant_subscription(id),
  billing_customer_id text REFERENCES billing_customer(id),
  provider text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL,
  order_id text,
  amount_krw integer,
  currency text NOT NULL DEFAULT 'KRW',
  payment_key text,
  provider_event_id text,
  provider_code text,
  provider_message text,
  provider_payload text,
  idempotency_key text,
  occurred_at text NOT NULL,
  created_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS billing_invoice_event_tenant_idx
ON billing_invoice_event (tenant_id, occurred_at);

CREATE INDEX IF NOT EXISTS billing_invoice_event_subscription_idx
ON billing_invoice_event (subscription_id, occurred_at);
