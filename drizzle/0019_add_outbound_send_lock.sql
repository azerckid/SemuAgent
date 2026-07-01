-- 0019_add_outbound_send_lock.sql
-- 요청 발송 멱등성: 동일 client_request_event의 동시 실행만 차단한다.
-- unique는 status = 'running' partial 인덱스로 적용하므로
-- 락이 'completed'/'failed'로 release되면 unique 슬롯에서 빠져 재시도 가능하다.
-- 락 row 자체는 감사용으로 영구 보존한다.

CREATE TABLE outbound_send_lock (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenant(id),
  request_event_id text NOT NULL REFERENCES client_request_event(id),
  status text NOT NULL DEFAULT 'running',
  started_at text NOT NULL,
  completed_at text,
  created_at text NOT NULL
);

CREATE UNIQUE INDEX outbound_send_lock_running_uidx
  ON outbound_send_lock(request_event_id)
  WHERE status = 'running';
