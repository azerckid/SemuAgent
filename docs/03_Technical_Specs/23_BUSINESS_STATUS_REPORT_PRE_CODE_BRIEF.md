# Business Status Report (사업장현황신고) Pre-Code Technical Brief
> Created: 2026-07-05 21:57
> Last Updated: 2026-07-05 22:45

## 0. Governing Principle

JC-028 사업장현황신고 화면은 **면세 개인사업자**가 부가세 신고 대신 홈택스 사업장현황신고에 넣을 수입금액과 자료 상태를 확인하는 **read-only 신고 준비 데이터** 화면이다. 신고 준비 허브(JC-029)에 남은 면세 전용 트랙을 live로 채운다.

- **대상은 `client.taxEntityType === 'tax_exempt'` 한정.** 과세 개인(`individual`)과 법인(`corporation`)은 이 화면의 대상이 아니며, 명확한 해당 없음 상태를 보여준다. 미지정(`null`)은 사업자 유형 설정 필요 상태로 처리한다.
- **신규 세액 계산·신규 DB·전자신고 파일 생성·자동 제출 없음.** 기존 자료수집(JC-009)·기장검토(JC-010)·사업자 유형(JC-032) 데이터를 읽어 준비 상태로 재프레임한다.
- **수입금액과 매입/경비의 기준 소스는 확정 기장 행**이다. VAT summary의 `exemptSupplyKrw`는 있더라도 보조 비교값일 뿐, 면세 사업장현황신고의 core source로 삼지 않는다.
- 화면 언어는 "신고 준비 데이터"로 통일한다. 홈택스 제출 보장, 신고 대행, 세무대리 뉘앙스는 쓰지 않는다.
- 최종 신고·제출은 사용자가 홈택스에서 직접 수행한다. 전자신고 파일 생성은 JC-030, 자동제출은 JC-023 게이트 전 미도입이다.
- 기준 화면·문구는 승인된 [11_business_status_report.html](../02_UI_Screens/previews/11_business_status_report.html)(UI-First Gate 승인 2026-07-05)를 따른다.

## 1. Scope

포함한다.

1. 신규 read-only 화면 `/dashboard/filing-preparation/business-status-report`
2. 면세 개인사업자 대상 여부 판정(`client.taxEntityType`)과 해당 없음/미지정 상태
3. 귀속연도 기준 수입금액 집계 read model
4. 귀속연도 기준 매입·경비 자료 집계 read model
5. 확인 필요(자료 누락·계정분류 미확정·사업자 유형 미지정) → 자료수집·기장검토·설정 라우팅
6. 신고 준비 허브(JC-029)의 `business_status` 트랙 추가 및 live 전환 + 검토 화면 링크
7. 로딩·빈·오류·권한 없음·해당 없음 상태
8. 단위 테스트(대상 분기·집계·blocker·허브 트랙)

제외한다(후속).

- 홈택스 제출·위임 제출·자동 제출(JC-023)
- 전자신고 파일 생성(JC-030)
- 종합소득세·법인세분 신고 데이터(JC-025/026)
- 신규 세액 계산 엔진, 신규 DB 테이블, 저장 mutation
- 공식 홈택스 사업장현황신고 서식 파일 생성 또는 XML/전자신고 포맷 매핑

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | `/dashboard/filing-preparation/business-status-report` (신규, 허브 하위) |
| 화면 성격 | read-only 집계 (mutation 없음) |
| Read model | 신규 `lib/business-status-report/summary.ts` |
| Persistence | **없음** — 신규 테이블/마이그레이션 없음 |
| Mutation API | **없음** — 확인 필요는 자료수집(`/dashboard/direct-upload`)·기장검토(`/dashboard/bookkeeping`)·설정(`/dashboard/settings`)으로 라우팅 |
| 진입 | 신고 준비 허브 "사업장현황신고" 트랙 "검토 화면" 링크 |

## 3. Eligibility Contract — 대상/해당 없음 분기

사업자 유형은 JC-032에서 추가한 `client.taxEntityType`을 직접 사용한다.

```ts
type BusinessStatusEligibility =
  | { state: 'applicable'; reason: null }
  | { state: 'not_applicable'; reason: 'vat_taxable_or_corporation' }
  | { state: 'needs_business_type'; reason: 'tax_entity_type_missing' }

function resolveBusinessStatusEligibility(
  taxEntityType: 'individual' | 'corporation' | 'tax_exempt' | null,
): BusinessStatusEligibility
```

- `tax_exempt` → `applicable`.
- `individual`·`corporation` → `not_applicable`. 화면은 "부가세/법인세 등 다른 신고 트랙을 사용"한다는 안내와 허브 복귀 CTA를 보여준다.
- `null` → `needs_business_type`. 설정 화면으로 라우팅해 사업자 유형을 먼저 지정하게 한다.
- 이 분기 함수는 허브 트랙(`business_status`)과 전용 화면이 **같은 함수**를 재사용한다. 허브와 상세 화면이 서로 다른 판단을 하지 않는다.

## 4. Data Sources (기존 데이터 재사용, 신규 저장 없음)

| 소스 | 용도 |
|:---|:---|
| `client.taxEntityType` | 면세 개인사업자 대상 여부 판정 |
| `bookkeepingTransactionClassification` | 확정 거래의 수입금액(`direction='income'`)·매입/경비(`direction='expense'`) 집계 |
| `bookkeepingClassificationRun` + `uploadSession` | 귀속연도에 겹치는 staff-direct 세션의 최신 completed run 선별(JC-010 패턴 재사용) |
| `loadSourceCollectionSummary` | 자료 누락·정규화 대기 blocker 표시(자료수집 라우팅). 사업장현황신고는 연간 신고이므로 `YYYY-H1` + `YYYY-H2`를 각각 조회해 합산한다. |
| `vatPeriodSummary.exemptSupplyKrw` | 선택적 보조 비교값. core source가 아니며, 값이 없어도 JC-028 화면을 막지 않는다. |

기장 조회 패턴은 `loadBookkeepingReviewSummary`와 동일하게 한다.

1. tenant의 첫 사업장(`client`)을 찾는다.
2. 귀속연도(`YYYY`)에 겹치는 `uploadSession` 중 `source='staff_direct'`, `deletedAt is null`인 세션을 찾는다.
3. 각 세션의 최신 `bookkeepingClassificationRun.status='completed'` run만 사용한다(`pickLatestCompletedRunIdsBySession` 패턴).
4. 해당 run의 `bookkeepingTransactionClassification` 중 `status !== 'excluded'` 행을 읽는다.
5. `status === 'confirmed'` 행만 금액 합계에 포함한다. `suggested`·`needs_decision`·`unclassified`는 확인 필요 blocker로 남긴다.

## 5. Business Status Report Read Model

```ts
type BusinessStatusReportSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string; taxEntityType: 'individual' | 'corporation' | 'tax_exempt' | null } | null
  fiscalYear: number
  eligibility: BusinessStatusEligibility
  hero: {
    preparationPercent: number
    attentionCount: number
    revenueTotalKrw: number
    expenseTotalKrw: number
  }
  blockers: Array<{
    id: string
    title: string
    description: string
    tone: 'warn' | 'danger'
    href: '/dashboard/direct-upload' | '/dashboard/bookkeeping' | '/dashboard/settings'
    ctaLabel: '자료수집 열기' | '자료대조원장 열기' | '설정 열기'
  }>
  revenueRows: BusinessStatusAmountRow[]
  expenseRows: BusinessStatusAmountRow[]
  handoffRows: BusinessStatusHandoffRow[]
}

type BusinessStatusAmountRow = {
  id: string
  label: string
  amountKrw: number
  sourceCount: number
  statusLabel: '준비 완료' | '확인 필요'
  tone: 'ok' | 'warn'
}
```

### 5.1 수입금액 집계

수입금액은 귀속연도 내 확정 기장 행 중 `direction === 'income'`인 행의 `amountKrw` 합계다.

- `amountKrw === null`인 income 행은 합계에서 제외하고 blocker로 표시한다.
- 분류 label은 `finalAccount ?? recommendedAccount ?? '미분류 수입'` 순서로 정한다.
- `status !== 'confirmed'`인 income 행은 합계에서 제외하고 "수입금액 계정분류 확인" blocker로 표시한다.

```ts
function buildBusinessStatusRevenueRows(rows: BusinessStatusClassificationRow[]): BusinessStatusAmountRow[]
```

### 5.2 매입·경비 자료 집계

매입·경비 자료는 귀속연도 내 확정 기장 행 중 `direction === 'expense'`인 행의 `amountKrw` 합계다.

- 분류 label은 `finalAccount ?? recommendedAccount ?? sourceTypeLabel` 순서로 정한다.
- 카드/현금영수증/세금계산서 등 자료 유형은 `sourceType`으로 보조 표시할 수 있으나, v1의 금액 분류 기준은 확정 계정명이다.
- `status !== 'confirmed'` 또는 `amountKrw === null`인 expense 행은 합계에서 제외하고 blocker로 표시한다.

```ts
function buildBusinessStatusExpenseRows(rows: BusinessStatusClassificationRow[]): BusinessStatusAmountRow[]
```

### 5.3 확인 필요/준비율

확인 필요는 세 갈래로 계산한다.

| 원인 | 판정 | CTA |
|:---|:---|:---|
| 사업자 유형 미지정 | `taxEntityType === null` | 설정 열기 |
| 자료 누락/정규화 대기 | `YYYY-H1` + `YYYY-H2` `loadSourceCollectionSummary()`의 `missingItems.length`와 `normalizationPendingCount` 합산값 > 0 | 자료수집 열기 |
| 기장 미확정 | classification row `status`가 `suggested`·`needs_decision`·`unclassified` | 자료대조원장 열기 |

준비율은 저장하지 않는 파생값이다.

```ts
function buildBusinessStatusPreparationPercent(params: {
  applicable: boolean
  blockerCount: number
  confirmedRevenueCount: number
  confirmedExpenseCount: number
}): number
```

v1 기본 규칙: 대상이 아니면 0, 대상이고 수입/경비 확정 행이 없으면 0, blocker가 없으면 100, blocker가 있으면 `Math.round(confirmedReadyCount / (confirmedReadyCount + blockerCount) * 100)`.

## 6. Hometax Handoff Contract

이 화면은 홈택스 업로드·신고 전 확인할 자료 상태만 보여준다. 홈택스 화면에 값을 옮겨 적도록 안내하는 직접입력 경로는 제공하지 않는다.

| handoff 항목 | 표시 기준 |
|:---|:---|
| 수입금액 | `revenueTotalKrw` + 분류별 `revenueRows` |
| 매입·경비 자료 | `expenseTotalKrw` + 분류별 `expenseRows` |
| 누락/미확정 | `blockers` |
| 제출 안내 | "공식 업로드 양식·파일 입수 전까지 화면 전사 안내는 제공하지 않음" |

- "제출 완료", "신고 보장", "대리 신고", "자동 제출" 같은 문구는 쓰지 않는다.
- 전자신고 파일 생성 버튼은 두지 않는다(JC-030).

## 7. 허브 트랙 live 전환

`lib/filing-preparation/summary.ts`의 `buildTracks`에 `business_status` 트랙을 추가한다.

- `type === 'tax_exempt'`이면 applicable + live.
- `type === 'individual' || type === 'corporation'`이면 해당 없음(`href: null`).
- `type === 'unknown'` 또는 `null` 기반이면 사업자 유형 미지정 안내를 띄우고 설정으로 라우팅할 수 있다.
- chipLabel은 경량 요약의 `attentionCount` 기반: `확인 N건` / `데이터 준비` / `대상 없음`.
- 상세 href: `/dashboard/filing-preparation/business-status-report`.

허브는 상세 표를 로드하지 않고 경량 카운트만 읽는다.

```ts
async function loadBusinessStatusReportAttentionCount(params: {
  tenantId: string
  fiscalYear?: number
}): Promise<{ total: number; attention: number; revenueTotalKrw: number } | null>
```

## 8. Screen States

| 상태 | 표시(승인 Preview와 일치) |
|:---|:---|
| Loading | "사업장현황신고 준비 상태를 불러오는 중입니다." |
| Empty | "자료수집과 기장검토를 먼저 완료하면 사업장현황신고 준비 데이터가 채워집니다." |
| Error | "준비 상태를 불러오지 못했습니다. 다시 시도해 주세요." |
| No Permission | "회사 권한이 있는 담당자만 사업장현황신고 준비 상태를 볼 수 있습니다." |
| Not Applicable | "현재 사업자 유형은 사업장현황신고 대상이 아닙니다." |

## 9. Acceptance Criteria

- [x] 면세 개인사업자(`tax_exempt`)만 사업장현황신고 준비 화면을 사용할 수 있다.
- [x] 과세 개인·법인은 해당 없음 상태가 표시되고, 실행 링크는 막힌다.
- [x] 사업자 유형 미지정은 설정 화면으로 라우팅되는 확인 필요 상태로 표시된다.
- [x] 귀속연도 기준 수입금액이 확정 기장 행(`direction='income'`, `status='confirmed'`)으로 집계된다.
- [x] 귀속연도 기준 매입·경비 자료가 확정 기장 행(`direction='expense'`, `status='confirmed'`)으로 집계된다.
- [x] 미확정 기장 행·금액 누락·자료 누락/정규화 대기는 확인 필요 blocker로 표시되고 자료수집/기장검토/설정으로 라우팅된다.
- [x] 신고 준비 허브에 `business_status` 트랙이 추가되고, 면세 개인사업자일 때 검토 화면으로 링크된다.
- [x] 화면은 read-only이며 mutation을 수행하지 않는다.
- [x] 홈택스 제출·전자신고 파일 생성·자동제출은 포함하지 않는다.
- [x] 대상 분기·집계·blocker·허브 트랙은 순수 함수 단위 테스트로 검증된다.

## 10. Component & Library Plan

- shadcn/ui: 기존 대시보드 컴포넌트만 재사용. 신규 설치 없음.
- Custom: `BusinessStatusReportReview`(JC-024/027 전용 검토 화면 패턴 재사용).
- Reused: 신고 준비 허브 track card, 상태칩, progress bar, table/card 패턴.
- New libraries: **없음**.
- shadcn preset action: N/A.

## 11. Related Documents

- **Concept_Design**: [Product Baseline — Target Tax Coverage](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 사업장현황신고(면세사업자) 커버리지
- **UI_Screens**: [11_business_status_report.html](../02_UI_Screens/previews/11_business_status_report.html) - 승인 화면 · [Screen Flow 4k](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.13](../02_UI_Screens/01_UI_DESIGN.md)
- **Technical_Specs**: [Filing Preparation Hub Pre-Code Brief](./15_FILING_PREPARATION_PRE_CODE_BRIEF.md) - 허브 트랙 구조 · [Bookkeeping Review Pre-Code Brief](./06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md) - 기장검토 최신 completed run 조회 패턴 · [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md) - JC-028 done 조건
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-028 Context Lock
