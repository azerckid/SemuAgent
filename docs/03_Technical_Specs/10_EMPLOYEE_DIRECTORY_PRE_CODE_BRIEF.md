# Employee Directory Pre-Code Technical Brief
> Created: 2026-07-02 21:18
> Last Updated: 2026-07-02 21:18

## 0. Governing Principle

JC-015 직원 명부는 급여 실행 결과가 아니라 회사의 상시 직원 마스터다. 급여대장(`payroll_employee_line`)은 특정 귀속월의 실행 스냅샷이고, 직원 명부는 급여·4대보험 고지액 매칭·내부 리마인드의 기준 데이터다.

- 보이는 UI는 회사용 직원 명부 화면 또는 설정 하위 화면으로 새로 구성한다.
- 직원 명부는 회사 내부 운영자/담당자가 관리한다.
- 주민등록번호·계좌번호·전화번호 원문 저장은 v1 기본 범위에서 제외한다. 필요 시 별도 개인정보/암호화 설계를 선행한다.
- 기존 급여 실행 테이블을 직원 마스터처럼 재사용하지 않는다.
- 직원 명부가 생긴 뒤 급여대장, 건강보험 EDI 고지액 매칭, 내부 리마인드 수신자 선택이 이 데이터를 참조한다.

## 1. Scope

JC-015는 다음 기능의 구현 전 계약이다.

1. 직원 목록 조회
2. 직원 추가/수정
3. 재직 상태 관리(재직, 휴직, 퇴사)
4. 급여 대상 여부와 4대보험 확인 상태 관리
5. 급여대장 line과 직원 마스터 연결
6. 내부 리마인드 수신자 후보 제공
7. 로딩, 빈 상태, 오류 상태

이번 문서는 구현 착수용 최종 문서가 아니라, `JC-015`를 Backlog와 데이터 모델에 등록하는 1차 게이트다. UI Preview와 사용자 확인이 완료되어야 코드 구현으로 넘어간다.

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | 후보: `/dashboard/employees` 또는 `/dashboard/settings/employees` |
| 화면 성격 | 운영 데이터 관리 화면. 급여 화면의 하위 표가 아니라 독립 마스터 관리 |
| Read model | `lib/employee-directory/summary.ts` 후보 |
| Persistence | 신규 `employee_profile` 또는 기존 `payroll_employee_line`과 분리된 직원 마스터 테이블 |
| Mutation API | 직원 추가/수정, 재직 상태 변경, 급여 대상 여부 변경 |
| Client UI | 직원 목록, 필터, 상세 패널, 추가/수정 모달 또는 inline editor |
| 개인정보 경계 | raw 주민번호·계좌번호·전화번호 저장 금지. 이름/사번/부서/직책/이메일 최소 |

## 3. Data Contract Draft

```ts
type EmployeeStatus = 'active' | 'leave' | 'terminated'
type PayrollEligibility = 'eligible' | 'excluded'
type InsuranceEnrollmentStatus = 'not_checked' | 'enrolled' | 'needs_review' | 'not_applicable'

type EmployeeDirectorySummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  stats: {
    activeCount: number
    payrollEligibleCount: number
    needsReviewCount: number
    terminatedCount: number
  }
  employees: Array<{
    id: string
    employeeCode: string | null
    displayName: string
    department: string | null
    jobTitle: string | null
    employeeStatus: EmployeeStatus
    payrollEligibility: PayrollEligibility
    insuranceEnrollmentStatus: InsuranceEnrollmentStatus
    hireDate: string | null
    terminationDate: string | null
    workEmail: string | null
    latestPayrollPeriod: string | null
    latestPayrollLineId: string | null
    issueLabel: string | null
  }>
}
```

## 4. Query Sources

| UI 영역 | 데이터 소스 | 최소 필드 | 계산/상태 |
|:---|:---|:---|:---|
| 인증·조직·사업장 | Better Auth session, `tenant`, `client` | tenantId, businessEntityId | 미인증 `/sign-in`, 사업장 없으면 빈 상태 |
| 직원 마스터 | 신규 `employee_profile` 후보 | 사번, 이름, 부서, 직책, 입사일, 퇴사일, 재직상태 | 명부 source of truth |
| 급여 연결 | `payroll_employee_line` | latest payroll period, line id, issue status | 최근 급여 실행 상태 보조 표시 |
| 고지액 매칭 | `payroll_insurance_notice_line` | matchStatus, matchedEmployeeLineId | 4대보험 확인 필요 표시 |
| 리마인드 수신자 | 신규 internal reminder table 후보 | employeeId, workEmail, notificationEnabled | JC-016 수신자 후보 |

## 5. Data Model Draft

`employee_profile`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id` | tenant + businessEntity 범위 |
| `employee_code` | 사번 또는 내부 식별자 |
| `display_name` | 화면 표시 이름 |
| `department`, `job_title` | 조직 정보 |
| `employee_status` | `active` / `leave` / `terminated` |
| `payroll_eligibility` | 급여 대상 여부 |
| `insurance_enrollment_status` | 4대보험 확인 상태 |
| `hire_date`, `termination_date` | 입퇴사 기준 |
| `work_email` | 내부 리마인드 수신 후보 |
| `notification_enabled` | 내부 알림 수신 허용 |
| `created_by_staff_id`, `updated_by_staff_id` | 감사 |
| `created_at`, `updated_at` | 감사·동기화 |

권장 인덱스: unique(`tenant_id`, `client_id`, `employee_code`), index(`tenant_id`, `client_id`, `employee_status`), index(`tenant_id`, `client_id`, `payroll_eligibility`).

## 6. Mutation and State

| 액션 | 허용 | API/모듈 |
|:---|:---:|:---|
| 직원 추가 | O | `POST /api/employees` 후보 |
| 직원 기본 정보 수정 | O | `PATCH /api/employees/[employeeId]` 후보 |
| 재직 상태 변경 | O | `PATCH /api/employees/[employeeId]/status` 후보 |
| 급여 대상 여부 변경 | O | `PATCH /api/employees/[employeeId]/payroll-eligibility` 후보 |
| 주민번호/계좌번호 원문 저장 | X | 별도 개인정보 설계 전 금지 |
| 급여 마감된 과거 payroll line 직접 변경 | X | 급여 화면 mutation 책임 |

## 7. UI State Coverage

| 상태 | 조건 | UI |
|:---|:---|:---|
| Default | 직원 1명 이상 | 통계 카드, 필터, 직원 표, 상세/수정 액션 |
| Loading | Server Component 지연 | 목록 스켈레톤 |
| Empty | 직원 없음 | "첫 직원 추가" CTA |
| Error | read model 실패 | "직원 명부를 불러오지 못했습니다" + 다시 시도 |
| Permission denied | 미인증 또는 tenant 미소속 | `/sign-in` redirect 또는 접근 안내 |

## 8. Implementation Preconditions

- [ ] UI Preview 작성 및 사용자 확인
- [ ] 화면 진입 위치(`/dashboard/employees` vs 설정 하위) 확정
- [ ] 신규 `employee_profile` 물리 테이블 여부 확정
- [ ] 급여 line과 직원 마스터 연결 방식 확정
- [ ] 개인정보 저장 금지/마스킹 방침 확정
- [ ] JC-016 내부 리마인드 수신자 참조 방식 확정
- [x] QA 시나리오 작성 및 Backlog Context Lock 연결

## 9. Acceptance Criteria

1. 직원 명부는 급여 실행 결과와 분리된 마스터 데이터로 관리된다.
2. 재직 상태, 급여 대상 여부, 4대보험 확인 상태가 직원별로 표시된다.
3. 급여 화면은 직원 명부를 참조할 수 있지만, 마감된 급여 실행 결과를 임의 변경하지 않는다.
4. 리마인드 메일은 직원 명부의 workEmail/notificationEnabled를 수신자 후보로 사용한다.
5. 주민등록번호·계좌번호·전화번호 원문은 신규 명부 화면과 QA seed에 저장/노출하지 않는다.
6. 로딩·빈·오류 상태가 UI Preview와 구현에 포함된다.

## 10. Open Items

- 직원 명부를 독립 메뉴로 둘지, 설정 하위 메뉴로 둘지 결정이 필요하다.
- 직원 이메일이 없는 경우 리마인드 수신자를 staff 계정으로 대체할지 결정이 필요하다.
- 기존 payroll line의 `employeeCode`를 employee_profile과 자동 매칭할지, 사용자 확인 후 연결할지 결정이 필요하다.

## 11. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 셀프사용 제품 목적
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 기존 6개 워크스페이스 흐름
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 디자인 시스템과 상태 표현
- **Technical_Specs**: [DB Schema](./03_DB_SCHEMA.md) - 급여·직원 데이터 모델 확장 기준
- **Technical_Specs**: [Payroll Pre-Code Brief](./08_PAYROLL_PRE_CODE_BRIEF.md) - 급여 line과 4대보험 고지액 매칭 선행 흐름
- **Technical_Specs**: [Internal Reminder Mail Pre-Code Brief](./11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) - 직원 명부를 수신자 source로 사용하는 후속 기능
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-015 Context Lock
- **QA_Validation**: [Employee Directory Test Scenarios](../05_QA_Validation/08_EMPLOYEE_DIRECTORY_TEST_SCENARIOS.md) - 구현 전 검증 기준
