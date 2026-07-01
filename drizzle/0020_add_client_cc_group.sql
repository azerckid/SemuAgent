-- 0020_add_client_cc_group.sql
-- 고객사별 요청 메일 참조 그룹.
-- 기존 request_event / schedule / upload_session 의 cc_email snapshot 흐름은 유지하고,
-- 그룹 선택 시점에 정규화된 이메일 문자열로 풀어 저장한다.

CREATE TABLE IF NOT EXISTS client_cc_group (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenant(id),
  client_id text NOT NULL REFERENCES client(id),
  name text NOT NULL,
  purpose text NOT NULL DEFAULT 'general',
  emails text NOT NULL,
  is_default integer NOT NULL DEFAULT 0,
  created_by_staff_id text REFERENCES staff(id),
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS client_cc_group_client_idx
ON client_cc_group (tenant_id, client_id);

CREATE UNIQUE INDEX IF NOT EXISTS client_cc_group_name_uidx
ON client_cc_group (tenant_id, client_id, lower(name));
