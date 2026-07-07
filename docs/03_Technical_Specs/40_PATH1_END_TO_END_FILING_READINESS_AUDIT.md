# Path 1 End-to-End Filing Readiness Audit
> Created: 2026-07-07 23:29 KST
> Last Updated: 2026-07-08 02:01 KST

## 0. Purpose

This document fixes the simplest beta workflow for SemuAgent Path 1 and checks
whether the current product actually follows it.

The user-approved target is:

```text
자료수집에 회사 자료 업로드
-> 통장·카드·세금계산서·영수증·급여 자료 정규화
-> 귀속기간·중복·업무관련성·공제 가능성 검토
-> 계정항목 추천, 불확실한 항목은 사용자가 선택·메모
-> 확정 데이터만 세목별 신고 준비 데이터로 집계
-> 홈택스 업로드용 공식 양식·파일에 들어갈 값을 화면에서 확인
-> SemuAgent가 양식·파일 후보를 생성
-> 사용자가 홈택스에서 직접 업로드·검증·제출
```

There is no Hometax direct-entry path in beta. The app must not tell the user to
copy values into Hometax screens as a primary workflow. Path 1 means
**form/file preparation for Hometax upload**.

## 1. Current Answer

The direction is correct, but the product is not finished end to end for every
tax type.

| Step | Current state | Evidence | Gap |
|---|---|---|---|
| 자료수집 | Live | `lib/source-collection/summary.ts`, `/dashboard/direct-upload` | Source completeness exists, but cross-source reconciliation is not a named Path 1 gate |
| 정규화·귀속기간·중복 | Partial/live | `lib/bookkeeping/period-attribution-service.ts`, `lib/bookkeeping/attribution-gate.ts` | Include/hold/duplicate decisions exist, but bank-card-tax-invoice matching is not yet a single user-facing checklist |
| 계정항목 추론·확정 | Live | `lib/bookkeeping/classification-service.ts`, `/dashboard/bookkeeping` | Account recommendation, user account selection, `confirmed`, `excluded`, memo are present |
| 사적 사용·업무무관 제외 | Partial/live | `status='excluded'` requires memo; VAT deduction review supports non-deductible decisions | Needs a unified "why excluded" taxonomy across bookkeeping and VAT |
| 세목별 신고 준비 데이터 | Live for core tracks | VAT, payroll/withholding, payment statements, local income tax, business status report read models | Some tracks are review data only; Path 1 files are not available for all tracks |
| 양식에 채워질 값 확인 | Live for simplified wage | `filledFormPreview` in `lib/efiling-simplified-wage/panel-summary.ts` | Must become the repeatable pattern for each tax type |
| 홈택스 업로드용 파일 | Live for simplified wage Path 1 | `lib/efiling-simplified-wage`, generate API, upload guide | Withholding is validation-panel only; VAT and other forms still pending |
| 최종 제출 | User only | Product Baseline, Path 1 Roadmap | Auto-submit and credential storage remain excluded |

## 2. Product Contract

Path 1 beta is one path:

1. SemuAgent prepares the official upload artifact.
2. The user inspects the values before download.
3. The user downloads the file.
4. The user opens Hometax and uploads/submits directly.

Not Path 1:

- Hometax screen transcription or direct-entry copy workflow.
- Auto-submit.
- Storing Hometax passwords, certificates, bank passwords, or card credentials.
- Sending the package to a tax office or accounting firm.

## 3. Data Preparation Contract

Path 1 is only as good as the confirmed data beneath it. A tax-type file may be
generated only from data that passed these gates:

| Gate | Required behavior |
|---|---|
| Source completeness | Required source groups for the period are present or explicitly marked not applicable |
| Source normalization | Files are parsed into rows or explicitly blocked for review |
| Period attribution | Rows/files are included in the filing period, held, marked reference-only, or excluded as duplicate |
| Reconciliation | Bank, card, tax invoice, and receipt signals are compared where the tax type requires it |
| Business relevance | Personal/private/business-unrelated items are excluded with a user-visible reason |
| Account confirmation | Each filing-relevant transaction has a final account or is blocked |
| Tax-specific review | VAT deduction, payroll employee status, local income, or business-status requirements are confirmed |
| Form-fill preview | The user sees the exact values that will be put into the official file/form before download |

## 4. What Is Already Designed Correctly

- The product boundary is correct: SemuAgent prepares data and files; the user
  submits in Hometax.
- The common foundation exists: source collection -> bookkeeping review ->
  confirmed rows.
- The bookkeeping review already supports the key human loop:
  AI/rule recommendation -> account selection -> approval -> confirmed data.
- Exclusion exists as a status and requires a memo before the row can be
  excluded.
- VAT deduction review exists separately for deductible/non-deductible input tax
  decisions.
- The first Path 1 form-fill preview exists for simplified wage statements.

## 5. What Is Not Yet Strong Enough

### 5.1 Cross-source reconciliation is not yet a first-class Path 1 gate

The code has source types, attribution, duplicate handling, and extracted
transaction candidates. But the product still needs an explicit checklist for:

- bank deposit/withdrawal vs tax invoice/card/receipt rows,
- duplicate payment vs duplicate evidence,
- card payment settlement vs individual card purchases,
- missing evidence for a bank movement,
- tax-invoice-only evidence that has not appeared in bank/card records.

This is now positioned as the **기장검토 하위 "자료대조원장"** gate before a tax form can be marked ready, not as a 신고 준비 child screen. The dedicated UI Preview is approved in `docs/02_UI_Screens/previews/12_reconciliation_ledger.html` (2026-07-08), using bank/card/tax-invoice/cash-receipt source-ledger references as inspiration. The detailed Phase 2 contract is fixed in [Reconciliation Ledger Phase 2 Pre-Code Brief](./41_RECONCILIATION_LEDGER_V2_PRE_CODE_BRIEF.md): bank-to-evidence candidates, account confirmation, explanation memo, exclusion reason taxonomy, and Path 1 blockers.

### 5.2 Private or business-unrelated exclusion needs one shared language

Today, bookkeeping rows can be `excluded` with a memo, and VAT deduction rows can
be non-deductible. That is useful but fragmented.

Path 1 should standardize exclusion reasons such as:

- personal/private use,
- business-unrelated,
- duplicate evidence,
- wrong period,
- reference-only,
- non-deductible VAT,
- unsupported/needs expert review.

### 5.3 Form-fill preview exists for one tax type only

Simplified wage now shows the correct pattern:

- form name,
- period,
- business identity,
- target employees,
- totals,
- one-time PII input status,
- file-generation boundary.

The same "filled form preview before download" must be repeated for withholding,
VAT, local income tax, and business status report before those Path 1 files are
considered beta-ready.

## 6. Recommended Next Work

The next product work should be Path 1 completion, not Path 2 and not Path 3.

1. **Path 1 data readiness gate — 자료대조원장**
   - Add a single readiness contract under 기장검토 that every tax-type file checks before
     download: source completeness, reconciliation, exclusion reasons, account
     confirmation, tax-specific review.
   - Implement against the Phase 2 contract in
     [Reconciliation Ledger Phase 2 Pre-Code Brief](./41_RECONCILIATION_LEDGER_V2_PRE_CODE_BRIEF.md).
2. **원천세 Path 1 complete**
   - Finish official layout acquisition.
   - Add filled-form preview for the withholding form.
   - Enable file download only after validation passes.
3. **Reconciliation/exclusion UX**
   - Make bank/card/tax-invoice matching and private-use exclusion visible and
     actionable instead of leaving them as scattered lower-level statuses.
4. **Apply the same filled-form preview pattern to each tax type**
   - VAT, local income tax, business status report, and later annual statements.

## 7. Documentation Sync

This audit supersedes any wording that presents Path 1, Path 2, and Path 3 as
equal current choices. For beta:

- Path 1 is the product path.
- Path 2 is after Path 1 beta.
- Path 3 is future work after certification/conformance is clear.
- Hometax direct-entry guidance is excluded.

Related:

- [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md)
- [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Reconciliation Ledger Phase 2 Pre-Code Brief](./41_RECONCILIATION_LEDGER_V2_PRE_CODE_BRIEF.md)
