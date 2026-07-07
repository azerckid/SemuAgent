# Reconciliation Ledger Phase 2 Pre-Code Technical Brief
> Created: 2026-07-08 02:01 KST
> Last Updated: 2026-07-08 02:40 KST

## 0. Purpose

This brief defines the next implementation contract for **기장검토 > 자료대조원장**.

The approved product path is Path 1 only:

```text
자료수집
-> 자료대조원장(입출금 대조, 증빙 연결, 계정항목 확정, 제외/소명)
-> 세목별 신고 준비 데이터
-> 양식에 채워질 값 확인
-> 홈택스 업로드용 파일 생성
-> 사용자가 홈택스에서 업로드·제출
```

This screen is not a tax-filing finish screen and not a Hometax direct-entry
guide. It is the data quality gate that decides whether tax-type Path 1 files
can trust the ledger beneath them.



## 0.1 Adopted UI Direction: Ledger Table + Right Work Panel

The adopted UI direction is **not** a passive candidate-count dashboard. It is a workbench where the user finishes each transaction row.

The main layout is:

- Left/center: a dense ledger table with bank, card, tax-invoice, cash-receipt, receipt, and other rows.
- Right side: a persistent work panel for the selected row.

The right work panel is the preferred SemuAgent adaptation of the reference screens. A bottom drawer is allowed only on narrow screens, but desktop should keep the selected row visible while the user works in the side panel.

The right work panel must include:

1. Selected transaction summary: source, date, counterparty, description, amount, current account, and remaining difference.
2. Auto-suggested evidence: concrete evidence rows with amount/date/counterparty match reasons, not just a count.
3. Evidence finder: source selector for 세금계산서, 현금영수증, 체크카드/카드, plus search, date filter, amount filter, and row-level connect actions.
4. Account confirmation: recommended account, searchable account selector, and optional repeat/apply-to-similar control.
5. Explanation and exclusion: business-use memo, personal/private, business-unrelated, duplicate, wrong-period, internal-transfer, or other exclusion reasons.
6. Save state: confirmed only when evidence, account, counterparty, explanation/exclusion, and period relevance are resolved as needed.

## 0.2 Candidate Count Rule

"후보 N건" by itself is not an acceptable final UI state. It may appear as a compact hint, but the row or work panel must expose the actual candidate rows and actions.

- Clear match: show the linked evidence row and actions to confirm, unlink, or replace.
- Ambiguous match: show concrete candidates and actions such as "이 증빙 연결", "아님", and "직접 찾기".
- No match: show "증빙 찾기" as the primary action.

Path 1 file generation must read the resolved completion state, not a candidate count.

## 1. Scope

### Included

- Show bank, card, tax-invoice, cash-receipt, and other normalized records in one
  reconciliation ledger.
- Show likely links between bank deposits/withdrawals and supporting evidence
  such as tax invoices, card approvals, receipts, and cash receipts.
- Separate clear matches, ambiguous candidates, missing evidence, duplicate
  evidence, and exclusion candidates.
- Let the user confirm or change account categories for filing-relevant rows.
- Let the user explain unclear business use in a modal-like interaction.
- Let the user exclude personal/private, business-unrelated, duplicate, or
  wrong-period items with a required reason.
- Derive tax-type blockers that stop Path 1 file generation until the row is
  confirmed or explicitly excluded.

### Excluded

- Hometax screen transcription, copy-to-Hometax values, or direct-entry guide.
- Hometax auto-submit, credential storage, certificate storage, or background
  login.
- Official Path 1 file generation itself. That remains JC-030.
- New AI write engine that automatically confirms matches without user review.
- Tax/legal judgment beyond presenting data and requiring user confirmation.

## 2. Slice Plan

| Slice | Goal | DB change | User-visible result |
|:---|:---|:---:|:---|
| 2a | Reconciliation read model and candidate display | No | Rows show source, linked evidence candidates, match state, and blockers |
| 2b | Account/exclusion/explanation actions | No preferred | Existing classification and attribution APIs are reused where possible |
| 2c | Persisted reconciliation links, only if required | Additive only | User-confirmed bank-to-evidence links survive reloads and audits |

Slice 2a must not invent a new table. If Slice 2b discovers that confirmed
matches need a durable pair/link model, Slice 2c must get a separate migration
brief before code starts.

## 3. Existing Data to Reuse

| Existing surface | Useful fields | Use in 자료대조원장 |
|:---|:---|:---|
| `bookkeeping_transaction_classification` | `sourceType`, `direction`, `transactionDate`, `merchantName`, `amountKrw`, `evidenceJson`, `recommendedAccount`, `finalAccount`, `staffMemo`, `status` | Unified ledger rows, account confirmation, explanation memo, exclusion state. `cash_receipt` is a display-level source derived from receipt/source metadata; it is not a new DB enum in Slice 2a. |
| `bookkeeping_material_attribution` | `recommendation`, `staffDecision`, `staffNote`, period relation and duplicate basis fields | Include/hold/duplicate/reference decisions for source materials |
| `bookkeeping_ledger_material_link` | `ledgerMonthId`, `materialAttributionId` | Existing lineage between ledger output and source materials |
| Account classification API | `PATCH /api/sessions/[id]/account-classification/rows/[rowId]` | Confirm account, set memo, mark excluded |
| Material attribution API | Existing period-attribution update service and schemas | Include, hold, duplicate, reference-only decisions |

Known existing behavior:

- `status='excluded'` already requires a memo in the classification service.
- `finalAccount` can override `recommendedAccount`.
- `staffMemo` can store the user's explanation for v1.
- `bookkeepingMaterialAttribution.staffDecision` already supports
  `include`, `hold`, `exclude_duplicate`, and `reference_only`.

## 4. Data Contract

Implementation must move these contracts into Zod schemas at the module boundary so route params, query filters, and mutation payloads fail closed instead of drifting from this document.

```ts
type ReconciliationSource =
  | 'bank'
  | 'card'
  | 'tax_invoice'
  | 'receipt'
  | 'cash_receipt'
  | 'other'

type ReconciliationMatchState =
  | 'matched'
  | 'candidate'
  | 'ambiguous'
  | 'missing_evidence'
  | 'duplicate_candidate'
  | 'excluded'
  | 'confirmed'

type ReconciliationBlockerCode =
  | 'missing_evidence'
  | 'ambiguous_match'
  | 'account_unconfirmed'
  | 'explanation_required'
  | 'exclude_reason_required'
  | 'tax_specific_review_required'

type ReconciliationExclusionReason =
  | 'personal_private'
  | 'business_unrelated'
  | 'duplicate_evidence'
  | 'wrong_period'
  | 'reference_only'
  | 'non_deductible_vat'
  | 'internal_transfer'
  | 'refund_or_cancellation'
  | 'unsupported_needs_review'

type ReconciliationMatchCandidate = {
  id: string
  source: ReconciliationSource
  rowId: string
  date: string | null
  counterparty: string | null
  amountKrw: number | null
  taxAmountKrw?: number | null
  confidence: 'high' | 'medium' | 'low'
  reason:
    | 'same_amount_same_day'
    | 'same_amount_near_day'
    | 'same_counterparty_amount'
    | 'partial_amount'
    | 'many_to_one'
    | 'manual_reference'
}

type ReconciliationLedgerRow = {
  id: string
  source: ReconciliationSource
  transactionDate: string | null
  counterparty: string | null
  description: string
  direction: 'income' | 'expense' | 'unknown'
  amountKrw: number | null
  taxAmountKrw: number | null
  recommendedAccount: string | null
  finalAccount: string | null
  explanationMemo: string | null
  exclusionReason: ReconciliationExclusionReason | null
  matchState: ReconciliationMatchState
  candidates: ReconciliationMatchCandidate[]
  blockers: Array<{ code: ReconciliationBlockerCode; label: string }>
  actions: {
    canConfirmAccount: boolean
    canExplain: boolean
    canExclude: boolean
    canConfirmMatch: boolean
  }
}
```

## 5. Candidate Matching Rules

Slice 2a shows candidates; it does not silently confirm them. A candidate count is never enough by itself. Every candidate state must expose the concrete evidence rows and a next action: confirm this evidence, reject it, or search manually.

| Case | Candidate rule | Initial state |
|:---|:---|:---|
| Bank movement and evidence have same amount, same date, same/near counterparty | High confidence | `candidate`, user can confirm |
| Same amount within a short date window | Medium confidence | `candidate` |
| Same counterparty but amount differs | Low confidence | `ambiguous` |
| One bank payment covers multiple receipts/invoices | Many-to-one | `ambiguous` |
| Card settlement bank movement vs individual card purchases | Group candidate | `ambiguous` until user confirms grouping |
| Evidence exists without bank/card movement | Evidence-only | `missing_evidence` or tax-type review blocker |
| Bank/card movement exists without evidence | Source-only | `missing_evidence` unless user marks no evidence required |
| Duplicate invoice/receipt/card proof | Duplicate candidate | `duplicate_candidate` |

Amounts and dates are matching signals, not legal conclusions. The UI must show
why a candidate was suggested.

## 6. User Actions

| Action | Description | Preferred implementation |
|:---|:---|:---|
| Confirm account | User accepts or changes `finalAccount` | Existing account classification row PATCH |
| Explain use | User writes usage/business purpose memo | `staffMemo` for v1 |
| Exclude row | User marks personal/private, business-unrelated, duplicate, wrong period, etc. | `status='excluded'` + required reason/memo; map to existing memo first |
| Open evidence finder | User chooses 세금계산서 / 현금영수증 / 체크카드 and searches evidence rows | Row-level work panel or bottom drawer |
| Add evidence link | User selects one or more evidence rows and balances the transaction amount | Slice 2a read-only; Slice 2c persisted link if required |
| Confirm match | User confirms bank-to-evidence candidate | Slice 2a read-only; Slice 2c persisted link if required |
| Mark no evidence required | User says the row is allowed without matching evidence | v1 can store memo; durable enum requires Slice 2c |
| Hold for later | User keeps row out of current filing period | Existing material attribution decision where applicable |

The explanation interaction should be modal-like: the user opens one row, sees
source details and candidate evidence, writes a short memo, chooses account or
exclusion reason, and saves.

## 7. Path 1 Readiness Gate

A tax-type Path 1 file may be enabled only when every filing-relevant row meets
one of these conditions:

1. It is confirmed with a final account and any required evidence/match.
2. It is excluded with a reason and memo.
3. It is explicitly marked not applicable to the current filing period.
4. It is tax-specific reviewed elsewhere, such as VAT non-deductible review.

Block download when any of these remain:

- missing required source group,
- unmatched bank/card movement that requires evidence,
- ambiguous match not resolved,
- account unconfirmed,
- explanation required,
- exclusion reason missing,
- tax-specific blocker still open.

This gate feeds filing-preparation tracks, but the gate itself belongs under
기장검토.

## 8. UI Contract

Route: `/dashboard/bookkeeping/reconciliation-ledger` (introduced by PR #139).

The approved Preview remains
[12_reconciliation_ledger.html](../02_UI_Screens/previews/12_reconciliation_ledger.html).
Phase 2 implementation should keep that layout:

1. Readiness hero.
2. Source summary cards.
3. Source tabs: all, bank, card, tax invoice, cash receipt, missing evidence,
   exclusion review.
4. Unified ledger table. The linked-evidence column must show either an actual linked evidence item, an actionable concrete candidate, or "증빙 찾기". It must not stop at "후보 N건".
5. Right work panel for the selected row. It handles match candidates, evidence search, account confirmation, explanation, and exclusion while keeping the ledger table visible. On narrow screens this may collapse into a drawer.
6. Evidence finder inside the work panel opened from "증빙 찾기": source selector (세금계산서/현금영수증/체크카드), search/date filters, evidence table, add/select action, selected total, remaining difference, save/cancel.
7. Tax-file readiness panel.

The table may initially be read-only in Slice 2a, but the labels must be honest:
inactive search or settings controls must look disabled until implemented.

## 9. Acceptance Criteria

- The user can see which bank movements match or fail to match tax invoices,
  card approvals, cash receipts, or receipts.
- The user can see why a match candidate was suggested.
- From a bank row, the user can open "증빙 찾기", choose 세금계산서/현금영수증/체크카드, search rows, select evidence, and see the remaining difference before saving.
- The final UI does not use candidate counts as the main answer; it shows concrete candidate rows and actions.
- Ambiguous matches are not auto-confirmed.
- The user can confirm or change the account category for filing-relevant rows.
- The user can open a row-level explanation modal and save a memo.
- The user can exclude a row only with an explicit reason and memo.
- Excluded or held rows are visible and auditable.
- Filing-preparation tracks read blocker counts from this gate instead of
  pretending the tax form is ready.
- The screen does not provide Hometax direct-entry guidance.

## 10. Implementation Preconditions

- [x] Path 1 product path excludes Hometax direct entry.
- [x] 자료대조원장 location approved under 기장검토.
- [x] HTML Preview approved:
  [12_reconciliation_ledger.html](../02_UI_Screens/previews/12_reconciliation_ledger.html).
- [x] Existing classification and attribution schemas inspected.
- [ ] Slice 2a read model reviewed before code.
- [ ] Slice 2b mutation mapping reviewed before code.
- [ ] Slice 2c durable match-link schema approved if needed.

## 11. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - company self-use filing assistance boundary.
- **UI_Screens**: [Screen Flow 4c](../02_UI_Screens/00_SCREEN_FLOW.md) - 자료대조원장 position and flow; [UI Design 4.3a](../02_UI_Screens/01_UI_DESIGN.md) - approved component contract; [Reconciliation Ledger Prototype Review](../02_UI_Screens/12_RECONCILIATION_LEDGER_PROTOTYPE_REVIEW.md) - user approval record.
- **Technical_Specs**: [Bookkeeping Review Pre-Code Brief](./06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md) - existing classification queue contract; [Path 1 End-to-End Filing Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md) - product path and gaps; [DB Schema](./03_DB_SCHEMA.md) - existing bookkeeping tables.
- **Logic_Progress**: [Backlog JC-010](../04_Logic_Progress/00_BACKLOG.md) - Context Lock and implementation tracking.
- **QA_Validation**: [Bookkeeping Review Test Scenarios](../05_QA_Validation/04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md) - existing JC-010 QA baseline; Phase 2 scenarios to add before Slice 2b implementation.
