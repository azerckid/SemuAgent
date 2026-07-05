-- JC-031 Slice 2c: transaction-purpose는 self-use 내부 기록으로 유지하되
-- outbound_email FK(sent_email_id)를 제거한다. 발송 경로는 이미 410/삭제됨.

ALTER TABLE `bookkeeping_transaction_purpose_request` DROP COLUMN `sent_email_id`;
