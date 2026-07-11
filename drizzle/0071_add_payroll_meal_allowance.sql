-- 수동 증분 SQL: 급여대장 payroll_employee_line에 비과세 식대(meal_allowance_krw)
-- 컬럼 추가. 지급계에는 포함되지만 기타수당(allowance_krw)과 분리해 표시하고,
-- 과세소득·4대보험 근사 기준에서는 제외한다(월 20만원 한도 비과세 식대).
-- NOT NULL DEFAULT 0으로 추가해 기존 행은 식대 0으로 시작한다.
-- 적용 대상: 0070까지 적용된 DB

ALTER TABLE `payroll_employee_line` ADD COLUMN `meal_allowance_krw` integer DEFAULT 0 NOT NULL;
