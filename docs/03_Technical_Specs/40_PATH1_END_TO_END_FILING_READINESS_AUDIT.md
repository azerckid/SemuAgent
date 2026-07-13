# Path 1 End-to-End Filing Readiness Audit
> Created: 2026-07-07 23:29 KST
> Last Updated: 2026-07-14 KST

## 0. Purpose

This document checks whether the current product follows the user-approved
Path 1 workflow and states exactly what remains before beta.

```text
회사 자료 업로드
-> 정규화·귀속기간·중복 검토
-> 자료대조원장에서 증빙·소명·계정·제외 확정
-> 확정 데이터만 세목별 신고 준비 데이터로 집계
-> [Path 1a] 공식 비암호화 양식이 있으면: 채워질 값 확인 -> SemuAgent가 파일 생성 -> 사용자가 직접 업로드·제출
-> [Path 1b] 공식 양식이 없으면: 확정 값을 `항목 = 값`으로 화면 정리 -> 사용자가 홈택스에 직접 입력·제출
```

Path 1 has two branches. **Path 1a** fills an official non-encrypted
upload form so the user uploads a file. **Path 1b** organizes the confirmed
values as an on-screen `항목 = 값` summary so the user types them into Hometax
directly. Path 1b provides the exact menu, screen, legal row/field location and
value, but does not build a file generator (B~G), screenshot-by-screenshot click
tutorial or automatic navigation.
Encrypted electronic-file generation stays out of scope, and no tax type ends
as `blocked` — a tax type without an official form is **assigned to Path 1b**.
Path 1b is a decided routing outcome. As of 2026-07-14 the simplified-wage,
withholding and VAT 1b value-summary screens are **implemented**. Local income
is a Path 1a candidate waiting for its authenticated WETAX workbook. Annual wage
statement Stage A through Stage C are complete and assign the tax type to Path 1b.
Stage C sets SemuAgent payroll base data and Hometax final-statement ownership;
the next gate is a compact Stage D HTML Preview and owner approval.
Business-status reporting is a
conditional track for VAT-exempt sole proprietors, not the common next step.

## 1. Current Answer

The common data-preparation foundation is now complete through Reconciliation
Ledger Phase 2. No tax type has completed Path 1a official direct-acceptance;
tax types without a confirmed official form are **assigned to Path 1b**
(direct-entry value summary) rather than being blocked. Simplified-wage,
withholding and VAT 1b screens are implemented.

| Step | Current state | Evidence | Remaining gap |
|:---|:---|:---|:---|
| 자료수집 | Live | `lib/source-collection/summary.ts`, `/dashboard/direct-upload` | Missing source groups still block the applicable filing period as designed |
| 정규화·귀속기간·중복 | Live for v1 | `lib/bookkeeping/period-attribution-service.ts`, `lib/bookkeeping/attribution-gate.ts` | Deferred year/custom scope and complex split/merge are not required for current exact 1:1 v1 |
| 자료대조·확정 원장 | **Live; Phase 2 complete** | `/dashboard/bookkeeping/reconciliation-ledger`, Brief 41 §9 | Exact evidence connection, account, explanation, exclusion, exception, pattern and shared gate are implemented; deferred edges remain explicit non-goals |
| 신고 준비 공통 gate | **Live** | `loadReconciliationPath1Gate`, filing-preparation summary | VAT is the first consumer; payroll-only routes intentionally do not inherit unrelated bookkeeping blockers |
| 부가세 확정 원장 provenance | **Live** | `lib/vat/facts.ts`, `lib/vat/provenance.ts`, rebuild/package gates | Exact VAT facts are not manufactured for old/sample rows; unresolved rows remain correctly blocked |
| 세목별 신고 준비 데이터 | Live for core tracks | VAT, payroll/withholding, payment statements, local income, business status read models | A ready data screen is the Path 1b endpoint; Path 1a additionally needs an official upload file |
| 입력할 값 확인 | Live for simplified wage, withholding and VAT | `lib/efiling-simplified-wage`, `lib/efiling-withholding`, `lib/vat/hometax-input-summary.ts` | All three are Path 1b; VAT Path 1a form is a Stage A upgrade only |
| 홈택스 업로드용 파일 (Path 1a) | 완료 세목 없음 | official form and direct acceptance required | Historical simplified-wage candidate API is not exposed as an active product output |
| 홈택스 직접입력 정리 (Path 1b) | **Live for simplified wage, withholding and VAT** | 확정값 + 메뉴 경로·화면명·행/칸 위치 매핑 | Annual wage Stage C ownership contract is complete; Stage D Preview is next. Business status is conditional |
| 최종 제출 | User only | Product Baseline, Roadmap 36 | Auto-submit and credential storage remain excluded |

The useful status is therefore qualitative, not a single percentage:

- **Common confirmed-data foundation:** complete for the planned v1 exact-match flow.
- **Tax-type upload files (Path 1a):** no tax type has completed official
  non-encrypted direct-acceptance; VAT Path 1a is a
  Stage A upgrade.
- **Direct-entry summaries (Path 1b):** the routing decision is made for any tax
  type without a confirmed form (so no tax type ends as `blocked`). Simplified wage
  withholding and VAT value-summary screens are **implemented**.
- **Path 1 beta:** Path 1a beta is not complete until at least two tax types pass
  the full non-encrypted upload-file verification line;
  encrypted fallback is never used. Local income is a Path 1a candidate waiting
  for its official workbook. Annual-wage Stage C is complete: SemuAgent prepares
  employer payroll base data and Hometax owns the final settlement result. Its
  Path 1b coverage next needs the Stage D Preview. Business status stays conditional.
- **Planned Path 1a matrix:** not complete until the remaining ordered tax types
  each either pass the 1a completion line or are assigned to 1b with the 1b screen built.

## 2. Product Contract

Path 1 beta has two branches:

**Path 1a (official form exists):**

1. SemuAgent prepares the official upload artifact.
2. The user inspects the values before download.
3. The user downloads the file.
4. The user opens Hometax or Witax and uploads/submits directly.

**Path 1b (no official form):**

1. SemuAgent organizes the confirmed values as an on-screen `항목 = 값` summary.
2. The user sees the exact Hometax menu, screen and legal row/field position.
3. The user compares the values with Hometax prefill and corrects only different rows.
4. SemuAgent provides no file, screenshot-by-screenshot tutorial or automatic navigation.

Not Path 1:

- Auto-submit.
- Encrypted electronic-file generation, fcrypt, or certification tooling.
- Screenshot-by-screenshot Hometax click tutorial and automatic navigation. Exact menu/screen/row/field mapping is part of Path 1b.
- Storing Hometax passwords, certificates, bank passwords, or card credentials.
- Sending the package to a tax office or accounting firm.

## 3. Data Preparation Contract

A Path 1a file may be generated, or a Path 1b value summary shown, only from
data that passed the applicable gates. The final "File conformance" row applies
to Path 1a only; Path 1b ends at the confirmed form-fill preview:

| Gate | Required behavior |
|:---|:---|
| Source completeness | Required source groups are present or explicitly not applicable |
| Source normalization | Files are parsed into rows or blocked for review |
| Period attribution | Rows are included, held, reference-only, or excluded as duplicate |
| Reconciliation | Applicable bank/evidence rows have confirmed evidence, explanation, exception, or exclusion decisions |
| Business relevance | Personal/private/business-unrelated items are excluded with a visible reason |
| Account confirmation | Each filing-relevant transaction has a final account or blocks generation |
| Tax-specific review | VAT deduction/provenance or payroll/local-income/business-status checks pass |
| Form-fill preview | The user sees the exact values used by the generated file before download |
| File conformance | The generated file matches the current official non-encrypted upload template and passes representative upload validation |

## 4. What Is Already Designed Correctly

- The product boundary is correct: SemuAgent prepares data and files; the user
  submits in Hometax or Witax.
- Source collection, period attribution, the reconciliation workbench, and the
  shared Path 1 gate now form one named preparation chain.
- Reconciliation Phase 2 supports evidence connect/review/unlink/replace,
  amount-difference blocking, account confirmation, explanation, exclusion,
  exception, prior-pattern guidance, and safe batch account acceptance.
- Filing preparation consumes the shared reconciliation gate.
- VAT UI/API enforce the composite source/reconciliation/deduction/provenance
  gate, and the deterministic rebuild verifies exact confirmed VAT facts.
- Payroll-only paths remain independent from unrelated bookkeeping blockers.
- Simplified wage provides the first form-fill preview and non-encrypted file
  generation pattern; official direct-upload acceptance remains part of beta verification.

## 5. Remaining Product Gaps

### 5.1 Reconciliation Phase 2 Is Complete

Brief 41 §9 has no unchecked Phase 2 items. Slices 2a through 2d-3c are complete:

- live tenant/period workbench and table-first actions;
- evidence connect, review, unlink/replace, exceptions and amount-difference blocking;
- account, explanation and exclusion mutations;
- prior account/evidence/exclusion pattern guidance and safe batch account acceptance;
- shared reconciliation Path 1 gate;
- VAT package UI/API enforcement;
- exact VAT fact storage, deterministic rebuild and fingerprint verification.

The following remain explicitly deferred, not hidden Phase 2 work:

- year/custom reconciliation period scope;
- evidence-exception edit/remove;
- partial-payment and many-to-one split/merge;
- broader LLM fallback/consensus implementation where deterministic rules and
  historical patterns are insufficient.

These are added only if a target tax-type file proves they are required.

### 5.2 Direct-Entry Screens Establish The Path 1b Pattern

Simplified wage shows the repeatable pattern:

- official Hometax direct-entry route and period;
- business identity and target employees;
- employee-level monthly pay, totals and validation;
- identifiers remain a Hometax direct-entry responsibility;
- no generated file, PII input form or conversion-upload claim.

Withholding keeps the preparation/validation panel and is assigned to Path 1b:
official guidance exposes Hometax direct entry or password-based accounting-program
conversion, not an official non-encrypted upload form, so the confirmed A01
aggregate is shown as a `항목 = 값` direct-entry summary instead of a generated
file — **that 1b screen is live.** VAT Stage A has confirmed
some schedule-level file conversion flows but not an official non-encrypted
whole-return template or verified direct-acceptance route, so VAT is assigned to
Path 1b (Mapping·Preview·runtime complete) while Path 1a stays a Stage A upgrade.
Local income is not assigned to 1b because WETAX documents an official Excel
upload route; the original workbook still requires authenticated access.
Annual wage statement is assigned to 1b after its Stage A audit. Stage B mapped
the legal field surface and confirmed that the current read model lacks the
complete deduction, tax-credit, taxable-base, determined-tax and settlement
result sources. Stage C therefore fixes the final result in Hometax and limits
SemuAgent to confirmed employer payroll base-data preparation, with a separate
filing-profile and strict PII boundary. Stage D Preview is next. Business status
is conditional on a VAT-exempt sole-proprietor eligibility gate.

### 5.3 File Verification Must Be Part Of Path 1a Done

For Path 1a, code generation alone is not enough. A tax type's 1a track stays
open until the generated artifact is checked for filename, file type, template
structure, required fields, totals, tenant/period isolation, and representative
Hometax/Witax non-encrypted upload validation. Path 1b has no generated file, so
its done line is the confirmed `항목 = 값` summary matching the same read model.

## 6. Fixed Next Work

The authoritative sequence and completion lines are in
[Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md).

1. **Withholding Path 1b screen — done (2026-07-12).**
   - Part A mapping and Slice 1a validation assets preserved and reused.
   - The confirmed A01 aggregate is shown as a `항목 = 값` direct-entry summary
     (including a local income tax reference value); the pre-existing
     validation-panel copy was rewritten from 1a-pending framing to the
     confirmed 1b framing.
   - Start Path 1a W1-W5 only if a new official non-encrypted template and direct
     Hometax acceptance route satisfy the W0 upgrade conditions.
2. **VAT Path 1b screen — done (2026-07-13).**
   - Mapping, HTML Preview, Pre-Code Brief, scoped read model and runtime screen are implemented.
   - The full regression suite and desktop/410px browser checks passed; live blocked state hides values and routes back to VAT.
   - `(27)` final payable/refundable tax remains a Hometax final check; SemuAgent's ㉰ subtotal is not relabeled as line (27).
3. **Keep VAT Stage A as a 1a upgrade check.**
   - Confirm whether a complete non-encrypted return template exists (Path 1a).
   - Confirm whether schedule-level conversion files remain supported without
     encryption and acquire their official current layouts.
   - Do not start Stage B mapping or generator code until Stage A confirms a form.
4. **If VAT Stage A confirms a form, complete VAT Path 1a B~G.**
   - Reuse the completed Phase 2 gate and provenance source of truth.
   - Limit the 1a claim to the exact return or schedule files officially supported.
5. **Local-income special collection — Path 1a candidate, external wait.**
   - The official WETAX Excel upload route is confirmed.
   - Do not infer workbook columns or build a generator before the authenticated
     original `B070101-02.xlsx` is acquired and hashed.
6. **Annual wage statement — Stage A/B/C done, Stage D Preview next.**
   - Official guidance confirms direct entry or own-program transformation, not
     an official non-encrypted upload form; route the tax type to Path 1b.
   - Stage B maps all statutory fields and records that the current DB does not
     own a complete finalized annual-settlement result.
   - Stage C sets Hometax's generated statement as the final canonical result,
     defines filing-profile ownership and keeps resident/family/deduction PII
     out of SemuAgent.
   - Stage D must Preview the payroll base-data handoff and exact Hometax flow,
     not reproduce every statutory field.
   - Do not derive deductions, taxable base, determined tax or refund/additional
     collection from annual gross pay and withheld tax.
7. **Business-status report — conditional follow-up.**
   - Start only after a VAT-exempt sole-proprietor eligibility gate and target
     fixture exist; hide it from ineligible businesses.
8. **Run Path 1a beta after two compatible tax types satisfy the per-tax 1a
   completion line; simplified wage and withholding Path 1b are already live.**

Path 2, encrypted Path 3, screenshot-by-screenshot direct-entry tutorials and
automatic submission do not interrupt this sequence.

## 7. Completion Decisions

| Scope | Done when |
|:---|:---|
| Reconciliation Phase 2 | Brief 41 §9 complete and VAT gate/provenance consumers implemented — **done** |
| One tax type (Path 1a) | Roadmap 36 §2.1 all conditions pass |
| Path 1a beta | Two compatible tax types pass official non-encrypted upload verification and beta flow |
| Path 1b coverage | Every applicable tax type without a confirmed form is assigned to Path 1b and its direct-entry preparation screen is built. Simplified wage·withholding·VAT — **done**. Annual wage — Stage C complete, Stage D Preview pending. Business status — conditional. Local income — Path 1a candidate. No applicable tax type ends `blocked` |
| Planned tax matrix decision | Withholding and VAT are live Path 1b; local income is a Path 1a candidate awaiting the original workbook; annual wage is assigned to Path 1b with Stage C ownership complete and Stage D Preview next; business status requires an applicability gate before its Stage A |
| Path 2 restart | Full Path 1 beta (1a files + 1b summary screens) is stable and a new UI-First Gate is approved |

## 8. Documentation Sync

This audit supersedes wording that presents Path 1, Path 2, and Path 3 as equal
current choices. For beta:

- Path 1 is the product path, with 1a (official form upload) and 1b (direct-entry value summary) branches; no tax type ends `blocked`.
- Path 2 is after the full Path 1 beta (1a files + 1b summary screens); JC-034's required outputs are the per-tax summary CSVs that depend on 1b work, with Path 1a files only optional attachments.
- Encrypted Path 3 is outside the current product scope.
- Exact Hometax menu/screen/row/field mapping is included in Path 1b; screenshot-by-screenshot click tutorials and automatic navigation are excluded.

Related:

- [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md)
- [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Reconciliation Ledger Phase 2 Pre-Code Brief](./41_RECONCILIATION_LEDGER_V2_PRE_CODE_BRIEF.md)
- [VAT Confirmed-Ledger Provenance Audit](./42_VAT_CONFIRMED_LEDGER_PROVENANCE_AUDIT.md)
- [Withholding W0 Final Audit](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md)
- [VAT Stage A Audit](./43_JC030_VAT_NONENCRYPTED_UPLOAD_TEMPLATE_AUDIT.md)
- [Local Income Tax Stage A Audit](./54_JC030_LOCAL_INCOME_TAX_UPLOAD_TEMPLATE_ACQUISITION.md)
- [Annual Wage Statement Stage A Audit](./55_JC030_ANNUAL_WAGE_STATEMENT_STAGE_A_AUDIT.md)
- [Filing Support QA](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
