-- 0015_add_payroll_ai_verdict.sql
-- payroll row별 AI 판정 결과. 담당자 확정(review_status)과 분리한다.

ALTER TABLE payroll_extraction_row ADD COLUMN ai_verdict TEXT;
ALTER TABLE payroll_extraction_row ADD COLUMN ai_verdict_reason TEXT;
