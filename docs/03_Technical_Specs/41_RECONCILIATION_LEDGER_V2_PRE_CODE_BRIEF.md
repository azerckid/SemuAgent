# Reconciliation Ledger Phase 2 Pre-Code Technical Brief
> Created: 2026-07-08 02:01 KST
> Last Updated: 2026-07-08 03:25 KST

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
3. Previous-period pattern recommendation: prior confirmed rows that explain likely account, evidence source, counterparty, or exclusion reason. The recommendation must show its historical basis and remain user-confirmed.
4. Evidence finder: source selector for 세금계산서, 현금영수증, 체크카드/카드, plus search, date filter, amount filter, and row-level connect actions.
5. Account confirmation: recommended account, searchable account selector, and optional repeat/apply-to-similar control.
6. Explanation and exclusion: business-use memo, personal/private, business-unrelated, duplicate, wrong-period, internal-transfer, or other exclusion reasons.
7. Save state: confirmed only when evidence, account, counterparty, explanation/exclusion, and period relevance are resolved as needed.

Terminology note: the UI may label the evidence source as **체크카드/카드** for user clarity, but implementation reuses the existing `card` source type. No separate `check_card` DB enum or source type is introduced in this slice.

## 0.2 Required Functions Not Yet Present in the Current Screen

The current implementation is only the first read-only step. The following functions are required for 자료대조원장 to become the real Path 1 workbench, but they are not all present yet. Future work must treat them as product requirements, not optional polish.

| Required function | Meaning | Current status | Implementation direction |
|:---|:---|:---|:---|
| Bank deposit/withdrawal ↔ tax invoice matching | Match bank movements with issued/received tax invoices by amount, date, and counterparty | Missing/partial | Auto-suggest concrete matches; allow user confirm/unlink/manual search |
| Card payment ↔ evidence connection | Connect card approvals to tax invoices, cash receipts, or other proof | Missing/partial | Evidence finder source tabs and row-level connect actions |
| Evidence finder | From a bank/card row, choose 세금계산서/현금영수증/체크카드 and select evidence rows | Missing | Right work panel with source selector, search, date/amount filters, add/select, remaining difference |
| Explanation memo | Let user explain unclear business use for a transaction | Missing | Row-level modal/panel field saved as memo in v1 |
| Bank usage-description memo | Let user write what a bank movement was for when evidence is weak or context is unclear | Missing | Same work panel memo area; make it visible in audit/readiness |
| Previous-period pattern recommendation | Learn from prior confirmed rows such as same counterparty, memo, amount range, evidence type, account, or exclusion decision | Missing | Show the prior-period basis and let the user accept, change, or reject; never auto-confirm |
| AI account recommendation | AI/rules first assign likely account category | Partial/existing source | Show recommended account and confidence; do not hide uncertainty |
| User account selection | If AI cannot decide or confidence is low, user chooses account | Partial/existing source | Highlight uncertain rows and expose searchable account selector in this screen |
| Private/business-unrelated detection | Flag likely personal or low-business-use payments, e.g. cinema, beauty salon, PC room, leisure-like spending | Missing | Heuristic/AI review flag; user must confirm business use or exclude |
| Exclusion reason selection | Exclude personal/private, business-unrelated, duplicate, wrong-period, internal transfer, etc. | Missing/partial memo only | Required reason taxonomy plus memo before row can be considered resolved |
| Inline account edit | Change account category directly from 자료대조원장 | Partial/existing route elsewhere | Reuse account classification mutation in the work panel |

Until these are implemented, the screen must be described as an initial read-only/readiness slice, not as the finished 자료대조원장.

## 0.3 Candidate Count Rule

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
- Show previous-period confirmed pattern recommendations for repeated counterparties,
  descriptions, amount ranges, evidence types, accounts, and exclusion decisions.
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
- Auto-confirming accounts, evidence links, or exclusions solely because a prior
  period pattern matched.
- Tax/legal judgment beyond presenting data and requiring user confirmation.

## 2. Slice Plan

| Slice | Goal | DB change | User-visible result |
|:---|:---|:---:|:---|
| 2a | Reconciliation read model and candidate display | No | Rows show source, linked evidence candidates, previous-period pattern suggestions, match state, and blockers |
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

type ReconciliationPatternSuggestion = {
  suggestedAccount: string | null
  suggestedEvidenceSource: ReconciliationSource | null
  suggestedExclusionReason: ReconciliationExclusionReason | null
  confidence: 'high' | 'medium' | 'low'
  basisLabel: string
  matchedCount: number
  lastSeenPeriod: string | null
  reason:
    | 'same_counterparty_prior_account'
    | 'same_counterparty_prior_evidence'
    | 'same_memo_amount_pattern'
    | 'prior_exclusion_pattern'
    | 'recurring_internal_transfer'
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
  patternSuggestion: ReconciliationPatternSuggestion | null
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

## 5.1 Previous-Period Pattern Learning Rules

자료대조원장은 사용자가 전월 또는 최근 기간에 확정한 거래 처리 패턴을 다음 기간의 추천 근거로 사용할 수 있다. 이 기능의 목적은 반복 거래의 추론 확률을 높이는 것이며, 사용자의 최종 확인을 대체하지 않는다.

Pattern inputs are limited to the same tenant and business entity. Suggested signals may include normalized counterparty, memo/description tokens, source type, direction, amount band, evidence type, final account, exclusion reason, and staff memo keywords. Cross-tenant or cross-company learning is not allowed.

Confirmed pattern inputs are defined narrowly:

- Account pattern: `status='confirmed'` with a non-null `finalAccount`.
- Exclusion pattern: `status='excluded'` with an exclusion reason or staff memo that explains why it was excluded.
- Evidence pattern: a user-confirmed evidence connection. Before Slice 2c persists durable links, this can only be derived from existing confirmed evidence metadata and must be labeled as a recommendation, not a confirmed link.

Pattern recommendations supplement, but do not replace, the current AI/rules account recommendation. `recommendedAccount` reflects the current-row AI/rules suggestion; `patternSuggestion` reflects historical user-confirmed behavior. If they disagree, the UI must show the disagreement and ask the user to choose. Neither source may silently confirm the row.

The UI must show the basis, for example:

- "지난달 같은 거래처 3건을 여비교통비로 확정"
- "최근 3개월간 이 거래처는 현금영수증과 연결"
- "지난달 같은 장소를 업무무관으로 제외"
- "반복 내부이체 패턴으로 보임"

A pattern recommendation can raise confidence, preselect a likely account, suggest an evidence source, or flag likely exclusion review. It must not automatically confirm the row, create a durable evidence link, or exclude the row without user action. If the user changes the suggestion, the changed decision becomes the newer learning signal for future periods.

## 5.2 AI Escalation and Non-Blocking Runtime Rules

자료대조원장의 AI 판단은 단계형으로 실행한다. 목적은 정확도를 높이는 것이며, 화면을 멈추거나 사용자가 확정 작업을 못 하게 만드는 것이 아니다.

| Stage | When to use | Required behavior |
|:---|:---|:---|
| Deterministic rules | Exact or near-exact amount, date, source type, and counterparty match | No LLM call required; show the concrete matching basis |
| Prior confirmed patterns | Same tenant/business entity has repeated confirmed account, evidence, exclusion, or internal-transfer behavior | Show `patternSuggestion` with basis; user must accept/change/reject |
| Single-provider AI | Counterparty, memo, account, evidence, or private-use judgment is ambiguous but not high risk | Return a recommendation with confidence and reason; never auto-confirm |
| Multi-provider consensus | The row is high amount, filing-impacting, repeatedly ambiguous, suspected private/business-unrelated, or AI and prior pattern disagree | Run primary providers in parallel where available, use a tie-breaker only on disagreement, and expose the final reason |
| Manual review fallback | Provider timeout, quota, parse failure, low consensus, or unavailable provider | Mark the row as needs review and keep manual account/evidence/exclusion actions available |

Runtime safety rules:

- The ledger page must not wait indefinitely for LLM results. Initial render must be possible with deterministic rules, existing recommendations, cached/stored AI results, or a `needs_review` fallback.
- LLM calls must have bounded timeouts. If a provider times out, errors, returns invalid JSON, or is quota-limited, the row falls back to the next available stage or manual review.
- A failed LLM call must never crash the page, block row selection, or hide existing source data. The UI may show "AI 판단 보류" or "수동 확인 필요" with the failure-safe reason.
- Do not run all three providers for every row on every page load. Multi-provider consensus is reserved for ambiguous or high-risk rows and should run on upload analysis, explicit user action, background job, or cached/stored result reuse.
- Provider outputs are recommendations only. They may populate candidates, `recommendedAccount`, `patternSuggestion`, private-use flags, or explanation text, but user confirmation is required before any account, evidence link, exclusion, or Path 1 readiness state is finalized.

## 6. User Actions

| Action | Description | Preferred implementation |
|:---|:---|:---|
| Confirm account | User accepts or changes `finalAccount` | Existing account classification row PATCH |
| Apply pattern suggestion | User accepts, changes, or rejects a prior-period recommendation | Reuse account/evidence/exclusion actions; no auto-confirm |
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
5. Previous-period pattern chip or panel row: show the historical basis such as last month/recent months, matched count, prior account/evidence/exclusion decision, and confidence.
6. Right work panel for the selected row. It handles match candidates, evidence search, account confirmation, explanation, and exclusion while keeping the ledger table visible. On narrow screens this may collapse into a drawer.
7. Evidence finder inside the work panel opened from "증빙 찾기": source selector (세금계산서/현금영수증/체크카드), search/date filters, evidence table, add/select action, selected total, remaining difference, save/cancel.
8. Tax-file readiness panel.

The table may initially be read-only in Slice 2a, but the labels must be honest:
inactive search or settings controls must look disabled until implemented.

## 9. Acceptance Criteria

- The user can see which bank movements match or fail to match tax invoices,
  card approvals, cash receipts, or receipts.
- The user can see why a match candidate was suggested.
- The user can see previous-period pattern recommendations with their basis, and those recommendations do not auto-confirm rows.
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
- AI/LLM recommendation failures, timeouts, quota errors, or provider disagreement do not block page rendering or user review; the row falls back to a visible manual-review state.

## 10. Implementation Preconditions

- [x] Path 1 product path excludes Hometax direct entry.
- [x] 자료대조원장 location approved under 기장검토.
- [x] HTML Preview approved:
  [12_reconciliation_ledger.html](../02_UI_Screens/previews/12_reconciliation_ledger.html).
- [x] Existing classification and attribution schemas inspected.
- [x] AI escalation and non-blocking runtime rules documented for 자료대조원장.
- [ ] Slice 2a read model reviewed before code.
- [ ] Slice 2b mutation mapping reviewed before code.
- [ ] Slice 2c durable match-link schema approved if needed.

## 11. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - company self-use filing assistance boundary.
- **UI_Screens**: [Screen Flow 4c](../02_UI_Screens/00_SCREEN_FLOW.md) - 자료대조원장 position and flow; [UI Design 4.3a](../02_UI_Screens/01_UI_DESIGN.md) - approved component contract; [Reconciliation Ledger Prototype Review](../02_UI_Screens/12_RECONCILIATION_LEDGER_PROTOTYPE_REVIEW.md) - user approval record.
- **Technical_Specs**: [Bookkeeping Review Pre-Code Brief](./06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md) - existing classification queue contract; [Path 1 End-to-End Filing Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md) - product path and gaps; [DB Schema](./03_DB_SCHEMA.md) - existing bookkeeping tables.
- **Logic_Progress**: [Backlog JC-010](../04_Logic_Progress/00_BACKLOG.md) - Context Lock and implementation tracking.
- **QA_Validation**: [Bookkeeping Review Test Scenarios](../05_QA_Validation/04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md) - existing JC-010 QA baseline; Phase 2 scenarios to add before Slice 2b implementation.
