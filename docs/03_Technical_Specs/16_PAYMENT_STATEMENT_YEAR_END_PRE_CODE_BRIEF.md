# Payment Statement · Year-end Settlement Pre-Code Technical Brief
> Created: 2026-07-05 00:40
> Last Updated: 2026-07-14 KST

## 0. Governing Principle

JC-024 지급명세서·연말정산은 급여·직원 명부 데이터를 공유하는 **read-only 신고 준비 데이터** 도메인이다. 사용자 메뉴·라우트·화면은 지급명세서(반기 집계·간이지급 Path 1b)와 연말정산(홈택스 근로소득 지급명세서 생성용 급여 기초자료 준비)으로 분리한다.

- **신규 산출 엔진·신규 DB 테이블·세액 계산·자동 제출 없음.** 기존 급여(JC-012)·직원 명부(JC-015) 데이터를 집계·재프레임한다.
- 화면 언어는 "제출용"이 아니라 **"신고 준비 데이터"** 로 통일한다(제출 대행 뉘앙스 회피).
- **정산액(결정세액·소득/세액공제·환급/추징) 계산은 v1 범위 밖.** 연말정산은 준비·검토(연간 지급·기납부 집계·누락)까지.
- **근로소득 지급명세서 신고 준비는 JC-030 Annual Stage A~F**다. Stage A는 공식
  비암호화 업로드 양식 미확인으로 Path 1b를 판정했고, Stage B는 전체 법정 필드와
  canonical 데이터 공백을 매핑했다. [Stage C](./57_JC030_ANNUAL_WAGE_STATEMENT_CANONICAL_SOURCE_CONTRACT.md)는
  SemuAgent의 확정 급여 기초자료와 홈택스 편리한 연말정산의 공제신고서·최종
  지급명세서 정본 책임을 분리했다. Stage D HTML Preview는 오너 승인을 완료했고,
  이 문서의 Stage E 계약을 통과했다. Stage F는 승인 화면을 실제 데이터에 연결하고
  단위·정적·브라우저 QA까지 완료했다(2026-07-14).
- 최종 제출·납부는 사용자가 홈택스에서 직접. 자동 제출·자격증명 저장 없음.
- 기준 화면·문구는 [지급명세서 Preview](../02_UI_Screens/previews/09_payment_year_end.html)와 [연말정산 Preview](../02_UI_Screens/previews/15_year_end_settlement.html)를 따른다(분리 승인 2026-07-13).

### 0.1 Annual Stage F Flow Status

```text
[Flow]
현재: Annual Stage F runtime·QA 완료
Gate: Stage D HTML Preview 오너 승인 + Stage E 데이터·상태·경계 계약 통과
완료: Annual Stage A~F — 공식 경로 감사, 필드 매핑, 정본/PII, Preview, Pre-Code, runtime·QA
다음: 근로소득 지급명세서 Path 1b는 완료 상태 유지; 새 범위는 별도 오너 결정 후 착수
신규 저장: 없음(client_filing_profile migration 보류)
금지: 세액 계산·역산, 주민번호/공제자료 수집, 결과 문서 import, 파일/자동입력/자동제출
```

## 1. Scope

포함한다.

1. 지급명세서 read-only 화면 `/dashboard/filing-preparation/payment-statements`
2. 연말정산 read-only 화면 `/dashboard/filing-preparation/year-end-settlement`
3. 간이지급명세서(근로소득) **반기 집계** read model
4. 연말정산 근로소득 지급명세서 생성 준비 read model (연간 확정 급여·보험·기납부세액·근무기간·특례 신호)
5. 신고 준비 허브(JC-029)의 `payment_statement` 공용 트랙 유지
6. 확인 필요(누락) → 급여·직원 명부 라우팅
7. 화면별 로딩·빈·오류 상태

제외한다(후속).

- 정산액 계산(결정세액·공제·환급/추징) · 사업소득 명세서
- 주민등록번호·공제신고서·공제증빙·홈택스 생성 결과 수집/저장/import
- 전자신고 파일 생성 · 자동 입력·자동 제출(JC-023) · 신규 DB 테이블·mutation API

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Routes | 지급명세서 `/dashboard/filing-preparation/payment-statements` · 연말정산 `/dashboard/filing-preparation/year-end-settlement` |
| 화면 성격 | read-only 집계 (mutation 없음) |
| Read model | 신규 `lib/payment-statements/summary.ts` |
| Persistence | **없음** — 신규 테이블/마이그레이션 없음 |
| Mutation API | **없음** — 확인 필요는 급여(`/dashboard/payroll`)·직원 명부(`/dashboard/employees`)로 라우팅 |
| 진입 | 사이드바 `급여·지급` 아래 별도 `지급명세서`·`연말정산` 메뉴 |

## 3. Data Sources (기존 데이터 재사용, 신규 저장 없음)

| 소스 | 용도 |
|:---|:---|
| `payroll_period_summary` (월 `YYYY-MM`) | 기간 존재 여부·`employeeCount`·`issueCount`로 월 누락/미확정 판정 |
| `payroll_employee_line` (직원×월) | `baseSalaryKrw`·`allowanceKrw`·`mealAllowanceKrw`·`grossPayKrw`, 4대보험 4종, `incomeTaxKrw`·`localIncomeTaxKrw`, `status` |
| `employee_profile` | `employeeStatus`(active/leave/terminated)·`hireDate`·`terminationDate`·`payrollEligibility` |
| `buildCompanyHomePeriod` | 귀속연도·기간 컨텍스트(선택 없으면 현재 기준) |

직원 식별: payroll line의 `employeeCode`로 그룹핑하고 `employee_profile.employeeCode`(uniqueIndex tenant+client+code)로 매칭한다. `employeeCode`가 null인 line은 이름으로 그룹핑하되 "코드 미매칭"으로 확인 필요 표시.

## 4. 간이지급명세서(근로소득) 반기 집계 — Data Contract

근로소득 간이지급명세서는 **반기 제출**(상반기 1~6월→7월, 하반기 7~12월→익년 1월). 기준 반기의 월별 급여를 직원별로 집계한다.

### 4.1 기간 선택·미래 월 계약 (2026-07-13 정합화)

- URL에 `period`가 없으면 **현재 진행 중인 반기가 아니라 가장 최근에 끝난 반기**를 기본 선택한다.
  - 7~12월 진입: 당해 상반기
  - 1~6월 진입: 전년도 하반기
- 사용자가 `?period=YYYY-H1/H2`로 진행 중인 반기를 명시해 열 수는 있다.
- 진행 중 반기에서는 현재 월과 미래 월을 필수 월로 보지 않는다. 이미 끝난 월만 누락 여부를 검사한다.
- 끝난 월의 실제 누락·미확정은 기존대로 확인 필요 blocker다. 미래 월은 `월 급여 누락`이나 확인 필요 인원에 포함하지 않는다.
- 진행 중 반기의 정상 행은 `기간 진행 중`으로 표시하고, 반기 종료 전에는 `준비 완료`나 홈택스 직접작성 값으로 승격하지 않는다.

| 필드 | 계산 |
|:---|:---|
| 귀속기간 | 반기 범위(예: `2026-01`~`2026-06`) 중 해당 직원 line이 존재하는 월 |
| 지급총액 | Σ `payroll_employee_line.grossPayKrw` (반기 내 해당 직원 월 합) |
| 원천징수세액 | Σ `incomeTaxKrw` (**근로소득세만**. 지방소득세 `localIncomeTaxKrw`는 지방소득세/위택스 트랙, 여기 미포함) |
| 준비 상태 | 아래 판정 |

**준비 상태 판정(순수 함수):**
- 반기 6개월 모두 period_summary 존재 + 해당 직원 line 존재 + 모든 line `status !== 'needs_review'` → **준비 완료**
- 직원 line에 `needs_review` 있음 → **확인 필요(급여 미확정)**
- 반기 중 일부 월에 직원 line 없음(중도입사 제외) → **N월 누락**
- 중도입사(hireDate가 반기 중간) → 입사월부터 집계, 누락 아님

## 5. 근로소득 지급명세서 생성 준비 — Annual Stage E Data Contract

- URL에 기간이 없으면 **최근에 완전히 끝난 연도**를 기본 선택한다.
- 진행 중 연도를 명시해 열면 완료된 월까지만 누락을 검사하고 정상 행도 `연도 진행 중`으로 표시한다. 현재까지 합계를 `연간 지급합계`·`검토 준비`로 확정 표시하지 않는다.

귀속연도 12개월(또는 진행 중 연도의 완료 월)의 급여를 직원별로 집계한다. 완료 연도의
화면 계약은 승인된 [연말정산 Preview](../02_UI_Screens/previews/15_year_end_settlement.html)다.
**정산액 계산은 하지 않는다.**

### 5.1 Annual Row Minimum Fields

| 그룹 | 필드·계산 |
|:---|:---|
| 식별 | `employeeKey`, `employeeName`, `employeeCode`, `employeeStatus` |
| 근무기간 | `hireDate`와 조건부 `terminationDate`, 귀속연도와 교차하는 시작·종료 월 |
| 급여 입력값 | Σ `baseSalaryKrw`, Σ `allowanceKrw`(기타수당), Σ `mealAllowanceKrw`, Σ `grossPayKrw`. 상여 별도 정본은 없으므로 `allowanceKrw`를 상여로 재명명하지 않음 |
| 보험 | Σ `nationalPensionKrw`, `healthInsuranceKrw`, `longTermCareKrw`, `employmentInsuranceKrw` |
| 기납부세액 | Σ `incomeTaxKrw`, Σ `localIncomeTaxKrw` |
| 정합성 | 월 `payroll_period_summary.closeStatus`, line `status`, 필요 월 존재, `baseSalary+allowance+mealAllowance=grossPay` |
| 홈택스 확인 | 주민/외국인 식별정보·공제신고서·종전근무지·기타 감면/농특세는 값이 아니라 `홈택스에서 직접 확인` 책임만 표시 |
| 상태 | 아래 완료 연도 상태 3종과 `reasonCodes[]` |

모든 합계는 같은 `tenantId + clientId + year + employeeKey` 범위의 저장된 원화 정수만
더한다. 세율로 역산하거나 누락 값을 0으로 채우지 않는다. `payroll_period_summary`가
`closed`이고 해당 line이 `closed`일 때만 신고용 확정 source로 센다.

### 5.2 Completed-Year Status Contract

화면 라벨은 다음 세 종류만 사용한다.

| 내부 상태 | 화면 라벨 | 조건 | 다음 행동 |
|:---|:---|:---|:---|
| `ready` | 급여 준비 완료 | 필요 월 급여 마감, 명부 연결·근무기간·급여 항목/총액·보험·세액 정합성 충족, 현재 데이터에서 특례 신호 없음 | 홈택스에서 주민번호·공제신고서 등 직접 확인 |
| `payroll_action_required` | 급여 보완 | 급여 월 누락/미마감, line `needs_review`, 명부/입사일 미연결, 항목합계와 지급총액 불일치 | 급여 또는 직원 명부로 이동 |
| `special_case_review` | 특례 확인 | 귀속연도 중도입사·중도퇴사 등 현재 저장 데이터로 확인되는 특례 신호 | 홈택스에서 종전근무지·중도정산 반영 여부 확인 |

우선순위는 `payroll_action_required > special_case_review > ready`다. 중도입사/퇴사라도
급여 자체가 미확정이면 먼저 `급여 보완`으로 보낸다. 외국인 단일세율·국외근로·특수
감면·기부금·농특세처럼 현재 DB에 정본 필드가 없는 항목은 `해당 없음`으로 단정하지
않고 홈택스 직접 확인 항목으로만 표시한다. 존재 근거가 없는 모든 직원을 임의로
`특례 확인`에 넣지도 않는다.

### 5.3 Period and Display Contract

- 기간 미지정 기본값은 최근 완료 연도다.
- 진행 중 연도를 명시해 열면 `period_open` 페이지 상태로 현재까지 합계만 표시한다.
  완료 연도 상태 3종 카운트에 섞거나 `급여 준비 완료`로 승격하지 않는다.
- 상단은 대상·급여 준비 완료·급여 보완·특례 확인 네 카운트만 표시한다. 별도 대형
  blocker 카드·진행률·반복 책임경계 카드를 추가하지 않는다.
- 행 상세는 펼쳤을 때만 급여·보험·기납부세액을 표시한다.

### 5.4 Filing Profile Decision

Stage F 첫 runtime에는 `client_filing_profile`이 필요하지 않다. 승인 화면은 사업자등록번호,
대표자, 주소, 종사업장 정보를 입력·표시하는 홈택스 직접작성 폼이 아니라 **직원별 급여
기초자료 준비 화면**이기 때문이다.

- `tenant_billing_profile`을 신고 profile로 재사용하지 않는다.
- Stage F에서 schema·migration·profile mutation을 만들지 않는다.
- 향후 사업장 신고정보 입력/확정 화면이 별도 승인될 때만 Stage C의
  `client_filing_profile` 제안을 다시 검토한다.

## 6. 인적사항 누락 판정 — Data Contract 정정 (중요)

승인 Preview는 "인적사항 누락(주민등록번호·입사일)"을 예시로 표시했으나, **`employee_profile`은 주민등록번호를 저장하지 않는다**(JC-015 최소 PII 원칙). 따라서 v1의 인적사항 누락 판정은 **저장된 필드로만** 한다:

- `hireDate` 없음 (입사일 미기재)
- payroll line `employeeCode` ↔ `employee_profile` 매칭 실패 (명부 미등록)
- `employeeStatus`/`payrollEligibility` 불일치(예: terminated인데 급여 line 존재)

**주민등록번호는 v1 저장·검증 범위 밖이다** — 저장하지 않고(JC-015 최소 PII), 검증하지 않는다. Path 1 파일·양식 작성에서 식별번호가 필요한 경우에는 JC-030의 일회성 입력 정책을 따른다. 구현자는 이 화면을 위해 주민번호 필드를 추가하지 않는다. Preview 문구도 "인적사항 누락(주민등록번호·입사일)" → "인적사항 확인 필요(입사일·명부 매칭)"으로 조정 완료(2026-07-05).

**JC-030 신고 산출물 작성 시**: 소득자 식별정보는 [JC-030 PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)의 서버 미저장 원칙을 따른다. Path 1b는 홈택스 직접작성 경계에서 처리하고, 향후 공식 Path 1a가 확인될 때만 파일 생성 직전 일회성 입력을 재검토한다. DB·로그에는 저장하지 않는다.

## 7. 허브 트랙 live 전환 — Data Contract

`lib/filing-preparation/summary.ts`의 `buildTracks` payment_statement 트랙을 roadmap→live로 바꾼다.

- `status: 'roadmap'` → `'live'`, chip `JC-024`(plan) → 준비/누락 상태칩
- `href: null` → `/dashboard/filing-preparation/payment-statements`
- 트랙 chipLabel/상태 = payment-statements summary의 경량 카운트(대상 인원·확인 필요 수)에서 파생
- 허브는 경량 카운트만 로드(상세는 검토 화면). `lib/payment-statements/summary.ts`에 `loadPaymentStatementAttentionCount(tenantId)` 류 제공.

## 8. Screen States

| 상태 | 표시(승인 Preview와 일치) |
|:---|:---|
| Loading | 연말정산 헤더·연도 선택을 유지하고 직원 표와 같은 폭의 스켈레톤을 표시. 전체 페이지 spinner 없음 |
| Empty: 사업장 없음 | "사업장을 먼저 등록해 주세요" + 사업장/설정 다음 행동 |
| Empty: 대상 직원/급여 없음 | "완료 연도의 확정 급여가 없습니다" + 급여·직원 명부 다음 행동. 0원 표를 만들지 않음 |
| Period Open | 현재까지 합계와 `연도 진행 중`. 완료 연도 상태 3종·준비 완료 카운트로 승격하지 않음 |
| Error | 연말정산 헤더·연도 선택을 유지하고 "준비 상태를 불러오지 못했습니다" + 동일 화면 재시도 |
| No Permission | 인증 실패는 로그인으로, tenant/급여 접근 권한 없음은 데이터 없이 권한 안내 |

## 9. Component & Library Plan

- shadcn/ui: 기존 대시보드 컴포넌트만 재사용. 신규 없음.
- Custom: `PaymentStatementReview`, `YearEndSettlementReview` + 공용 `statement-review-ui` 표·칩. Stage F는 연말정산에 직원 행 상세 disclosure를 추가한다.
- Reused: `loadYearEndSettlementSummary` tenant/client/year scoped loader, 기존 급여/직원 스키마, 상태칩·사이드바 패턴.
- New libraries: **없음**.
- New DB/API/AI: **없음**. 화면 렌더를 위한 read model 확장만 허용한다.
- shadcn preset action: N/A.

## 10. Acceptance Criteria

- [x] 간이지급명세서(근로) 반기 집계가 직원별 지급총액·원천징수세액(근로소득세)·귀속기간·준비상태로 표시된다.
- [x] Stage F 연말정산 화면이 직원별 근무기간·급여/보험/기납부세액 준비값·홈택스 확인 항목·상태 3종을 표시하고, **정산액 계산은 하지 않음**을 명시한다. (2026-07-14)
- [x] 중도입사·중도퇴사 직원은 급여 자료가 완결됐을 때 `특례 확인`으로 구분된다. (2026-07-14)
- [x] 인적사항 누락 판정은 저장된 필드(hireDate·명부 매칭·재직상태)로만 하며 주민번호는 검증 대상이 아니다. (2026-07-14)
- [x] 확인 필요(누락)가 급여·직원 명부로 라우팅된다.
- [x] 신고 준비 허브의 payment_statement 트랙이 roadmap→live로 전환되고 검토 화면으로 링크된다.
- [x] 화면은 read-only이며 mutation을 수행하지 않는다. 전자신고 파일 생성·자동 제출은 포함하지 않는다. (2026-07-14)
- [x] 로딩·빈·오류·권한 상태가 구현된다.
- [x] 반기 집계·준비상태 판정·누락 판정은 순수 함수로 단위 테스트된다.
- [x] 기간 미지정 진입은 최근 완료 반기를 선택하고, 진행 중 반기의 현재·미래 월은 누락으로 오판하지 않는다. (`period_open`, 2026-07-13)
- [x] 지급명세서와 연말정산이 별도 사이드바 항목·라우트·breadcrumb·화면을 사용하고 화면별 준비율을 독립 계산한다. (2026-07-13)
- [x] 연말정산 기본 진입은 최근 완료 연도를 선택하고, 진행 중 연도는 현재까지 합계·`연도 진행 중`으로 분리해 검토 준비로 오인하지 않는다. (2026-07-13, PR #242 review regression)
- [x] Stage D Preview의 홈택스 생성 흐름·직원 중심 정보 밀도·상태 3종·행 상세를 오너가 승인했다. (2026-07-14)
- [x] Stage E에서 급여/보험/기납부세액 최소 필드, tenant/client/year scope, 상태 우선순위, 로딩·빈·오류·기간 진행 중 계약을 고정했다. (2026-07-14)
- [x] Stage F 첫 runtime은 기존 급여·직원 데이터의 read-only 확장으로 한정하고 `client_filing_profile` migration을 보류했다. (2026-07-14)
- [x] Stage F runtime이 승인 Preview 구조와 동일한 직원별 급여 기초자료·상태 3종·행 상세를 실제 DB로 표시한다. (2026-07-14)
- [x] Stage F 단위/정적/브라우저 QA에서 tenant·사업장·연도 격리, 합계 정합성, 상태 우선순위, 진행 중 연도, PII 비수집을 검증한다. (2026-07-14)

## 11. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 원천징수의무자 self-use 세무 준비, 자동제출 제외 경계
- **UI_Screens**: [지급명세서 Preview](../02_UI_Screens/previews/09_payment_year_end.html) · [연말정산 Preview](../02_UI_Screens/previews/15_year_end_settlement.html) · [Screen Flow 4i](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.11](../02_UI_Screens/01_UI_DESIGN.md)
- **Technical_Specs**: [근로소득 지급명세서 Stage A Audit](./55_JC030_ANNUAL_WAGE_STATEMENT_STAGE_A_AUDIT.md) · [Stage B Field Mapping](./56_JC030_ANNUAL_WAGE_STATEMENT_FIELD_MAPPING.md) · [Stage C Canonical Source Contract](./57_JC030_ANNUAL_WAGE_STATEMENT_CANONICAL_SOURCE_CONTRACT.md)
- **Technical_Specs**: [Filing Preparation Hub Pre-Code Brief](./15_FILING_PREPARATION_PRE_CODE_BRIEF.md) - 허브 집계 패턴·트랙 구조(재사용)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-024 Context Lock · v1 스코프
