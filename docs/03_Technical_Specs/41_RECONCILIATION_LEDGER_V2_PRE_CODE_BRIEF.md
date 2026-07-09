# Reconciliation Ledger Phase 2 Pre-Code Technical Brief
> Created: 2026-07-08 02:01 KST
> Last Updated: 2026-07-09 21:05 KST

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



## 0.1 Adopted UI Direction: Ledger Table + Cell Actions + Modals

The adopted UI direction is **not** a passive candidate-count dashboard. It is a workbench where the user finishes each transaction row.

The main layout is:

- Main surface: a dense ledger table with bank, card, tax-invoice, cash-receipt, receipt, and other rows.
- Work entry points: the table cells themselves. The evidence-status cell, account cell, and one-line conclusion column expose the next action without forcing the user to leave the row.
- Detail surfaces: read-only or action modals opened from the row cell. Desktop and mobile both use the same row-first interaction; narrow screens may use full-screen dialogs where needed.

The earlier side-panel idea from planning is no longer the default Phase 2 UX. It is replaced by row-level cell actions plus focused modals so the ledger stays dense and the user can work directly where the issue appears.

The row-level interaction must include:

1. Evidence-status cell: `증빙있음` means a concrete evidence row was found. The chip is a status label; the action is **증빙 확인**. Opening **증빙 확인** must show one compact **찾은 증빙** line above the 세금계산서/현금영수증/체크카드 source choices. Clicking that one line opens the matching source list with the found evidence row visibly highlighted. `증빙 찾기` is used only when the user must search manually; `소명 입력` opens an explanation modal.
2. Account cell: searchable account selector with recommended/pattern basis shown inline.
3. One-line conclusion column: recommended account/evidence/exclusion decision and its basis, visible before any modal is opened.
4. Evidence finder/review modal: source selector for 세금계산서, 현금영수증, 체크카드/카드, plus search/date/amount controls, concrete evidence rows, selected total, remaining difference, and save controls by slice. In review mode, the found evidence is shown as a single line above the source selector; selecting it opens the relevant source list and highlights that row.
5. Explanation/exclusion modal: business-use memo, personal/private, business-unrelated, duplicate, wrong-period, internal-transfer, or other exclusion reasons.
6. Save state: confirmed only when evidence, account, counterparty, explanation/exclusion, and period relevance are resolved as needed.

Terminology note: the UI may label the evidence source as **체크카드/카드** for user clarity, but implementation reuses the existing `card` source type. No separate `check_card` DB enum or source type is introduced in this slice.

## 0.2 Required Functions Not Yet Present in the Current Screen

The current implementation is only the first read-only step. The following functions are required for 자료대조원장 to become the real Path 1 workbench, but they are not all present yet. Future work must treat them as product requirements, not optional polish.

| Required function | Meaning | Current status | Implementation direction |
|:---|:---|:---|:---|
| Bank deposit/withdrawal ↔ tax invoice matching | Match bank movements with issued/received tax invoices by amount, date, and counterparty | Missing/partial | Auto-suggest concrete matches; allow user confirm/unlink/manual search |
| Bank movement ↔ evidence connection | Connect bank deposits/withdrawals to tax invoices, cash receipts, or card rows when those rows explain the bank movement | Missing/partial | Evidence finder source tabs and row-level connect actions. Card rows are evidence candidates for bank movements, not evidence-search starting points by default; card rows focus on account, explanation, and exclusion. |
| Period scope selector | Let the user review the ledger by filing-relevant period unit: month, quarter, half-year, year, or custom range | Missing/partial | Default from the current filing context, but allow user switch without changing filing data |
| Evidence action status taxonomy | Replace final-looking "증빙없음" labels with action states such as 증빙 필요, 소명 필요, 소명 완료, 증빙 예외, 제외됨 | Missing/partial | Treat missing evidence as a blocker cause, not a completed row state |
| Evidence finder | From a bank row, choose 세금계산서/현금영수증/체크카드 and select evidence rows | Missing | Evidence-status cell opens source selector and evidence browse modal with search, date/amount filters, add/select, remaining difference. Card rows themselves focus on account/explanation/exclusion and must not require another evidence-search step by default. |
| Explanation memo | Let user explain unclear business use for a transaction | Missing | Row-level modal/panel field saved as memo in v1 |
| Bank usage-description memo | Let user write what a bank movement was for when evidence is weak or context is unclear | Missing | Same row-level explanation modal; make it visible in audit/readiness |
| Previous-period pattern recommendation | Learn from prior confirmed rows such as same counterparty, memo, amount range, evidence type, account, or exclusion decision | Missing | Show the prior-period basis and let the user accept, change, or reject; never auto-confirm |
| AI account recommendation | AI/rules first assign likely account category | Partial/existing source | Show recommended account and confidence; do not hide uncertainty |
| User account selection | If AI cannot decide or confidence is low, user chooses account | Partial/existing source | Highlight uncertain rows and expose searchable account selector in this screen |
| Private/business-unrelated detection | Flag likely personal or low-business-use payments, e.g. cinema, beauty salon, PC room, leisure-like spending | Missing | Heuristic/AI review flag; user must confirm business use or exclude |
| Exclusion reason selection | Exclude personal/private, business-unrelated, duplicate, wrong-period, internal transfer, etc. | Missing/partial memo only | Required reason taxonomy plus memo before row can be considered resolved |
| Inline account edit | Change account category directly from 자료대조원장 | Partial/existing route elsewhere | Reuse account classification mutation from the account cell |

Until these are implemented, the screen must be described as an initial read-only/readiness slice, not as the finished 자료대조원장.

## 0.3 Candidate Count Rule

Candidate counts are internal matching details, not user-facing status. The row cell or modal must expose the actual evidence rows and actions: concrete evidence exists, or the user must find evidence manually.

- Clear match: show **증빙있음** plus **증빙 확인**. The first row inside the **증빙 확인** dropdown is a single **찾은 증빙** line, for example `세금계산서 · 거래처 · 금액 · 일자`. Clicking that line opens the relevant source list and highlights the found row. Unlink/replace actions remain separate 2b-2 follow-ups unless explicitly implemented.
- Ambiguous match: do not show it as `증빙있음`. Show concrete possible evidence rows under **증빙 찾기** and actions such as "이 증빙 연결", "아님", and "직접 찾기".
- No match: show "증빙 찾기" as the primary action.

Path 1 file generation must read the resolved completion state, not an internal candidate count.

## 0.4 Convenience Contract

자료대조원장은 모든 정보를 한꺼번에 보여주는 화면이 아니라, 사용자가 Path 1 파일 생성을 막는 문제부터 빠르게 해소하도록 돕는 작업대다. The interface should reduce decision load, not add more modes or tabs for the same information.

Phase 2 convenience features are limited to these contracts:

| Convenience contract | Purpose | Boundary |
|:---|:---|:---|
| Next-action queue | Show the most important unresolved items first, ordered by filing blocker, amount, and due-date impact | This is a queue over existing blockers, not a new workflow engine |
| Batch suggestion acceptance | Let the user confirm a safe group of repeated suggestions once | Not automatic confirmation; group must show eligibility and require explicit user acceptance |
| One-line row conclusion | Put the recommended account/evidence/exclusion decision and its basis directly in the ledger row | Details stay available in modals; do not hide uncertainty |
| Source-collection back link | If the issue requires missing source data, link directly to 자료수집 with period and source type context | Do not pretend the reconciliation screen can solve missing uploads |
| Tax-type blocker reasons | Show which Path 1 file is blocked and why, such as VAT evidence, account, or exclusion blockers | Same readiness data, clearer reason display |
| Closing checklist | Show whether evidence, explanation, account, exclusion reason, and tax blockers are at zero | Checklist is a completion view over the same gate, not a separate approval layer |
| Shallow undo | Let the user undo the most recent apply/confirm action from the current session | Full audit-log UI is deferred; backend audit remains separate |

Batch suggestion groups are only allowed when all grouped rows share the same `patternSuggestion.reason`, suggested account, suggested evidence source or exclusion reason, and a visible basis such as same counterparty, prior confirmed count, and amount/date range. If the group contains mixed reasons, it must not be offered as one-click acceptance.

Explicitly deferred from Phase 2 convenience scope:

- Full split/merge transaction editor. Only amount-difference resolution may be introduced before a separate durable-link brief.
- Long-form AI explanation drafts. Phase 2 may show a short hint, but the user writes or confirms the memo.
- Separate saved-rule engine. Prior-period pattern learning remains the single repeated-behavior mechanism.
- Separate fast-mode/full-mode product modes. Default view may prioritize blocking items, with an "전체 보기" toggle.
- Full audit log UI. Use shallow undo and compact recent-change hints only.

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
| 2a-lite | Display contract + fixture-first UI validation | No | The workbench layout can be reviewed from a stable display model before full read wiring |
| 2a | Reconciliation read model and evidence-action display | No | Rows show source, concrete evidence rows when found, previous-period pattern suggestions, match state, blockers, next-action queue, tax blocker reasons, and closing checklist |
| 2b | Account/exclusion/explanation actions | No preferred | Existing classification and attribution APIs are reused where possible; row cells/modals support one-line conclusion, source-collection back links, batch suggestion acceptance, and shallow undo |
| 2c | Persisted reconciliation links, only if required | Additive only | User-confirmed bank-to-evidence links survive reloads and audits; split/merge editor remains a separate brief if needed |

Slice 2a-lite must not pretend to save or confirm anything. It exists only to
lock the display model, fixture scenarios, and workbench UX before the full read
model is wired. Slice 2a must not invent a new table. If Slice 2b discovers that
confirmed matches need a durable pair/link model, Slice 2c must get a separate
migration brief before code starts.

### 2.1 Implementation Order and Traceability

Approved ideas from the Prototype Review, §0.2 gap table, §8 UI contract, and
§9 acceptance criteria must be implemented in the order below. Each step must
land in its own PR-sized change set. Do not skip a step because a later step
already looks partially present in the 1st slice.

Traceability legend:

- **P** = [Reconciliation Ledger Prototype Review](../02_UI_Screens/12_RECONCILIATION_LEDGER_PROTOTYPE_REVIEW.md)
- **G** = §0.2 Required Functions gap row
- **U** = §8 UI Contract item number
- **A** = §9 Acceptance Criteria or [Backlog JC-010 AC](../04_Logic_Progress/00_BACKLOG.md)

| Step | Slice | Goal | Covers | Done when |
|:---|:---|:---|:---|:---|
| 2a-0 | 2a-lite | Display contract + fixture | §0.4, §4 display types, Preview 12, P: workbench review | `ReconciliationLedgerDisplayModel` is Zod-validated with fixture data based on Preview 12, including row-level `rowConclusion`; UI consumes this model only; no DB/API mutation and no hidden save behavior |
| 2a-2 | 2a-lite | UI shell and honest labels | U:1-4; P: hero, source summary, ledger table columns; §0.4 next-action queue, tax blocker reasons, closing checklist | Readiness hero, source summary, next-action queue, period scope control, action tabs, table chips, tax blocker reasons, and closing checklist render from the display model; inactive controls stay disabled until their step lands |
| 2a-3 | 2a-lite | Table-cell evidence/account actions (display only) | U:6-7; §0.1; §0.3; P: evidence status cell, account popover, one-line conclusion column; §0.4 one-line panel conclusion | Fixture table uses full-width columns (거래일, 출처, 거래처, 적요, 금액, 증빙 상태, 계정항목, 한 줄 결론). **증빙 상태** cell shows **증빙있음** status with **증빙 확인** action for concrete evidence, **증빙 찾기** dropdown only when manual search is needed (세금계산서/현금영수증/체크카드 → browse modal), or **소명 입력** button. Account cell opens grouped search popover with AI recommendation hint. Save/connect/confirm controls stay disabled until 2b. |
| 2a-4 | 2a-lite | Evidence finder browse + AI display shell | G: evidence finder, AI account recommendation, private/business-unrelated detection; §5.3; A: AI non-blocking, 증빙 확인/찾기 flow; §0.4 source-collection back link | Finder opens from the evidence-status cell in read/browse mode with source selector and filters from fixture/display data; AI/heuristic recommendation areas show reasons or manual-review fallback; missing-source problems show a 자료수집 backlink; save/connect buttons remain disabled until 2b-2 |
| 2a-5 | 2a | Full read model wiring | G: bank↔evidence matching (세금계산서/현금영수증/카드 as evidence rows), period scope, evidence action status; §5.1; A: period switch, action-state labels, matching candidates | Existing bookkeeping/source summaries populate the same `ReconciliationLedgerDisplayModel`; fixture can be swapped for real data without changing UI props; rows derive action states instead of showing final-looking "증빙없음"; query contract uses `evidence_required` and `explanation_required` instead of legacy `missing_evidence` tab only |
| 2b-1 | 2b | Account, explanation, exclusion mutations | G: explanation memo, bank usage-description memo, exclusion reason, inline account edit, user account selection; P: memo, exclusion, inline account; §0.4 shallow undo | User confirms/changes account from the account cell, saves explanation memo, and excludes with required reason from row-level modals via existing classification APIs; no redirect to the classification queue for the primary flow; the latest apply/confirm action can be cancelled from the current session |
| 2b-2a | 2b | Evidence connect save | G: bank-to-evidence confirmation (세금계산서/현금영수증/카드); P: connect evidence | User can select one concrete evidence row from the evidence modal and persist the bank-to-evidence link; reload shows the row as `증빙있음` from the stored link. Completed by PR #173 (`linked_evidence_row_id`, migration 0066). |
| 2b-2b | 2b | Connected evidence review and source-list highlight | G: evidence finder; P: review concrete evidence rows; U: evidence-status cell | For a row with `증빙있음`, `증빙 확인` shows one **찾은 증빙** line above the source selector. Clicking that line opens the matching source list and visibly highlights the connected/found row with a distinct background/border/selected marker, so the user can verify which tax invoice, cash receipt, or card row is connected. |
| 2b-2c-1 | 2b | Evidence unlink/replace | G: evidence finder; P: unlink/replace | User can unlink a saved `manual_reference` evidence row from the highlighted source-list row. Selecting another concrete evidence row replaces the existing link through the same connect mutation. The latest unlink/replace action can be undone from the current-session toast. |
| 2b-2c-2 | 2b | Evidence exception | G: evidence exception; P: confirm evidence exception | User can mark a bank row as a normal-evidence exception such as internal transfer, loan, tax payment, refund/cancellation, or similar. v1 stores this as `staffMemo` with the `증빙 예외: ...` prefix and clears `linkedEvidenceRowId`, so exception and connected evidence cannot coexist on the same row. Editing/removing a saved exception after the current-session undo window is a follow-up, not part of this slice. |
| 2b-2c-3 | 2b | Amount mismatch handling | G: amount mismatch; P: resolve amount mismatch | If counterparty/date look related but the amount differs, the row stays **증빙 필요** and must not become **증빙있음**. The evidence finder may show the related row with a **금액 차이** marker and remaining-difference guidance, but direct connect/save is blocked until the user resolves the difference. Full partial-payment/many-to-one split/merge saving remains a follow-up unless separately briefed. |
| 2b-3 | 2b | Pattern apply/reject | §5.2; A: pattern recommendation AC; §0.4 batch suggestion acceptance | User can accept, change, or reject `patternSuggestion`; safe repeated suggestion groups can be batch-accepted only when eligibility is visible and the user explicitly confirms; rejected/changed decisions become the newer learning signal |
| 2c | 2c | Durable confirmed links | Slice 2c trigger only | Start only if 2b proves user-confirmed bank↔evidence pairs must survive reload/audit beyond existing classification metadata |
| 2d | downstream | Path 1 gate consumption | A: filing-preparation blocker counts; Backlog AC: confirmed ledger only | Filing-preparation and tax-type read models consume resolved ledger/blocker state from 자료대조원장 instead of treating raw classification rows as ready |

Cross-cutting requirements:

- Before **2a-0**, define the display fixture scenario from Preview 12. The fixture must include at least one bank-to-tax-invoice candidate, one card/explanation-needed row, one private-use/exclusion candidate, one safe batch suggestion group, one tax blocker summary, and one source-collection back link.
- Before **2a-2**, update [Component Plan §7.3a](./02_COMPONENT_LIBRARY_PLAN.md) for `Period Scope Control`, `Evidence Action Status`, `ReconciliationNextActionQueue`, `ReconciliationRowConclusion`, `ReconciliationBatchSuggestionBar`, `ReconciliationTaxBlockerReasons`, `ReconciliationClosingChecklist`, and source back-link/recent-undo controls.
- Before **2b-1**, extend [Bookkeeping Review Test Scenarios](../05_QA_Validation/04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md) with 자료대조원장 Phase 2 cases for action states, pattern display, AI fallback, and row-level mutations.
- **Evidence finder boundary:** browse/search/preview belongs to 2a-4; connect/unlink/save belongs to 2b-2.
- **Mobile/narrow layout (P):** row-level modals may expand to full-screen dialogs, but the same step order and actions apply.


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

type ReconciliationPeriodMode = 'month' | 'quarter' | 'half_year' | 'year' | 'custom'

type ReconciliationMatchState =
  | 'matched'
  | 'candidate'
  | 'ambiguous'
  | 'missing_evidence'
  | 'duplicate_candidate'
  | 'excluded'
  | 'confirmed'

type ReconciliationEvidenceActionState =
  | 'linked'
  | 'candidate'
  | 'evidence_required'
  | 'explanation_required'
  | 'explained_no_evidence'
  | 'evidence_exception'
  | 'excluded'

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

type ReconciliationNextAction = {
  id: string
  label: string
  reason: string
  priority: 'filing_blocker' | 'high_amount' | 'due_date' | 'manual_review'
  targetRowId: string | null
  targetRoute: string
}

type ReconciliationTaxBlockerSummary = {
  taxTrack: 'vat' | 'business_status' | 'withholding' | 'local_income' | 'payment_statement'
  label: string
  blockerCount: number
  topReasons: Array<{ code: ReconciliationBlockerCode; label: string; count: number }>
  canGeneratePath1File: boolean
}

type ReconciliationBatchSuggestionGroup = {
  id: string
  rowIds: string[]
  suggestedAction: 'apply_account' | 'connect_evidence' | 'exclude' | 'mark_exception'
  basisLabel: string
  eligibility: 'safe_to_offer' | 'mixed_reasons_blocked'
  requiresUserConfirmation: true
}

type ReconciliationClosingChecklist = {
  evidenceRequiredCount: number
  explanationRequiredCount: number
  accountUnconfirmedCount: number
  exclusionReasonRequiredCount: number
  taxBlockerCount: number
  isReadyForPath1: boolean
}

type ReconciliationRowConclusion = {
  headline: string
  basisLabel: string
  primaryAction:
    | 'connect_evidence'
    | 'confirm_account'
    | 'write_explanation'
    | 'exclude'
    | 'mark_exception'
    | 'open_source_collection'
    | 'review_only'
  actionEnabled: boolean
  disabledReason: string | null
}

type ReconciliationLedgerDisplayModel = {
  rows: ReconciliationLedgerRow[]
  nextActions: ReconciliationNextAction[]
  taxBlockerSummaries: ReconciliationTaxBlockerSummary[]
  closingChecklist: ReconciliationClosingChecklist
  batchSuggestionGroups: ReconciliationBatchSuggestionGroup[]
}

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
  periodMode: ReconciliationPeriodMode
  periodLabel: string
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
  evidenceActionState: ReconciliationEvidenceActionState
  candidates: ReconciliationMatchCandidate[]
  patternSuggestion: ReconciliationPatternSuggestion | null
  rowConclusion: ReconciliationRowConclusion
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

## 5.1 Period Scope and Evidence Action State Rules

자료대조원장은 신고 기간의 성격에 맞는 기간 단위를 가져야 한다. The UI must support these period modes:

- `month`: 원천세 and ordinary monthly bookkeeping checks.
- `quarter`: VAT-style quarterly review where needed.
- `half_year`: 간이지급명세서 and 반기납부/반기 신고 contexts.
- `year`: 사업장현황신고, 종합소득세, and annual review contexts.
- `custom`: user-selected date range for investigation, correction, or unusual filing periods.

The default period comes from the current filing context when the user enters from a tax track. Examples: 원천세 opens the relevant month, 부가세 opens the active VAT period such as 2026년 1기, 간이지급명세서 opens the half-year, and 사업장현황신고 opens the fiscal year. Entering from 기장검토 without a tax context may default to the current bookkeeping month.

"증빙없음" must not be rendered as if it were a final accepted state. It is an underlying cause or blocker. User-facing labels must be action/resolution oriented:

| User-facing state | Meaning | Expected user action |
|:---|:---|:---|
| 증빙있음 | A concrete tax invoice, cash receipt, card approval, or other proof row exists | Open **증빙 확인**; the dropdown first shows one **찾은 증빙** line, and clicking it opens the source list with that row highlighted. Connect/replace/unlink remain later slices |
| 증빙 필요 | Evidence is normally required but not linked | Open evidence finder |
| 소명 필요 | Evidence may not exist or is weak, but business purpose must be explained | Enter explanation memo |
| 소명 완료 | User explained why the row can remain without normal evidence | Reviewable, auditable state |
| 증빙 예외 처리 | Internal transfer, loan, tax payment, refund/cancellation, or similar row where normal evidence matching is not the right test | Confirm exception type and memo |
| 제외됨 | Personal/private, business-unrelated, duplicate, wrong-period, or reference-only row | Must have reason and memo |

Internal `missing_evidence` remains a blocker code/match state, but UI copy should say what the user must do: 증빙을 찾으세요, 소명을 입력하세요, 제외 사유를 선택하세요, 내부이체로 확인하세요, or 계정항목을 확정하세요.

## 5.2 Previous-Period Pattern Learning Rules

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

## 5.3 AI Escalation and Non-Blocking Runtime Rules

자료대조원장의 AI 판단은 단계형으로 실행한다. 목적은 정확도를 높이는 것이며, 화면을 멈추거나 사용자가 확정 작업을 못 하게 만드는 것이 아니다.

| Stage | When to use | Required behavior |
|:---|:---|:---|
| Deterministic rules | Exact or near-exact amount, date, source type, and counterparty match | No LLM call required; show the concrete matching basis |
| Prior confirmed patterns | Same tenant/business entity has repeated confirmed account, evidence, exclusion, or internal-transfer behavior | Show `patternSuggestion` with basis; user must accept/change/reject |
| Single-provider AI | Counterparty, memo, account, evidence, or private-use judgment is ambiguous but not high risk | Return a recommendation with confidence and reason; never auto-confirm |
| Multi-provider consensus | The row is high amount, filing-impacting, repeatedly ambiguous, suspected private/business-unrelated, or AI and prior pattern disagree | Run primary providers in parallel where available, use a tie-breaker only on disagreement, and expose the final reason |
| Manual review fallback | Provider timeout, quota, parse failure, low consensus, or unavailable provider | Mark the row as needs review and keep manual account/evidence/exclusion actions available |

Terminology note: `needs_review` in this section is a UI-facing/manual-review concept. Implementations must map it to an existing status such as `needs_decision` where applicable and must not introduce a new DB status enum without a separate schema brief.

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
| Open evidence finder | User chooses 세금계산서 / 현금영수증 / 체크카드 and searches evidence rows | Evidence-status cell opens row-level modal or narrow-screen dialog |
| Add evidence link | User selects one or more evidence rows and balances the transaction amount | Slice 2a read-only; Slice 2c persisted link if required |
| Confirm match | User confirms bank-to-evidence candidate | Slice 2a read-only; Slice 2c persisted link if required |
| Mark no evidence required | User says the row is allowed without matching evidence | v1 can store memo; durable enum requires Slice 2c |
| Hold for later | User keeps row out of current filing period | Existing material attribution decision where applicable |

The explanation interaction should be modal-like: the user opens one row from
the evidence-status cell, sees source details and candidate evidence, writes a
short memo, chooses account or exclusion reason where required, and saves.

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
3. Period scope control: month, quarter, half-year, year, and custom range. The default must follow the filing context, but the user can switch scope for review.
4. Next-action queue: unresolved items ordered by filing blocker, amount, and due-date impact. The queue should let the user start work without hunting through tabs.
5. Source/action tabs: all, bank, card, tax invoice, cash receipt, evidence needed, explanation needed, exclusion review. Tabs are secondary to the queue.
6. Unified ledger table. The evidence-status column must show either **증빙있음** with **증빙 확인** (concrete evidence was found or linked, clickable to view/review), **증빙 찾기** (the user must search manually), **소명 입력** (explanation required), or a resolution chip such as "증빙 필요", "소명 완료", "증빙 예외", or "제외됨". It must not stop at candidate-count labels or render "증빙없음" as a completed state.
7. Previous-period pattern chip or row subtext: show the historical basis such as last month/recent months, matched count, prior account/evidence/exclusion decision, and confidence.
8. One-line conclusion column: each row must show the recommended account/evidence/exclusion decision, basis, and primary action before a modal is opened.
9. Evidence finder opened from the evidence-status cell's "증빙 확인" or "증빙 찾기": source selector (세금계산서/현금영수증/체크카드), search/date filters, evidence table, add/select action, selected total, remaining difference, save/cancel.
10. Tax-type blocker reason panel: show which Path 1 files are blocked and the top reasons.
11. Closing checklist: show zero/remaining state for evidence, explanation, account, exclusion reason, and tax blockers.
12. Source-collection back link and shallow undo affordance where applicable.

The table may initially be read-only in Slice 2a, but the labels must be honest:
inactive search or settings controls must look disabled until implemented.

## 9. Acceptance Criteria

- The user can see which bank movements match or fail to match tax invoices,
  card approvals, cash receipts, or receipts.
- The user can see why AI/rules suggested a concrete evidence row.
- The user can start from a next-action queue that prioritizes Path 1 blockers before lower-impact rows.
- The user can switch review scope between month, quarter, half-year, year, and custom range, with sensible defaults from the current filing context.
- The user can see previous-period pattern recommendations with their basis, and those recommendations do not auto-confirm rows.
- From a row with concrete evidence, the user sees **증빙있음** and can open **증빙 확인**. The dropdown first shows one **찾은 증빙** line; clicking it opens the relevant source list with that row highlighted.
- From a bank row, the user can open "증빙 확인" for found evidence or "증빙 찾기", choose 세금계산서/현금영수증/체크카드, search rows, select evidence, and see the remaining difference before saving.
- The ledger row shows a one-line conclusion and primary action before the user opens detailed evidence/AI/pattern rationale in a modal.
- Safe repeated suggestions can be accepted as a batch only when the group eligibility is visible and the user explicitly confirms the group.
- The final UI does not use candidate counts as the main answer; it shows concrete evidence rows and actions.
- Ambiguous matches are not auto-confirmed.
- The user can confirm or change the account category for filing-relevant rows.
- The user can open a row-level explanation modal and save a memo.
- The user can exclude a row only with an explicit reason and memo.
- Excluded or held rows are visible and auditable.
- The final UI does not present "증빙없음" as a finished state; it shows action states such as 증빙 필요, 소명 필요, 소명 완료, 증빙 예외, or 제외됨.
- Missing-source problems link back to 자료수집 with period/source context instead of becoming dead ends.
- The user can see tax-type blocker reasons and a closing checklist that reaches zero before Path 1 file generation is enabled.
- The user can undo the most recent apply/confirm action from the current session without opening a full audit-log UI.
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
- [x] Period scope and evidence action-state terminology documented for 자료대조원장.
- [x] Convenience contract documented for next-action queue, batch acceptance, one-line panel conclusion, source-collection back link, tax blocker reasons, closing checklist, and shallow undo.
- [x] Phase 2 implementation order and traceability documented (§2.1).
- [x] UI-first lite sequence documented: display contract + fixture before full read model wiring (§2.1 step 2a-0).
- [x] Slice 2a-0 display contract + fixture implementation started (§2.1 step 2a-0) — landed on main (`01971b1`).
- [x] Slice 2a-2 UI shell and honest labels implemented (§2.1 step 2a-2) — landed on main (`169ade8`).
- [x] Slice 2a-3 table-cell evidence/account actions implemented (§2.1 step 2a-3) — PR #150, merged to main (`7b0ba25`). Product wording update (PR #153): `candidate` remains an internal match state only. If concrete evidence rows were found, the user-facing status is **증빙있음** and the action is **증빙 확인**. If no evidence was found, the user-facing action is **증빙 찾기** or **증빙 필요**. Do not add AI-style evidence states or candidate-count labels.
- [x] Slice 2a-4 evidence finder browse + AI display shell implemented (§2.1 step 2a-4) — PR #160, merged to main (`9277a4c`). Search/date filter connected in the evidence picker modal; AI-matched candidates show an **AI 추천** badge with `matchCandidateReasonLabel` basis inside the currently browsed source list only; save/connect stays disabled until 2b-2.
- [x] Slice 2a-5 full read model wiring implemented (§2.1 step 2a-5) — PR #161 (month period parsing), #162 (row transform, `evidenceActionState`/`rowConclusion` derivation), #163 (top-level aggregates: `nextActions`/`taxBlockerSummaries`/`closingChecklist`/`batchSuggestionGroups`), #164 (page wiring), merged to main (`ae2a94b`). Sidebar default is now live data — `isReconciliationDisplayFixtureMode` returns fixture only when `display=fixture` is explicitly requested. The old standalone `ReconciliationLedgerView` component was retired; both fixture and live modes render `ReconciliationLedgerDisplayFixtureView` with an `isFixtureMode` prop controlling the fixture-only branding text. Known gaps carried forward, not blocking this slice's completion:
  - `year` and `custom` period modes from §5.1 are still not implemented in `buildCompanyHomePeriod` — tracked as a separate follow-up task in the backlog.
  - `explanation_required`/`explained_no_evidence` and `evidence_exception` are derived from v1 heuristics or formatted `staffMemo` conventions, not dedicated DB columns. A future durable enum/column can replace the memo prefixes if audit needs grow.
  - `taxBlockerSummaries` only reports the `vat` track from live data; the other four tracks depend on data sources (payroll, filing-preparation) this screen does not read.
  - Non-blocking naming: `ReconciliationLedgerDisplayFixtureView`/`reconciliation-ledger-display-fixture-view.tsx` still carry "Fixture" in their names despite now rendering live data too. A rename is a mechanical follow-up, not required before Slice 2b.
- [x] Slice 2b-1 account/explanation/exclusion mutations implemented — PR #166~#169, merged to main.
- [x] Slice 2b-2a evidence connect save implemented — PR #173, merged to main (`4922096`). Prod DB migration 0066 was applied before merge: `linked_evidence_row_id` nullable text column, `bookkeeping_tx_linked_evidence_idx`, `foreign_key_check` 0.
- [x] Slice 2b-2b connected evidence review/detail highlight — PR #175, merged to main (`f708af1`). `증빙 확인` shows one **찾은 증빙** line first, and that line opens the source list with the connected/found row highlighted. Saved manual links show `연결됨`; AI/rule-found but unsaved rows show `찾은 증빙`, not `연결됨`.
- [x] Slice 2b-2c-1 evidence unlink/replace implemented — saved `manual_reference` links can be removed from the highlighted source-list row; selecting another evidence row replaces the existing link through the existing connect mutation. Exception and amount mismatch stay separate follow-ups.
- [x] Slice 2b-2c-2 evidence exception implemented — v1 saves `증빙 예외: ...` in `staffMemo`, clears any saved evidence link, and renders the row as `증빙 예외` without reopening the evidence finder. Saved exception edit/remove after the current-session undo toast is a follow-up.
- [x] Slice 2b-2c-3 amount mismatch display/save blocking implemented — PR #178, merged to main. If counterparty/date look related but amount differs, the row remains `증빙 필요`; the finder shows `금액 차이` and direct connect/save is blocked. Partial-payment/many-to-one split/merge saving remains a separately briefed follow-up.
- [x] Slice 2b-3a account pattern apply/reject implemented — live rows can derive `patternSuggestion.suggestedAccount` from prior confirmed rows with the same counterparty/direction, show the historical basis in the account popover, apply it through the existing account-confirm mutation, or reject it by storing a `패턴 거부: ...` memo. Evidence/exclusion pattern application and batch apply remain 2b-3 follow-ups.
- [x] Slice 2b-3b-1 evidence/exclusion pattern display + single-row confirmation entry points — live rows can derive prior evidence-source and exclusion-reason patterns from same-counterparty/direction history. Evidence patterns reorder/mark the evidence finder source; exclusion patterns prefill the exclusion modal. No auto-link or auto-exclude.
- [ ] Slice 2b-3b-2 safe batch acceptance — requires visible eligibility, explicit confirmation, and undo-safe mutation handling before enabling.
- [ ] Slice 2c durable match-link schema approved if needed.

## 11. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - company self-use filing assistance boundary.
- **UI_Screens**: [Screen Flow 4c](../02_UI_Screens/00_SCREEN_FLOW.md) - 자료대조원장 position and flow; [UI Design 4.3a](../02_UI_Screens/01_UI_DESIGN.md) - approved component contract; [Reconciliation Ledger Prototype Review](../02_UI_Screens/12_RECONCILIATION_LEDGER_PROTOTYPE_REVIEW.md) - user approval record.
- **Technical_Specs**: [Bookkeeping Review Pre-Code Brief](./06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md) - existing classification queue contract; [Path 1 End-to-End Filing Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md) - product path and gaps; [DB Schema](./03_DB_SCHEMA.md) - existing bookkeeping tables.
- **Logic_Progress**: [Backlog JC-010](../04_Logic_Progress/00_BACKLOG.md) - Context Lock and implementation tracking.
- **QA_Validation**: [Bookkeeping Review Test Scenarios](../05_QA_Validation/04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md) - existing JC-010 QA baseline; Phase 2 scenarios to add before Slice 2b implementation.
