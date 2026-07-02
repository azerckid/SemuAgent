# Employee Directory Test Scenarios
> Created: 2026-07-02 21:18
> Last Updated: 2026-07-02 21:18

## 1. Scope

이 문서는 JC-015 직원 명부 구현 전 QA 계약이다. 직원 명부는 급여 실행 결과가 아니라 회사의 상시 직원 마스터이며, 급여·4대보험 고지액 매칭·내부 리마인드의 기준 데이터로 사용된다.

현재 단계는 문서 게이트다. UI Preview와 구현이 아직 없으므로 Result는 전부 Pending이다.

## 2. Scenario Matrix

| ID | Area | Scenario | Expected | Result |
|:---|:---|:---|:---|:---|
| S-01 | Structure | 직원 명부 화면은 독립 운영 화면 또는 설정 하위 화면으로 진입한다. | 급여대장 하위 표가 아니라 직원 마스터 관리 화면으로 표시된다. | Pending |
| S-02 | Structure | 통계, 필터, 직원 목록, 상세/수정 액션이 한 화면에서 스캔 가능하다. | active/payroll eligible/needs review/terminated 집계가 표시된다. | Pending |
| S-03 | Structure | 직원이 없을 때 화면을 연다. | 빈 상태와 첫 직원 추가 CTA가 표시된다. | Pending |
| S-04 | Structure | 로딩 중 화면을 연다. | 목록 스켈레톤이 표시된다. | Pending |
| S-10 | Scope | tenant A 사용자가 tenant B 직원 명부를 조회하려 한다. | tenant + businessEntity 범위 밖 데이터가 표시되지 않는다. | Pending |
| S-11 | Scope | 사업장이 없는 tenant가 화면에 접근한다. | 사업장 없음 빈 상태 또는 설정 안내가 표시된다. | Pending |
| S-12 | Scope | 퇴사 직원이 목록에 포함되어 있다. | 기본 필터에서는 숨기거나 퇴사 상태로 명확히 구분한다. | Pending |
| S-13 | Scope | 급여 대상 제외 직원을 조회한다. | 급여 제외 상태가 명확히 표시되고 급여대장 생성 대상에서 제외된다. | Pending |
| S-14 | Scope | 휴직 직원을 조회한다. | 재직과 구분되는 상태 칩이 표시된다. | Pending |
| S-20 | Data | 직원 추가 시 이름과 사번을 입력한다. | `employee_profile` 후보 테이블에 tenant/client scoped row가 생성된다. | Pending |
| S-21 | Data | 같은 tenant/client에서 사번 중복 직원을 추가한다. | unique 제약 또는 validation 오류가 발생한다. | Pending |
| S-22 | Data | 다른 사업장에 같은 사번 직원을 추가한다. | 사업장 범위가 다르면 허용된다. | Pending |
| S-23 | Data | 직원의 재직 상태를 퇴사로 변경한다. | terminationDate 또는 status 변경 감사 정보가 기록된다. | Pending |
| S-24 | Data | 급여 대상 여부를 제외로 변경한다. | 이후 급여 실행 후보에서 제외된다. | Pending |
| S-25 | Data | workEmail이 없는 직원을 저장한다. | 저장은 가능하지만 리마인드 수신 후보에서는 제외 또는 확인 필요로 표시된다. | Pending |
| S-30 | Payroll Link | 최근 급여대장이 있는 직원을 조회한다. | latestPayrollPeriod/latestPayrollLineId가 보조 정보로 표시된다. | Pending |
| S-31 | Payroll Link | 마감된 payroll line이 연결된 직원을 수정한다. | 직원 마스터 수정은 가능하되 과거 마감 급여 금액은 변경되지 않는다. | Pending |
| S-32 | Insurance | 건강보험 EDI 고지액 매칭 실패 직원이 있다. | insuranceEnrollmentStatus 또는 issueLabel에 확인 필요가 표시된다. | Pending |
| S-33 | Insurance | matchKeyHash만 있는 고지 라인을 직원과 매칭한다. | 주민등록번호 원문 없이 사번/이름/해시 기반 매칭 상태만 표시된다. | Pending |
| S-34 | Reminder | notificationEnabled=false 직원이 있다. | 내부 리마인드 수신 후보에서 제외된다. | Pending |
| S-40 | Privacy | 주민등록번호 원문 필드가 UI에 노출되는지 검사한다. | 주민등록번호 원문은 표시되지 않는다. | Pending |
| S-41 | Privacy | 계좌번호 원문 필드가 UI에 노출되는지 검사한다. | 계좌번호 원문은 표시되지 않는다. | Pending |
| S-42 | Privacy | 전화번호 원문 저장 필드를 추가하려 한다. | 별도 개인정보/암호화 설계 없이는 금지된다. | Pending |
| S-43 | Privacy | storage key 또는 파일 원본 경로가 UI에 노출되는지 검사한다. | private storage key는 노출되지 않는다. | Pending |
| S-44 | Privacy | 일반 staff가 권한 밖 직원 상세를 조회한다. | 접근 제한 또는 마스킹 정책이 적용된다. | Pending |
| S-50 | Mutation | 직원 추가 API에 tenant/client mismatch payload를 보낸다. | 세션의 tenant/client scope가 우선 적용된다. | Pending |
| S-51 | Mutation | 퇴사일이 입사일보다 빠른 payload를 보낸다. | validation 오류가 발생한다. | Pending |
| S-52 | Mutation | payrollEligibility에 허용되지 않은 값을 보낸다. | zod 또는 서버 validation 오류가 발생한다. | Pending |
| S-53 | Mutation | 삭제 대신 퇴사 상태 처리를 수행한다. | hard delete 없이 status 변경과 감사 정보가 남는다. | Pending |
| S-80 | State | read model이 실패한다. | error.tsx 또는 inline 오류 상태가 표시된다. | Pending |
| S-81 | State | 미인증 상태로 접근한다. | `/sign-in`으로 redirect된다. | Pending |
| S-82 | State | UI Preview와 구현 화면을 비교한다. | 승인된 preview의 레이아웃·색상·상태 구조와 일치한다. | Pending |
| S-83 | State | 직원 명부 메뉴가 추가된다. | Sidebar/route에서 회사용 용어만 사용한다. | Pending |
| S-84 | State | 기존 급여 화면과 같이 사용한다. | 직원 명부는 마스터, 급여대장은 귀속월 실행 결과라는 경계가 유지된다. | Pending |

## 3. Automation Plan

- `lib/employee-directory/summary.test.ts`: scope, stats, privacy, payroll link 파생 검증
- `app/(dashboard)/dashboard/employees/_components/*.test.tsx`: 테이블 구조와 개인정보 미노출 정적 검증
- API route tests: 직원 추가/수정 validation, tenant scoping, hard delete 금지
- Browser QA: 승인된 HTML Preview와 실제 화면 캡처 대조

## 4. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 셀프사용 제품 목적
- **Technical_Specs**: [Employee Directory Pre-Code Brief](../03_Technical_Specs/10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) - 구현 전 계약
- **Technical_Specs**: [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) - `employee_profile` 논리 모델 초안
- **Technical_Specs**: [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md) - 급여대장과 직원 마스터 경계
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-015 Context Lock
