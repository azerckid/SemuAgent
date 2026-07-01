-- Backfill stored display labels for historical customer-upload sessions.
--
-- Customer-upload sessions now use an internal display label such as
-- "고객사명_01" in staff workspaces, while outbound email content continues to
-- use the real client name. Existing customer-upload rows created before that
-- policy may have a NULL staff_direct_label, so this data migration rewrites
-- all customer-upload labels deterministically by tenant + client + creation
-- order. Staff-direct rows are intentionally untouched because their label is
-- now staff-entered.

WITH numbered_customer_sessions AS (
  SELECT
    upload_session.id AS session_id,
    coalesce(nullif(trim(client.name), ''), '고객사')
      || '_'
      || printf(
        '%02d',
        row_number() OVER (
          PARTITION BY upload_session.tenant_id, upload_session.client_id
          ORDER BY upload_session.created_at, upload_session.id
        )
      ) AS display_label
  FROM upload_session
  INNER JOIN client
    ON client.id = upload_session.client_id
   AND client.tenant_id = upload_session.tenant_id
  WHERE upload_session.source = 'customer_upload'
)
UPDATE upload_session
SET staff_direct_label = (
  SELECT display_label
  FROM numbered_customer_sessions
  WHERE numbered_customer_sessions.session_id = upload_session.id
)
WHERE upload_session.id IN (
  SELECT session_id
  FROM numbered_customer_sessions
);
