# Path 1 End-to-End Filing Readiness Audit
> Created: 2026-07-07 23:29 KST
> Last Updated: 2026-07-10 21:22 KST

## 0. Purpose

This document checks whether the current product follows the user-approved
Path 1 workflow and states exactly what remains before beta.

```text
회사 자료 업로드
-> 정규화·귀속기간·중복 검토
-> 자료대조원장에서 증빙·소명·계정·제외 확정
-> 확정 데이터만 세목별 신고 준비 데이터로 집계
-> 공식 양식·파일에 채워질 값을 화면에서 확인
-> SemuAgent가 홈택스·위택스 업로드용 파일 생성
-> 사용자가 직접 업로드·검증·제출
```

There is no Hometax direct-entry path in beta. Path 1 means **official
non-encrypted form/file preparation for upload**, not copying values into
Hometax screens or generating encrypted electronic files.

## 1. Current Answer

The common data-preparation foundation is now complete through Reconciliation
Ledger Phase 2. Path 1 is still incomplete because actual official upload
files exist for only one tax type.

| Step | Current state | Evidence | Remaining gap |
|:---|:---|:---|:---|
| 자료수집 | Live | `lib/source-collection/summary.ts`, `/dashboard/direct-upload` | Missing source groups still block the applicable filing period as designed |
| 정규화·귀속기간·중복 | Live for v1 | `lib/bookkeeping/period-attribution-service.ts`, `lib/bookkeeping/attribution-gate.ts` | Deferred year/custom scope and complex split/merge are not required for current exact 1:1 v1 |
| 자료대조·확정 원장 | **Live; Phase 2 complete** | `/dashboard/bookkeeping/reconciliation-ledger`, Brief 41 §9 | Exact evidence connection, account, explanation, exclusion, exception, pattern and shared gate are implemented; deferred edges remain explicit non-goals |
| 신고 준비 공통 gate | **Live** | `loadReconciliationPath1Gate`, filing-preparation summary | VAT is the first consumer; payroll-only routes intentionally do not inherit unrelated bookkeeping blockers |
| 부가세 확정 원장 provenance | **Live** | `lib/vat/facts.ts`, `lib/vat/provenance.ts`, rebuild/package gates | Exact VAT facts are not manufactured for old/sample rows; unresolved rows remain correctly blocked |
| 세목별 신고 준비 데이터 | Live for core tracks | VAT, payroll/withholding, payment statements, local income, business status read models | A ready data screen is not yet an official upload file |
| 양식에 채워질 값 확인 | Live for simplified wage; validation-only assets preserved for withholding | `lib/efiling-simplified-wage`, `lib/efiling-withholding` | Withholding W0 is closed blocked; VAT Stage A must pass before its own UI-First Gate |
| 홈택스 업로드용 파일 | Live for simplified wage only | simplified-wage generate API and upload guide | Withholding is blocked; VAT, local income, business status and annual statement files remain |
| 최종 제출 | User only | Product Baseline, Roadmap 36 | Auto-submit and credential storage remain excluded |

The useful status is therefore qualitative, not a single percentage:

- **Common confirmed-data foundation:** complete for the planned v1 exact-match flow.
- **Tax-type upload files:** one tax type implemented; withholding is closed blocked and VAT Stage A is current.
- **Path 1 beta:** not complete until simplified wage and one additional tax
  type pass the full non-encrypted upload-file verification line. Withholding
  is closed blocked; VAT is the current candidate and cannot be forced through
  an encrypted fallback.
- **Planned Path 1 matrix:** not complete until the remaining ordered tax types
  each pass the same completion line.

## 2. Product Contract

Path 1 beta is one path:

1. SemuAgent prepares the official upload artifact.
2. The user inspects the values before download.
3. The user downloads the file.
4. The user opens Hometax or Witax and uploads/submits directly.

Not Path 1:

- Hometax screen transcription or direct-entry copy workflow.
- Auto-submit.
- Encrypted electronic-file generation, fcrypt, or certification tooling.
- Storing Hometax passwords, certificates, bank passwords, or card credentials.
- Sending the package to a tax office or accounting firm.

## 3. Data Preparation Contract

A tax-type file may be generated only from data that passed the applicable
gates:

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

Withholding keeps the preparation/validation panel but its file track is closed
blocked: official guidance exposes direct entry or password-based accounting-program
conversion, not the approved Path 1 artifact. VAT Stage A has confirmed some
schedule-level file conversion flows but not an official non-encrypted whole-return
template or verified direct-acceptance route. Local income, business status and
annual statements still require their own Stage A through G work.

### 5.3 File Verification Must Be Part Of Done

Code generation alone is not enough. A tax type stays open until the generated
artifact is checked for filename, file type, template structure, required
fields, totals, tenant/period isolation, and representative Hometax/Witax
non-encrypted upload validation.

## 6. Fixed Next Work

The authoritative sequence and completion lines are in
[Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md).

1. **Keep withholding W0 closed blocked.**
   - Preserve Part A mapping and Slice 1a validation assets.
   - Do not start W1-W5 unless a new official non-encrypted template and direct
     Hometax acceptance route satisfy the W0 reopen conditions.
2. **Finish VAT Stage A external verification.**
   - Confirm whether a complete non-encrypted return template exists.
   - Confirm whether schedule-level conversion files remain supported without
     encryption and acquire their official current layouts.
   - Do not start Stage B mapping or generator code while Stage A is blocked.
3. **If VAT Stage A passes, complete VAT B~G.**
   - Reuse the completed Phase 2 gate and provenance source of truth.
   - Limit the product claim to the exact return or schedule files officially supported.
4. **If VAT Stage A closes blocked, move to local-income special collection Stage A.**
5. **Repeat A~G in order for local-income special collection, business-status
   report and annual payment statement.**
6. **Run Path 1 beta after simplified wage and one additional compatible tax
   type satisfy the per-tax completion line.**

Path 2, encrypted Path 3, direct-entry guidance and automatic submission do not interrupt
this sequence.

## 7. Completion Decisions

| Scope | Done when |
|:---|:---|
| Reconciliation Phase 2 | Brief 41 §9 complete and VAT gate/provenance consumers implemented — **done** |
| One tax type | Roadmap 36 §2.1 all conditions pass |
| Path 1 beta | Simplified wage + one additional tax type pass official non-encrypted upload verification and beta flow |
| Planned tax matrix decision | Withholding, VAT, local income, business status and annual statement each pass §2.1 or close blocked with official Stage A evidence; blocked tracks are not Path 1 support |
| Path 2 restart | Path 1 beta is stable and a new UI-First Gate is approved |

## 8. Documentation Sync

This audit supersedes wording that presents Path 1, Path 2, and Path 3 as equal
current choices. For beta:

- Path 1 is the product path.
- Path 2 is after Path 1 beta.
- Encrypted Path 3 is outside the current product scope.
- Hometax direct-entry guidance is excluded.

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
