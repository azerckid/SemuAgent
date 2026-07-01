-- 0017_update_payroll_template_storage_key.sql
-- PR #16에서 배포 런타임 템플릿을 public/payroll/templates 로 이동.
-- 기존 테스트/배포 중 자동 생성된 템플릿 레코드는 docs/payroll/Output 경로를 들고 있을 수 있어 새 storage_key로 보정한다.

UPDATE payroll_excel_template
SET storage_key = 'public/payroll/templates/업로드용_엑셀파일.xlsx'
WHERE storage_key = 'docs/payroll/Output/업로드용_엑셀파일.xlsx';
