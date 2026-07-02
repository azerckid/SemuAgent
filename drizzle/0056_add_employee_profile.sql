-- 수동 증분 SQL: employee_profile 테이블 추가
-- 적용 대상: 0055까지 적용된 DB
-- 목적: JC-015 직원 명부. 급여 실행 결과(payroll_employee_line)와 분리된 상시 직원 마스터.
--       주민등록번호·계좌번호·전화번호 원문은 저장하지 않고, 이름·사번·부서·업무 이메일만 관리한다.

CREATE TABLE `employee_profile` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `employee_code` text,
  `display_name` text NOT NULL,
  `department` text,
  `job_title` text,
  `employee_status` text DEFAULT 'active' NOT NULL,
  `payroll_eligibility` text DEFAULT 'eligible' NOT NULL,
  `insurance_enrollment_status` text DEFAULT 'not_checked' NOT NULL,
  `hire_date` text,
  `termination_date` text,
  `work_email` text,
  `notification_enabled` integer DEFAULT true NOT NULL,
  `created_by_staff_id` text,
  `updated_by_staff_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`updated_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_profile_code_uidx`
  ON `employee_profile` (`tenant_id`, `client_id`, `employee_code`);
--> statement-breakpoint
CREATE INDEX `employee_profile_status_idx`
  ON `employee_profile` (`tenant_id`, `client_id`, `employee_status`);
--> statement-breakpoint
CREATE INDEX `employee_profile_payroll_idx`
  ON `employee_profile` (`tenant_id`, `client_id`, `payroll_eligibility`);
