# VAT Pre-Code Technical Brief
> Created: 2026-07-02 11:03
> Last Updated: 2026-07-02 11:26

## 0. Governing Principle - Preview UI가 계약이다

JC-011 부가세 화면은 승인된 [03_vat.html](../02_UI_Screens/previews/03_vat.html)
구조를 실제 제품 화면으로 옮긴다. 기능을 먼저 붙인 뒤 맞추는 방식이 아니라,
Preview의 업무 흐름을 데이터 계약으로 삼는다.

- 보이는 UI는 회사용 `/dashboard/vat` 화면으로 새로 구성한다.
- GIWA `/dashboard/reviews` 세션 워크스페이스나 외부 고객 업로드 포털을 부가세 화면에
  import/render/embed하지 않는다.
- 자동 홈택스 제출·자동 납부·외부 세무사 검토는 v1 범위 밖이다. JARYO Company는
  세액 집계, 공제 검토, 신고 패키지 초안, 홈택스 입력 가이드까지 보조한다.
- 신고 패키지 생성은 공제 검토가 모두 끝나기 전까지 잠금 상태여야 한다.

## 1. Scope

JC-011 부가세 구현 직전 계약. 기장검토에서 확정된 전표와 VAT 전용 저장소를 바탕으로
다음 화면 단위를 제공한다.

1. 매출세액 - 매입세액 = 납부(예정)세액 요약
2. 매출 구분(과세, 영세율, 면세)
3. 매입세액 공제 검토(공제 확정, 불공제 후보, 안분 필요)
4. 부속 명세 준비 상태
5. 신고 패키지 미리보기와 생성 잠금
6. 로딩, 빈 상태, 오류 상태

JC-011 구현은 Drizzle migration에서 `vat_period_summary`, `vat_deduction_review`를
먼저 추가한 뒤 read model과 화면을 구현한다. DB Schema 문서의 4.1은 이 Brief 기준으로
구체화했고, 구현 1단계에서 `lib/db/schema.ts`와 `drizzle/0053_add_vat_tables.sql`에
물리 스키마를 추가한다.

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | 신규 `/dashboard/vat`, 물리 경로 `app/(dashboard)/dashboard/vat/` |
| 사이드바·홈 CTA | `ROUTES.vat`와 Sidebar "부가세"를 `/dashboard#vat-status`에서 `/dashboard/vat`로 재지정 |
| Read model | `lib/vat/summary.ts` 신규. Server Component에서 호출 |
| Persistence | `vat_period_summary`, `vat_deduction_review` 신규 Drizzle 테이블 |
| Mutation API | `PATCH /api/vat/deduction-reviews/[reviewId]`, `POST /api/vat/periods/[periodKey]/package` 신규 |
| Client UI | `_components/vat-workspace.tsx` 신규. Preview 4.4 구조 |
| 기간 컨텍스트 | URL `?period=`, `buildCompanyHomePeriod` 재사용 |
| Package boundary | PDF/첨부 패키지 생성은 v1 내부 산출물. 홈택스 제출·납부 API 없음 |

## 3. Data Contract

```ts
type VatSalesGroupId = 'taxable' | 'zero_rated' | 'exempt'
type VatDeductionDecision = 'pending' | 'deductible' | 'non_deductible' | 'prorated'
type VatDeductionKind = 'deductible' | 'non_deductible_candidate' | 'proration_required'
type VatTone = 'ok' | 'warn' | 'danger' | 'muted' | 'info'

type VatSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  period: CompanyHomePeriod
  taxSummary: {
    outputTaxKrw: number
    inputTaxDeductibleKrw: number
    payableTaxKrw: number
    pendingDeductionCount: number
    isFinal: boolean
    filingDeadline: string
    dDay: number
  }
  salesGroups: Array<{
    id: VatSalesGroupId
    title: string
    supplyAmountKrw: number
    outputTaxKrw: number | null
    tone: VatTone
  }>
  deductionReviews: Array<{
    id: string
    sourceVoucherId: string | null
    sourceVoucherLineId: string | null
    classificationRowId: string | null
    description: string
    counterparty: string | null
    supplyAmountKrw: number
    inputTaxKrw: number
    kind: VatDeductionKind
    decision: VatDeductionDecision
    reason: string
    actionLabels: string[]
  }>
  schedules: Array<{
    id: 'sales_tax_invoice' | 'purchase_tax_invoice' | 'card_receipt' | 'non_deductible_input_tax'
    title: string
    description: string
    tone: VatTone
    statusLabel: string
  }>
  packagePreview: {
    fileName: string
    description: string
    locked: boolean
    lockReason: string | null
    canGenerate: boolean
  }
}
```

## 4. Query Sources

| UI 영역 | 데이터 소스 | 최소 필드 | 계산/상태 |
|:---|:---|:---|:---|
| 인증·조직·사업장 | Better Auth session, `tenant`, `client` | tenantId, businessEntityId | 미인증 `/sign-in`, 사업장 없으면 빈 상태 |
| 기간 | URL `period`, `buildCompanyHomePeriod` | startMonth, endMonth, deadline | 부가세 1기/2기 확정 신고 기준 |
| 전표 집계 | `bookkeeping_journal_entry_voucher`, `bookkeeping_journal_entry_voucher_line`, `bookkeeping_journal_entry_run`, `upload_session` | status, entryDate, closePeriod, accountName/accountCode, amountKrw | 확정 전표만 집계. tenant+businessEntity+기간 제한 |
| 매출세액 | voucher line | `부가세예수금` 또는 code `255`, credit amount | outputTaxKrw |
| 매입세액 | voucher line + `vat_deduction_review` | `부가세대급금` 또는 code `135`, debit amount, decision | pending 제외/확정 반영 후 inputTaxDeductibleKrw |
| 매출 구분 | `vat_period_summary` | taxable/zero/exempt supply, output tax | 현재 voucher line만으로 영세율·면세 구분이 불완전하므로 snapshot 필수 |
| 공제 검토 | `vat_deduction_review` | kind, decision, reason, prorationRateBps, source refs | 불공제 후보·안분 필요·공제 확정 |
| 부속 명세 | summary + review count | tax invoice/card/non-deductible statuses | 준비됨/검토 대기 |
| 패키지 | `vat_period_summary.packageStatus`, packageStorageKey(후속) | locked/ready/generated | pendingDeductionCount=0일 때 생성 가능 |

### 4.1 신규 테이블 최소 논리 컬럼

`vat_period_summary`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenantId`, `clientId` | tenant + businessEntity 범위 |
| `periodKey`, `periodStartMonth`, `periodEndMonth`, `filingType` | 부가세 기간 식별 |
| `taxableSupplyKrw`, `taxableOutputTaxKrw` | 과세 매출 |
| `zeroRatedSupplyKrw` | 영세율 매출 |
| `exemptSupplyKrw` | 면세 매출 |
| `outputTaxKrw`, `inputTaxKrw`, `inputTaxDeductibleKrw`, `payableTaxKrw` | 세액 요약 |
| `pendingDeductionCount`, `isFinal` | 예정/확정 상태 |
| `packageStatus`, `packageStorageKey`, `generatedAt` | 신고 패키지 상태 |
| `createdAt`, `updatedAt` | 감사·동기화 |

`vat_deduction_review`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenantId`, `clientId`, `periodKey` | 범위 |
| `sourceVoucherId`, `sourceVoucherLineId`, `classificationRowId` | 원천 전표/거래 추적 |
| `description`, `counterparty`, `supplyAmountKrw`, `inputTaxKrw` | 화면 표시 스냅샷 |
| `kind` | `deductible` / `non_deductible_candidate` / `proration_required` |
| `decision` | `pending` / `deductible` / `non_deductible` / `prorated` |
| `reason`, `prorationRateBps` | 판정 근거와 안분율 |
| `confirmedByStaffId`, `confirmedAt` | 사용자 확정 |
| `createdAt`, `updatedAt` | 감사·동기화 |

## 5. Derivation Rules

- 모든 쿼리와 mutation은 `tenantId` + `businessEntityId`(`clientId`) + `periodKey`로 제한한다.
- voucher 집계는 `bookkeeping_journal_entry_voucher.status='confirmed'`만 사용한다.
- `outputTaxKrw`는 `부가세예수금`(code `255`) credit line 합계다.
- `inputTaxKrw`는 `부가세대급금`(code `135`) debit line 합계다.
- `inputTaxDeductibleKrw`는 `vat_deduction_review.decision`이 `deductible` 또는 `prorated`로 확정된 금액만 반영한다. `pending`인 후보는 잠금 사유로 남긴다.
- `payableTaxKrw = outputTaxKrw - inputTaxDeductibleKrw`.
- 매출 구분(과세/영세율/면세)은 `vat_period_summary`의 snapshot 값을 사용한다. 현재 전표 라인만으로는 영세율·면세를 안정적으로 복원하지 않는다.
- 불공제 후보 기본 규칙:
  - 접대비/기업업무추진비 계정 또는 설명이면 `non_deductible_candidate`.
  - 비영업용 승용차 가능성이 있는 차량 관련 매입이면 `non_deductible_candidate`.
  - 과세·면세 공통매입이면 `proration_required`.
  - 그 외 사업 관련 매입세액은 `deductible`.
- 패키지 생성 잠금: `pendingDeductionCount > 0`이면 `canGenerate=false`, disabled button + visible locknote + `aria-describedby`로 사유를 노출한다.
- 세액은 `isFinal=false`이면 "예정"으로 표기한다.

## 6. Mutation and State

| 액션 | 허용 | API/모듈 |
|:---|:---:|:---|
| 공제 확정 | O | `PATCH /api/vat/deduction-reviews/[reviewId]` { decision:'deductible' } |
| 불공제 확정 | O | `PATCH /api/vat/deduction-reviews/[reviewId]` { decision:'non_deductible', reason } |
| 안분 계산 | O | `PATCH /api/vat/deduction-reviews/[reviewId]` { decision:'prorated', prorationRateBps } |
| 패키지 생성 | O(잠금 해제 후) | `POST /api/vat/periods/[periodKey]/package` |
| 홈택스 제출·납부 | X | v1 범위 밖 |
| 전표 수정·분류 승인 | X | JC-010 기장검토 화면 |

- mutation 성공 후 `vat_period_summary`를 재계산하거나 서버에서 revalidate한다.
- 일부 공제 검토가 남아 있으면 패키지 생성 API는 409를 반환한다.
- Loading: `loading.tsx` 스켈레톤.
- Empty: 확정 전표 또는 VAT summary가 없으면 "기장검토 먼저 확정하기".
- Error: "세액 집계를 불러오지 못했습니다" + 다시 시도.
- Toast: 공제 판정 저장, 안분 계산, 패키지 생성 성공/실패는 `sonner`.

## 7. GIWA Gap

| Preview 섹션 | 현재 코드 | JC-011 방향 |
|:---|:---|:---|
| 세액 요약 Hero | 회사 홈의 대기 카드만 존재 | `/dashboard/vat` 전용 read model |
| 과세/영세율/면세 | 전용 저장소 없음 | `vat_period_summary` snapshot |
| 공제 검토 표 | 전용 저장소 없음 | `vat_deduction_review` + mutation |
| 부속 명세 | 없음 | summary/review 기반 상태 리스트 |
| 신고 패키지 | 신고지원 테이블 미구현 | 부가세 패키지 상태는 summary에 최소 저장, JC-013과 연동 |
| 홈택스 제출 | 없음 | 계속 없음. 제출/납부는 회사가 직접 수행 |

## 8. Implementation Sequence

1. Drizzle schema + migration: `vat_period_summary`, `vat_deduction_review` 추가. **완료: `lib/db/schema.ts`, `drizzle/0053_add_vat_tables.sql`**
2. `lib/vat/summary.ts` read model + 순수 파생 함수(세액 계산, pending count, package lock). **완료**
3. `lib/vat/summary.test.ts` - 산식·기간·공제 판정·잠금·tenant 범위. **완료**
4. `/dashboard/vat/page.tsx` SSR + 사업장/전표 없음 빈 상태. **완료**
5. `_components/vat-workspace.tsx` - Preview 4.4 구조(세액 요약 -> 매출 구분 -> 공제 검토 -> 부속 명세 -> 패키지). **완료**
6. 공제 판정 mutation API + UI 배선. **완료: `PATCH /api/vat/deduction-reviews/[reviewId]`, `vat-actions.tsx`**
7. 패키지 생성 guard API + locked button wrapper. **완료: `POST /api/vat/periods/[periodKey]/package`, `vat-actions.tsx`**
8. `loading.tsx`/`error.tsx`. **완료**
9. 사이드바·회사 홈 `ROUTES.vat` 재지정 + 정적 테스트. **완료**
10. 로컬 QA seed로 Preview 숫자(32,000,000 - 18,000,000 = 14,000,000, 검토 3건)를 재현하고 브라우저 캡처 비교.

## 9. Acceptance Criteria

- `/dashboard/vat`가 승인 Preview 구조(세액 요약 -> 매출 구분 -> 공제 검토 -> 부속 명세 -> 패키지)를 따른다.
- 확정 전표/VAT summary 기준 매출세액·매입세액·납부(예정)세액이 산식으로 일치한다.
- 매출이 과세/영세율/면세로 구분되어 공급가액·세액이 표시된다.
- 불공제 후보·공통매입 안분 대상이 표시되고, 사용자가 공제/불공제/안분을 확정할 수 있다.
- 공제 검토가 남아 있으면 신고 패키지 생성 버튼은 disabled + `aria-disabled` + visible locknote로 잠긴다.
- pending 검토가 0건일 때만 패키지 생성 mutation이 허용된다.
- 자동 홈택스 제출·자동 납부·외부 세무사 검토 흐름은 화면에 없다.
- 모든 데이터·mutation은 `tenantId`·`businessEntityId` 범위를 벗어나지 않는다.
- 로딩·빈·오류 상태가 각각 구현된다.

## 10. Open Items

- 실제 PDF 생성 방식은 JC-013 신고지원 패키지 모델과 함께 확정한다. JC-011은 "생성 가능/잠금"과 부가세 패키지 초안 상태까지만 보장한다.
- 영세율·면세 구분은 현재 전표 라인에서 자동 복원하지 않고 `vat_period_summary` snapshot에 저장한다. 향후 거래/전표에 세무 구분 태그가 생기면 파생으로 전환할 수 있다.
- 홈택스 입력 가이드는 JC-013 신고지원 화면에서 최종 사용자 흐름으로 연결한다.
- JC-005 물리 rename(`client` -> `business_entity`) 시 VAT 테이블 FK 명칭도 함께 정리한다.

## 11. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 홈택스 보조 책임 경계
- **UI_Screens**: [Screen Flow 4d](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.4](../02_UI_Screens/01_UI_DESIGN.md) · [VAT Prototype Review](../02_UI_Screens/05_VAT_PROTOTYPE_REVIEW.md) · [HTML Preview](../02_UI_Screens/previews/03_vat.html)
- **Technical_Specs**: [Component & Library Plan](./02_COMPONENT_LIBRARY_PLAN.md) · [DB Schema](./03_DB_SCHEMA.md) · [Bookkeeping Review Pre-Code Brief](./06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-011 Context Lock
- **QA_Validation**: [VAT Test Scenarios](../05_QA_Validation/05_VAT_TEST_SCENARIOS.md) - 구현 전 QA 계약
