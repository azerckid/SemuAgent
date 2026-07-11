-- 수동 증분 SQL: 급여대장 payroll_employee_line에 공제대상가족수(dependent_count)
-- 컬럼 추가. 근로소득 간이세액표(소득세법 시행령 별표2) 조회로 정규직 소득세를 산출할 때
-- 쓰는 본인 포함 공제대상가족수다. 프리랜서·일용직은 간이세액표 대상이 아니라 기본 1로 둔다.
-- NOT NULL DEFAULT 1로 추가해 기존 행은 공제대상가족수 1(본인만)로 시작한다.
-- 적용 대상: 0071까지 적용된 DB

ALTER TABLE `payroll_employee_line` ADD COLUMN `dependent_count` integer DEFAULT 1 NOT NULL;
