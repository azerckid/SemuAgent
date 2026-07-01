-- 0016_add_payroll_running_batch_unique.sql
-- 동일 세션에서 동시에 두 개의 running batch가 생기는 race condition을 DB 레벨에서 차단.
-- partial unique index로 status='running'인 row만 unique 강제.

CREATE UNIQUE INDEX IF NOT EXISTS payroll_batch_running_uidx
ON payroll_extraction_batch (upload_session_id)
WHERE status = 'running';
