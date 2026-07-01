-- 0032_add_tenant_billing_profile.sql
-- 수동 세금계산서/유료 파일럿 운영을 위한 테넌트 청구정보.
-- Toss billing_customer와 분리해 PG 빌링키 없이도 청구 주체 정보를 관리한다.

CREATE TABLE IF NOT EXISTS tenant_billing_profile (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenant(id),
  business_registration_number text NOT NULL,
  business_name text NOT NULL,
  representative_name text NOT NULL,
  business_address text NOT NULL,
  business_type text,
  business_item text,
  tax_invoice_email text NOT NULL,
  billing_contact_name text NOT NULL,
  billing_contact_phone text NOT NULL,
  memo text,
  created_by_staff_id text REFERENCES staff(id),
  updated_by_staff_id text REFERENCES staff(id),
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_billing_profile_tenant_uidx
ON tenant_billing_profile (tenant_id);
