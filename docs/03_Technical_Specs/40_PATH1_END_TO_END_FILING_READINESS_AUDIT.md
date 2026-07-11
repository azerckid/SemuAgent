# Path 1 End-to-End Filing Readiness Audit
> Created: 2026-07-07 23:29 KST
> Last Updated: 2026-07-11 KST

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
directly. Path 1b provides the value summary only; it does not build a file
generator (B~G) and it is not a step-by-step Hometax menu/field-location guide.
Encrypted electronic-file generation stays out of scope, and no tax type ends
as `blocked` — a tax type without an official form is **assigned to Path 1b**.
Path 1b is a decided routing outcome, not a shipped screen: as of this PR the 1b
value-summary screens for withholding and VAT are **not yet implemented**.

## 1. Current Answer

The common data-preparation foundation is now complete through Reconciliation
Ledger Phase 2. Path 1a (official upload file) is implemented for one tax type;
tax types without a confirmed official form are **assigned to Path 1b**
(direct-entry value summary) rather than being blocked. The 1b screens themselves
are decided but **not yet implemented**.

| Step | Current state | Evidence | Remaining gap |
|:---|:---|:---|:---|
| 자료수집 | Live | `lib/source-collection/summary.ts`, `/dashboard/direct-upload` | Missing source groups still block the applicable filing period as designed |
| 정규화·귀속기간·중복 | Live for v1 | `lib/bookkeeping/period-attribution-service.ts`, `lib/bookkeeping/attribution-gate.ts` | Deferred year/custom scope and complex split/merge are not required for current exact 1:1 v1 |
| 자료대조·확정 원장 | **Live; Phase 2 complete** | `/dashboard/bookkeeping/reconciliation-ledger`, Brief 41 §9 | Exact evidence connection, account, explanation, exclusion, exception, pattern and shared gate are implemented; deferred edges remain explicit non-goals |
| 신고 준비 공통 gate | **Live** | `loadReconciliationPath1Gate`, filing-preparation summary | VAT is the first consumer; payroll-only routes intentionally do not inherit unrelated bookkeeping blockers |
| 부가세 확정 원장 provenance | **Live** | `lib/vat/facts.ts`, `lib/vat/provenance.ts`, rebuild/package gates | Exact VAT facts are not manufactured for old/sample rows; unresolved rows remain correctly blocked |
| 세목별 신고 준비 데이터 | Live for core tracks | VAT, payroll/withholding, payment statements, local income, business status read models | A ready data screen is the Path 1b endpoint; Path 1a additionally needs an official upload file |
| 양식에 채워질 값 확인 | Live for simplified wage; validation/value assets preserved for withholding | `lib/efiling-simplified-wage`, `lib/efiling-withholding` | Withholding has no confirmed official form → assigned to Path 1b (value-summary screen not yet built); VAT Path 1a form is a Stage A upgrade only |
| 홈택스 업로드용 파일 (Path 1a) | Live for simplified wage only | simplified-wage generate API and upload guide | Withholding is Path 1b (no file); VAT, local income, business status and annual statement 1a files remain conditional on a confirmed form |
| 홈택스 직접입력 정리 (Path 1b) | **Decided, not yet implemented** for form-less tax types | 확정 `항목 = 값` read model (source values exist) | Withholding and VAT are assigned to 1b but the 1b value-summary screens are pending; 1b is value-list display only |
| 최종 제출 | User only | Product Baseline, Roadmap 36 | Auto-submit and credential storage remain excluded |

The useful status is therefore qualitative, not a single percentage:

- **Common confirmed-data foundation:** complete for the planned v1 exact-match flow.
- **Tax-type upload files (Path 1a):** one tax type implemented; withholding has
  no confirmed official form and is assigned to Path 1b; VAT Path 1a is a
  Stage A upgrade.
- **Direct-entry summaries (Path 1b):** the routing decision is made for any tax
  type without a confirmed form (so no tax type ends as `blocked`), **but the 1b
  value-summary screens are not yet implemented** — the current app still shows the
  withholding preparation/validation panel and has no VAT value-summary screen.
- **Path 1 beta:** Path 1a beta is not complete until simplified wage and one
  additional tax type pass the full non-encrypted upload-file verification line;
  encrypted fallback is never used. Path 1b coverage still needs its value-summary
  screens built.
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
2. The user reads the summary and types the values into Hometax directly.
3. SemuAgent provides the value summary only — no file, no step-by-step menu guide.

Not Path 1:

- Auto-submit.
- Encrypted electronic-file generation, fcrypt, or certification tooling.
- Step-by-step Hometax menu/field-location walkthrough (1b is value display only).
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

### 5.2 Form-Fill Preview Exists For One Complete Tax Type

Simplified wage shows the repeatable pattern:

- official form name and period;
- business identity and target employees;
- totals and validation;
- one-time PII input status;
- generated-file and Hometax upload boundary.

Withholding keeps the preparation/validation panel and is assigned to Path 1b:
official guidance exposes Hometax direct entry or password-based accounting-program
conversion, not an official non-encrypted upload form, so the confirmed A01
aggregate is **intended** to be shown as a `항목 = 값` direct-entry summary instead
of a generated file — **that 1b screen is not yet built.** VAT Stage A has confirmed
some schedule-level file conversion flows but not an official non-encrypted
whole-return template or verified direct-acceptance route, so VAT is assigned to
Path 1b (screen also pending) while Path 1a stays a Stage A upgrade. Local income,
business status and annual statements are likewise assigned to Path 1b and add
Path 1a files only when their own Stage A confirms an official form.

### 5.3 File Verification Must Be Part Of Path 1a Done

For Path 1a, code generation alone is not enough. A tax type's 1a track stays
open until the generated artifact is checked for filename, file type, template
structure, required fields, totals, tenant/period isolation, and representative
Hometax/Witax non-encrypted upload validation. Path 1b has no generated file, so
its done line is the confirmed `항목 = 값` summary matching the same read model.

## 6. Fixed Next Work

The authoritative sequence and completion lines are in
[Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md).

1. **Build the withholding Path 1b screen (not yet implemented).**
   - Preserve Part A mapping and Slice 1a validation assets.
   - Implement the confirmed A01 aggregate as a `항목 = 값` direct-entry summary
     screen (currently the app shows only the validation panel).
   - Start Path 1a W1-W5 only if a new official non-encrypted template and direct
     Hometax acceptance route satisfy the W0 upgrade conditions.
2. **Build the VAT Path 1b screen and finish VAT Stage A as a 1a upgrade check.**
   - Implement the confirmed VAT values as a `항목 = 값` direct-entry summary
     screen (not yet built).
   - Confirm whether a complete non-encrypted return template exists (Path 1a).
   - Confirm whether schedule-level conversion files remain supported without
     encryption and acquire their official current layouts.
   - Do not start Stage B mapping or generator code until Stage A confirms a form.
3. **If VAT Stage A confirms a form, complete VAT Path 1a B~G.**
   - Reuse the completed Phase 2 gate and provenance source of truth.
   - Limit the 1a claim to the exact return or schedule files officially supported.
4. **If VAT Stage A finds no form, VAT stays on Path 1b and the next Stage A moves
   to local-income special collection.**
5. **Repeat per tax type: build the Path 1b screen, add Path 1a via Stage A~G when
   an official form is confirmed, for local-income special collection, business-status
   report and annual payment statement.**
6. **Run Path 1a beta after simplified wage and one additional compatible tax
   type satisfy the per-tax 1a completion line; Path 1b screens remain pending.**

Path 2, encrypted Path 3, step-by-step direct-entry guidance and automatic
submission do not interrupt this sequence.

## 7. Completion Decisions

| Scope | Done when |
|:---|:---|
| Reconciliation Phase 2 | Brief 41 §9 complete and VAT gate/provenance consumers implemented — **done** |
| One tax type (Path 1a) | Roadmap 36 §2.1 all conditions pass |
| Path 1a beta | Simplified wage + one additional tax type pass official non-encrypted upload verification and beta flow |
| Path 1b coverage | Every tax type without a confirmed form is assigned to Path 1b and its `항목 = 값` direct-entry summary screen is built (currently pending for withholding/VAT); no tax type ends `blocked` |
| Planned tax matrix decision | Withholding, VAT, local income, business status and annual statement each pass §2.1 (Path 1a) or are assigned to Path 1b with official Stage A evidence that no form exists |
| Path 2 restart | Full Path 1 beta (1a files + 1b summary screens) is stable and a new UI-First Gate is approved |

## 8. Documentation Sync

This audit supersedes wording that presents Path 1, Path 2, and Path 3 as equal
current choices. For beta:

- Path 1 is the product path, with 1a (official form upload) and 1b (direct-entry value summary) branches; no tax type ends `blocked`.
- Path 2 is after the full Path 1 beta (1a files + 1b summary screens); JC-034's required outputs are the per-tax summary CSVs that depend on 1b work, with Path 1a files only optional attachments.
- Encrypted Path 3 is outside the current product scope.
- Step-by-step Hometax menu/field-location guidance is excluded (1b is value display only).

Related:

- [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md)
- [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Reconciliation Ledger Phase 2 Pre-Code Brief](./41_RECONCILIATION_LEDGER_V2_PRE_CODE_BRIEF.md)
- [VAT Confirmed-Ledger Provenance Audit](./42_VAT_CONFIRMED_LEDGER_PROVENANCE_AUDIT.md)
- [Withholding W0 Final Audit](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md)
- [VAT Stage A Audit](./43_JC030_VAT_NONENCRYPTED_UPLOAD_TEMPLATE_AUDIT.md)
- [Filing Support QA](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
