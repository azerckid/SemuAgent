# Local Income Tax (원천세 특별징수분) Pre-Code Technical Brief
> Created: 2026-07-05 04:10
> Last Updated: 2026-07-05 04:22

## 0. Governing Principle

JC-027은 "지방소득세 전체"가 아니라 **원천세 특별징수분 지방소득세만** 다룬다. 급여에 이미 실제 기록된 `payrollEmployeeLine.localIncomeTaxKrw`를 집계하는 read-only 화면이며, 신고 준비 허브(JC-029)의 마지막 roadmap 트랙(`local_income`)을 live로 채운다.

- **신규 세액 계산 없음.** 확정 라인의 실제 저장값을 합산할 뿐, 10%/11 같은 근사 계산을 도입하지 않는다.
- **범위**: 종합소득세분·법인세분 지방소득세는 JC-025/026 완료 이후 별도. 위택스 자동 제출은 JC-023 게이트 전 미도입.
- **데이터 정합성 수정(같은 범위)**: 신고지원(JC-013)이 `splitWithholdingTax()`(원천세 합계를 10%/11로 근사 분리)로 지방소득세를 표시하던 것을, 이 화면과 **같은 실제값 소스와 같은 확정 라인 합산 규칙**으로 교체한다. 두 화면이 같은 기간에 다른 숫자를 보이지 않는다.
- 화면 언어는 "귀속기간·원천세 신고 주기 기준"으로 쓰고 월 단위를 못박지 않는다(반기납부 특례 고려). v1 구현은 단일 payroll period(월, `YYYY-MM`) 조회이며, 반기 누적 뷰는 후속이다.
- 기준 화면은 승인된 [10_local_income_tax.html](../02_UI_Screens/previews/10_local_income_tax.html)(UI-First Gate 승인 2026-07-05, 숫자 정합성 리뷰 반영)을 따른다.

## 1. Scope

포함한다.

1. 신규 read-only 화면 `/dashboard/filing-preparation/local-income-tax`
2. 원천세 특별징수분 지방소득세 직원별 집계 read model(해당 payroll period 기준)
3. 신고 준비 허브(JC-029)의 `local_income` 트랙 roadmap→**live** 전환 + 검토 화면 링크
4. **신고지원(JC-013) 정합성 수정** — `splitWithholdingTax()` 사용을 실제 `incomeTaxKrw`·`localIncomeTaxKrw` 확정 라인 합계로 교체
5. 확인 필요(급여 미확정) → 급여 라우팅
6. 단위 테스트(집계·상태 판정·신고지원 교체 함수)

제외한다(후속).

- 종합소득세분·법인세분 지방소득세(JC-025/026)
- 위택스 자동 제출(JC-023) · 신규 세액 계산 엔진
- 반기 누적 뷰(v1은 단일 payroll period만)

## 2. Data Contract — 공유 로더 (JC-027 화면 + 신고지원 재사용)

기존 급여(JC-012) 스키마만 조회한다. **신규 테이블·마이그레이션 없음.**

```ts
type LocalIncomeTaxLine = {
  employeeCode: string | null
  employeeName: string
  grossPayKrw: number
  incomeTaxKrw: number       // 소득세(국세), payrollEmployeeLine.incomeTaxKrw 실제값
  localIncomeTaxKrw: number  // 지방소득세(특별징수), payrollEmployeeLine.localIncomeTaxKrw 실제값
  status: 'ready' | 'needs_review' | 'closed'
}

async function loadLocalIncomeTaxLines(params: {
  tenantId: string
  clientId: string
  periodSummaryId: string
}): Promise<LocalIncomeTaxLine[]>
```

- `payrollPeriodSummary`에서 대상 period(기본: 최신, 또는 지정 periodKey)의 `id`를 구하고, 그 `periodSummaryId`로 `payrollEmployeeLine`을 조회한다(JC-024·JC-018과 동일한 조회 패턴).
- 로더는 상태와 무관하게 전체 라인을 읽는다. 단, **신고 준비 금액 합계에는 확정 라인만 포함**한다. `status === 'needs_review'` 라인은 대상 인원·확인 필요·blocker에는 포함하지만, Hero/표 합계/신고지원 입력값에는 포함하지 않는다.
- 확정 라인은 `status === 'ready' || status === 'closed'`로 판정한다. 이 규칙은 승인된 Preview의 "집계 대기" 행과 "합계(준비 완료 N명)" 표현을 따른다.
- 이 로더와 확정 라인 합산 함수는 **JC-027 화면과 신고지원(JC-013) 양쪽에서 재사용**한다 — 두 곳이 서로 다른 계산을 하지 않도록 단일 소스로 둔다.

```ts
type LocalIncomeTaxTotals = {
  totalEmployees: number
  readyEmployees: number
  attentionCount: number
  grossPayKrw: number          // Σ 확정 라인
  incomeTaxKrw: number         // Σ 확정 라인
  localIncomeTaxKrw: number    // Σ 확정 라인
}

function buildLocalIncomeTaxTotals(lines: LocalIncomeTaxLine[]): LocalIncomeTaxTotals
```

## 3. JC-027 화면 Read Model

```ts
type LocalIncomeTaxSummary = {
  tenant: {...}
  businessEntity: {...} | null
  periodLabel: string          // "2026-06" 등, "귀속기간" 표기
  hero: {
    totalEmployees: number
    attentionCount: number     // needs_review 라인을 가진 직원 수
    readyEmployees: number
    localIncomeTaxTotalKrw: number  // Σ 확정 라인의 localIncomeTaxKrw
  }
  blockers: [...]  // 급여 미확정 → /dashboard/payroll 라우팅 (JC-024 buildPaymentStatementBlockers 패턴 재사용)
  rows: Array<{
    employeeCode: string | null
    employeeName: string
    grossPayKrw: number
    incomeTaxKrw: number
    localIncomeTaxKrw: number
    status: 'ready' | 'needs_review' | 'closed'
    includedInTotals: boolean
    statusLabel: string  // '준비 완료' | '{period} 급여 미확정'
  }>
}
```

- Hero의 `localIncomeTaxTotalKrw`와 화면 표의 합계 행은 **반드시 같은 소스(§2 로더 + `buildLocalIncomeTaxTotals`)에서 계산**해 Preview에서 지적된 것과 같은 숫자 불일치가 재발하지 않게 한다(단위 테스트로 고정, §6).
- 대상 인원(`totalEmployees`)은 급여 line이 있는 전체 직원 수. `attentionCount`는 `needs_review` 라인을 가진 직원 수.
- `needs_review` 행은 화면에 남기되 `includedInTotals: false`로 표시하고, 금액 칸은 승인된 Preview처럼 "집계 대기" 또는 대시로 처리한다.

## 4. 신고지원(JC-013) 정합성 수정 — Data Contract

**변경 전** (`lib/filing-support/summary.ts:391`):
```ts
const withholdingTaxKrw = params.payroll?.withholdingTaxKrw ?? 0
const { incomeTaxKrw, localIncomeTaxKrw } = splitWithholdingTax(withholdingTaxKrw)
```

**변경 후**: `buildFilingInputGuide`가 §2의 공유 로더와 `buildLocalIncomeTaxTotals`로 얻은 실제 `incomeTaxKrw`·`localIncomeTaxKrw` 확정 라인 합계를 직접 받는다(파라미터로 전달). `splitWithholdingTax()`는 이 교체 이후 호출부가 없으면 **삭제**한다(사용처·테스트 확인 후 dead code 정리 — YAGNI, 백업용으로 남기지 않는다).

- `loadFilingSupportSummary`가 `payrollPeriodSummary`를 조회해 `periodSummaryId`를 얻는 지점(기존 쿼리, `summary.ts:655` 부근)에서 §2의 `loadLocalIncomeTaxLines`와 `buildLocalIncomeTaxTotals`(또는 그 합산 결과)를 함께 로드해 `PayrollFilingSource`에 `incomeTaxKrw`·`localIncomeTaxKrw` 필드를 추가한다.
- `buildFilingInputGuide`는 이 두 값을 그대로 사용(파생 계산 없음). 결과적으로 신고지원 화면과 JC-027 화면이 같은 기간에 대해 항상 같은 숫자를 표시한다.
- 기간에 `needs_review` 라인이 있으면 신고지원도 해당 기간에 확인 필요 상태가 있음을 유지/표시한다. 미확정 행의 금액을 신고지원 입력값에 조용히 섞지 않는다.

## 5. 허브 트랙 live 전환

`lib/filing-preparation/summary.ts`의 `buildTracks` `local_income` 트랙을 roadmap→live로 바꾼다(JC-024의 `payment_statement` 트랙 전환과 동일 패턴).

- `status: 'roadmap'` → `'live'`(경량 카운트 있을 때)
- `href: null` → `/dashboard/filing-preparation/local-income-tax`
- chip은 확인 필요 인원 수 기반(JC-024와 동일 규칙)
- 허브는 경량 카운트만 로드: `loadLocalIncomeTaxAttentionCount(tenantId)` 류 제공

## 6. Screen States & Acceptance Criteria

상태 문구는 승인된 Preview와 일치(Loading/Empty/Error/No Permission).

- [ ] 원천세 특별징수분 지방소득세가 직원별로 집계·표시된다(확정 라인의 실제 `localIncomeTaxKrw` 합계, 파생 계산 아님)
- [ ] Hero 합계와 표의 합계 행이 항상 같은 값이다(같은 로더 재사용, 단위 테스트로 고정)
- [ ] `needs_review` 라인은 대상 인원·확인 필요·blocker에는 포함되지만 Hero/표 합계/신고지원 입력값에는 포함되지 않는다
- [ ] 신고 준비 허브의 `local_income` 트랙이 roadmap→live로 전환되고 검토 화면으로 링크된다
- [ ] 신고지원(JC-013)의 지방소득세 표시가 `splitWithholdingTax` 대신 확정 라인 실제 합계를 사용한다(정합성) — 신고지원과 JC-027 화면이 같은 기간에 같은 숫자를 보인다
- [ ] `splitWithholdingTax`가 이 교체 이후 미사용이면 삭제한다(dead code 정리)
- [ ] 종합소득세분·법인세분 지방소득세, 위택스 자동 제출, 신규 세액 계산은 포함하지 않는다
- [ ] 화면은 read-only이며 mutation을 수행하지 않는다
- [ ] 집계·상태 판정·신고지원 교체 함수가 순수 함수로 단위 테스트된다

## 7. Component & Library Plan

- shadcn/ui components: 기존 대시보드 컴포넌트 재사용. 신규 없음.
- Custom components: `LocalIncomeTaxReview`(JC-024 `PaymentStatementReview` 패턴 재사용).
- New libraries: 없음.
- shadcn preset action: N/A.

## 8. Related Documents
- **Concept_Design**: [Product Baseline — Target Tax Coverage](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 원천세/지방소득세 특별징수 커버리지 표(JC-027 반영)
- **UI_Screens**: [10_local_income_tax.html](../02_UI_Screens/previews/10_local_income_tax.html) - 승인 화면 · [Screen Flow 4j](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.12](../02_UI_Screens/01_UI_DESIGN.md)
- **Technical_Specs**: [Payment Statement Pre-Code Brief](./16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md) - 동일 조회 패턴(periodSummaryId 기반 employeeLine 조회) · [Filing Preparation Hub Pre-Code Brief](./15_FILING_PREPARATION_PRE_CODE_BRIEF.md) - 허브 트랙 live 전환 패턴
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-027 Context Lock
