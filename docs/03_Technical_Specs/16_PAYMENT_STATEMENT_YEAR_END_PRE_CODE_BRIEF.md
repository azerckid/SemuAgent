# Payment Statement · Year-end Settlement Pre-Code Technical Brief
> Created: 2026-07-05 00:40
> Last Updated: 2026-07-05 00:40

## 0. Governing Principle

JC-024 지급명세서·연말정산 검토 화면은 급여·직원 명부 데이터를 반기/연 단위로 집계한 **read-only 신고 준비 데이터** 화면이다. 신고 준비 허브(JC-029)의 "지급명세서/연말정산" 트랙을 roadmap→live로 채운다.

- **신규 산출 엔진·신규 DB 테이블·세액 계산·자동 제출 없음.** 기존 급여(JC-012)·직원 명부(JC-015) 데이터를 집계·재프레임한다.
- 화면 언어는 "제출용"이 아니라 **"신고 준비 데이터"** 로 통일한다(제출 대행 뉘앙스 회피).
- **정산액(결정세액·소득/세액공제·환급/추징) 계산은 v1 범위 밖.** 연말정산은 준비·검토(연간 지급·기납부 집계·누락)까지.
- **전자신고 파일 생성은 JC-030**. JC-024는 데이터셋·검토 상태까지.
- 최종 제출·납부는 사용자가 홈택스에서 직접. 자동 제출·자격증명 저장 없음.
- 기준 화면·문구는 승인된 [09_payment_year_end.html](../02_UI_Screens/previews/09_payment_year_end.html)(UI-First Gate 승인 2026-07-05)를 따른다.

## 1. Scope

포함한다.

1. 신규 read-only 화면 `/dashboard/filing-preparation/payment-statements`
2. 간이지급명세서(근로소득) **반기 집계** read model
3. 연말정산 준비·검토 read model (연간 지급·기납부 집계·누락, 정산액 계산 제외)
4. 신고 준비 허브(JC-029)의 `payment_statement` 트랙 roadmap→**live** 전환 + 검토 화면 링크
5. 확인 필요(누락) → 급여·직원 명부 라우팅
6. 로딩·빈·오류·권한 상태

제외한다(후속).

- 정산액 계산(결정세액·공제·환급/추징) · 연간(비반기) 지급명세서 · 사업소득 명세서
- 전자신고 파일 생성(JC-030) · 자동 제출(JC-023) · 신규 DB 테이블

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | `/dashboard/filing-preparation/payment-statements` (신규, 허브 하위) |
| 화면 성격 | read-only 집계 (mutation 없음) |
| Read model | 신규 `lib/payment-statements/summary.ts` |
| Persistence | **없음** — 신규 테이블/마이그레이션 없음 |
| Mutation API | **없음** — 확인 필요는 급여(`/dashboard/payroll`)·직원 명부(`/dashboard/employees`)로 라우팅 |
| 진입 | 신고 준비 허브 "지급명세서/연말정산" 트랙 "검토 화면" 링크 |

## 3. Data Sources (기존 데이터 재사용, 신규 저장 없음)

| 소스 | 용도 |
|:---|:---|
| `payroll_period_summary` (월 `YYYY-MM`) | 기간 존재 여부·`employeeCount`·`issueCount`로 월 누락/미확정 판정 |
| `payroll_employee_line` (직원×월) | 직원별 `grossPayKrw`(지급총액)·`incomeTaxKrw`(근로소득세)·`status`(ready/needs_review) |
| `employee_profile` | `employeeStatus`(active/leave/terminated)·`hireDate`·`terminationDate`·`payrollEligibility` |
| `buildCompanyHomePeriod` | 귀속연도·기간 컨텍스트(선택 없으면 현재 기준) |

직원 식별: payroll line의 `employeeCode`로 그룹핑하고 `employee_profile.employeeCode`(uniqueIndex tenant+client+code)로 매칭한다. `employeeCode`가 null인 line은 이름으로 그룹핑하되 "코드 미매칭"으로 확인 필요 표시.

## 4. 간이지급명세서(근로소득) 반기 집계 — Data Contract

근로소득 간이지급명세서는 **반기 제출**(상반기 1~6월→7월, 하반기 7~12월→익년 1월). 기준 반기의 월별 급여를 직원별로 집계한다.

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

## 5. 연말정산 준비·검토 — Data Contract

귀속연도 12개월(또는 조회 시점까지)의 급여를 직원별로 집계한다. **정산액 계산은 하지 않는다.**

| 필드 | 계산 |
|:---|:---|
| 재직 | `employee_profile.employeeStatus` (active/leave/terminated) |
| 연간 지급합계 | Σ `grossPayKrw` (연간, 재직 기간) |
| 기납부 원천세 | Σ `incomeTaxKrw` (연간) |
| 누락 | 월 급여 미확정/누락 · 인적사항 누락(아래) · 코드 미매칭 |
| 검토 상태 | 준비 완료(누락 없음) / 월 급여 확정 필요 / 중도정산 검토(중도퇴사) |

- **중도퇴사**: `employeeStatus === 'terminated'` + `terminationDate` → "중도정산 검토"로 표시(퇴사월까지 집계).
- **정산액·환급/추징·공제는 표시하지 않는다**(v1 범위 밖 — 화면에 명시).

## 6. 인적사항 누락 판정 — Data Contract 정정 (중요)

승인 Preview는 "인적사항 누락(주민등록번호·입사일)"을 예시로 표시했으나, **`employee_profile`은 주민등록번호를 저장하지 않는다**(JC-015 최소 PII 원칙). 따라서 v1의 인적사항 누락 판정은 **저장된 필드로만** 한다:

- `hireDate` 없음 (입사일 미기재)
- payroll line `employeeCode` ↔ `employee_profile` 매칭 실패 (명부 미등록)
- `employeeStatus`/`payrollEligibility` 불일치(예: terminated인데 급여 line 존재)

**주민등록번호는 v1 저장·검증 범위 밖이다** — 저장하지 않고(JC-015 최소 PII), 검증하지 않으며, 최종 홈택스 입력 단계에서 사용자가 직접 입력한다. 구현자는 이 화면을 위해 주민번호 필드를 추가하지 않는다. Preview 문구도 "인적사항 누락(주민등록번호·입사일)" → "인적사항 확인 필요(입사일·명부 매칭)"으로 조정 완료(2026-07-05).

## 7. 허브 트랙 live 전환 — Data Contract

`lib/filing-preparation/summary.ts`의 `buildTracks` payment_statement 트랙을 roadmap→live로 바꾼다.

- `status: 'roadmap'` → `'live'`, chip `JC-024`(plan) → 준비/누락 상태칩
- `href: null` → `/dashboard/filing-preparation/payment-statements`
- 트랙 chipLabel/상태 = payment-statements summary의 경량 카운트(대상 인원·확인 필요 수)에서 파생
- 허브는 경량 카운트만 로드(상세는 검토 화면). `lib/payment-statements/summary.ts`에 `loadPaymentStatementAttentionCount(tenantId)` 류 제공.

## 8. Screen States

| 상태 | 표시(승인 Preview와 일치) |
|:---|:---|
| Loading | "지급명세서·연말정산 준비 상태를 불러오는 중입니다." |
| Empty | "급여를 먼저 확정하면 지급명세서·연말정산 준비 데이터가 채워집니다." |
| Error | "준비 상태를 불러오지 못했습니다. 다시 시도해 주세요." |
| No Permission | "급여·직원 정보 접근 권한이 있는 담당자만 볼 수 있습니다." |

## 9. Component & Library Plan

- shadcn/ui: 기존 대시보드 컴포넌트만 재사용. 신규 없음.
- Custom: `PaymentStatementReview`(서버 진입) + 표·요약·blocker 프레젠테이션(신고 준비 허브 카드/표 패턴 재사용).
- Reused: 상태칩·진행바 유틸, 사이드바(진입은 허브 트랙 링크라 사이드바 신규 항목 없음).
- New libraries: **없음**.
- shadcn preset action: N/A.

## 10. Acceptance Criteria

- [ ] 간이지급명세서(근로) 반기 집계가 직원별 지급총액·원천징수세액(근로소득세)·귀속기간·준비상태로 표시된다.
- [ ] 연말정산 준비·검토가 직원별 연간 지급합계·기납부 원천세·누락·검토상태로 표시되고, **정산액 계산은 하지 않음**이 명시된다.
- [ ] 중도퇴사 직원이 "중도정산 검토"로 구분된다.
- [ ] 인적사항 누락 판정은 저장된 필드(hireDate·명부 매칭·재직상태)로만 하며 주민번호는 검증 대상이 아니다.
- [ ] 확인 필요(누락)가 급여·직원 명부로 라우팅된다.
- [ ] 신고 준비 허브의 payment_statement 트랙이 roadmap→live로 전환되고 검토 화면으로 링크된다.
- [ ] 화면은 read-only이며 mutation을 수행하지 않는다. 전자신고 파일 생성·자동 제출은 포함하지 않는다.
- [ ] 로딩·빈·오류·권한 상태가 구현된다.
- [ ] 반기 집계·준비상태 판정·누락 판정은 순수 함수로 단위 테스트된다.

## 11. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 원천징수의무자 self-use 세무 준비, 자동제출 제외 경계
- **UI_Screens**: [09_payment_year_end.html](../02_UI_Screens/previews/09_payment_year_end.html) - 승인 화면 · [Screen Flow 4i](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.11](../02_UI_Screens/01_UI_DESIGN.md)
- **Technical_Specs**: [Filing Preparation Hub Pre-Code Brief](./15_FILING_PREPARATION_PRE_CODE_BRIEF.md) - 허브 집계 패턴·트랙 구조(재사용)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-024 Context Lock · v1 스코프
