# Open Backlog Completion Contracts
> Created: 2026-07-05 21:34
> Last Updated: 2026-07-11

## 0. Purpose

This document fixes the finish line for open SemuAgent backlog items. It exists because several items describe direction or cleanup work, but do not make it obvious when the item can safely move to `done`.

Rule: an open backlog item may not start implementation unless its completion contract below is either already satisfied or updated in the same docs PR before implementation.

## 1. Work Categories

| Category | Meaning | Items |
|---|---|---|
| 신고 준비 기능 | Prepares reviewable data for any filing path | JC-025, JC-026, JC-028 |
| 세무판단 보조 | Explains tax-treatment possibilities and keeps final confirmation with the user | JC-035 |
| 공통 검증 | Validates confirmed data against official layout (Path 1 & 2) | JC-030 Validation |
| Path 1 제출 준비물 | 홈택스 업로드용 양식·파일 작성 지원 | JC-030 Path 1, JC-013 |
| Path 2 사무소 handoff | ZIP/package for JARYO-GIWA (자료기와) | JC-034 |
| 제품 범위 밖 | Encrypted Hometax files, fcrypt and certification tooling | Archived JC-030 research |
| 제출 자동화 | Attempts submission after explicit user approval | JC-023 |
| 기반 정리 | Removes copied GIWA assumptions or legacy surfaces | JC-031 |

JC-031 is not a 신고 준비 feature. It is product-foundation cleanup so the 신고 준비 product no longer carries accounting-firm/customer-request assumptions.

## 2. Global Done Rules

Every item can move to `done` only when all of the following are true:

1. Scope is fixed in the backlog and, when user-visible, through UI-First Gate.
2. A Pre-Code Brief exists for implementation work, unless the item is explicitly docs-only or blocked by an external gate.
3. Responsibility boundary is explicit: SemuAgent prepares data and artifacts; final filing is by the user (Path 1), licensed firm (Path 2), unless JC-023 is separately approved.
4. No Hometax/certificate/bank/card credentials are stored.
5. Tests and docs are updated for the implemented scope.
6. Backlog status, acceptance checks, and Document Sync Check match the actual code state.

## 3. Item Contracts

### JC-023 — 사용자 승인 기반 홈택스 자동제출

Type: 제출 자동화. MVP 밖.

Current gate: blocked by external policy/legal checks.

May start implementation only after:

- 국세청 126 or official channel confirms whether a submission API, file-submission channel, or other approved integration path is available for the target tax type.
- 적합성 검정 and software/file-submission qualification requirements are known.
- Legal review confirms the flow does not become unlicensed tax agency/representation.
- Security review confirms user authentication and approval can happen without storing Hometax passwords, certificates, or raw credentials.
- Product copy is approved to avoid `대행`, `대리`, `자동 환급`, or similar risky claims.

Done means:

- A user sees the exact filing payload and explicitly approves submission.
- Submission runs only under the user's authority and approved authentication flow.
- Raw credentials are never stored.
- Every submission attempt, success, failure, receipt retrieval, and user approval is audit-logged.
- Receipt or failure evidence is stored in filing support.
- The feature has tests for approval gating, idempotency, credential non-storage, tenant isolation, and receipt/failure handling.

Non-goals before done:

- Scraping or bypassing Hometax protections.
- Silent or scheduled submission without user approval.
- Tax representative positioning.

### JC-025 — 종합소득세 신고 지원

Type: 신고 준비 기능.

Current gate: legal and scope gate not complete.

May start implementation only after:

- v1 target is narrowed to specific self-filing cases, such as simple sole-proprietor business income using existing bookkeeping output.
- The excluded cases are explicit: 세무조정, complex deductions, multi-income edge cases, and anything that requires professional tax judgment.
- Legal review confirms the line between calculation/preparation assistance and tax document preparation by an unlicensed agent.
- UI-First Gate defines the review screen and user confirmation copy.
- Pre-Code Brief maps bookkeeping output to the exact preparation fields.

Done means:

- The user can review income, expense, deductible/non-deductible grouping, and filing-preparation checks for the approved v1 case.
- The screen clearly states it is self-filing preparation, not tax agency work.
- The app does not auto-submit or claim a final tax judgment.
- Ambiguous or unsupported cases are blocked or marked as requiring expert review.
- Tests cover supported/unsupported case separation, tenant isolation, and calculation traceability.

Non-goals before done:

- Full comprehensive income tax coverage.
- Automatic 세무조정 or professional judgment replacement.
- Filing submission.

### JC-026 — 법인세 신고 지원

Type: 신고 준비 기능 with high legal risk.

Current gate: legal gate not complete.

May start implementation only after:

- Legal review decides one of three paths: defer, licensed-tax-professional partnership, or narrow internal-preparation checklist only.
- If implemented without a licensed professional flow, the v1 scope excludes tax adjustment statement preparation.
- Product copy is reviewed to avoid implying SemuAgent prepares corporate tax returns as a tax agent.
- UI-First Gate and Pre-Code Brief are approved after the legal decision.

Done means, if implemented:

- The approved legal path is documented.
- The feature only supports the approved scope: internal preparation/checklist, data package, or licensed-professional handoff.
- 세무조정계산서 preparation is either excluded or handled through an explicitly licensed workflow.
- The user sees responsibility boundaries before using the workflow.
- Tests cover scope gates and unsupported-case blocking.

Done may also mean explicit deferral:

- If legal review says the risk is too high for v1, JC-026 can be closed as deferred only after the backlog records the deferral reason and replacement handoff path.

### JC-028 — 사업장현황신고 지원

Type: 신고 준비 기능.

Current gate: done — read-only 사업장현황신고 준비 화면과 허브 `business_status` live 트랙 구현 완료(2026-07-05).

May start implementation only after:

- 대상 is fixed to exempt individual businesses only.
- Required report fields are mapped from source collection/bookkeeping data.
- The relationship with VAT is explicit: VAT-liable businesses do not use this workflow.
- UI-First Gate and Pre-Code Brief are approved.

Done means:

- Exempt individual businesses can review revenue, purchase/source data, missing items, and a business-status-report preparation summary.
- Non-exempt or corporation cases are hidden, dimmed, or blocked with a clear reason.
- The app does not submit the report automatically.
- The handoff to Hometax/direct filing is clear.
- Tests cover exempt/non-exempt branching and data aggregation.

Non-goals before done:

- Full Hometax file generation.
- Automatic submission.
- Corporate or VAT-liable business handling in this workflow.

### JC-030 — 전자신고 검증 및 파일 생성 (Validation / Path 1)

Type: 공통 검증 + Path 1 공식 비암호화 업로드 파일. 암호화 파일은 범위 밖.

Current gate: **JC-030 epic is in progress.** The simplified-wage tax-type v1
(Slices 1a–2a, 3) is implemented on main, but that does not complete JC-030 or
Path 1 beta. Reconciliation Phase 2 and the VAT confirmed-ledger
gate/provenance foundation are complete. The withholding W0 audit is now
**closed blocked**: official NTS guidance exposes Hometax direct entry or an
accounting-program conversion file with password input, neither of which is the
approved Path 1 artifact. W1-W5 were not started. The current tax-type track is
**VAT Stage A**, which is partial/blocked while the official non-encrypted
whole-return template and direct-acceptance path remain unverified. The fixed order and
completion lines are in [Path 1 Roadmap §§2–4](./36_PATH1_FORM_FILL_ROADMAP.md).

**Beta focus is Path 1 only.** Path 2 is after Path 1 beta. Path 3 encryption,
fcrypt and certification tooling are outside the current product scope.
Hometax screen transcription guidance is also explicitly excluded.

**Filing path priority (2026-07-10):** JC-030 is focused on Path 1. Path 2 is deferred and encrypted Path 3 is excluded:

| Layer | Filing Path | Status |
|---|---|---|
| **Validation** | Path 1 & 2 공통 | Implemented for simplified wage; repeated per tax type |
| **Path 1** | 홈택스가 직접 수용하는 공식 비암호화 양식·파일 작성 | In progress — simplified wage candidate implemented, withholding W0 closed blocked, VAT Stage A active |
| **Path 2** | 세무사무소 handoff ZIP | Deferred until Path 1 beta |
| **Path 3** | 인증·암호화 업로드 파일 | Excluded from current product scope |

#### Validation — 공통 검증 (Path 1 & 2)

Current state: `lib/efiling-simplified-wage` on main — layout validation, non-encrypted candidate build, tests.

Done means:

- For at least one approved tax type (간이지급명세서 v1), SemuAgent validates confirmed data against the official layout before Path 1 download; later Path 2 ZIP export reuses this validation.
- Validation covers required fields, totals, period, and format; errors/warnings are shown.
- PII follows one-time non-storage policy; tests cover validation, PII non-persistence, tenant isolation.

Remaining:

- [ ] JC-034 v1 consumes validation output in ZIP (after Path 1 beta)
- [ ] UI shows Path 1 as active, Path 2 as deferred and encrypted Path 3 as out of scope where mentioned

#### Path 1 — 홈택스 업로드용 양식·파일 작성 지원

Current state: simplified-wage non-encrypted file candidate, form-fill preview
and Hometax upload guide are on main. Withholding retains Slice 1a validation
assets but its W0 file track is closed blocked. VAT Stage A found official
conversion flows for some schedules, but not a complete official non-encrypted
whole-return template or verified direct-acceptance route. Other ordered tax
types do not yet generate official upload files.

Done means (Path 1, per tax type v1):

- User can download a file generated from the official non-encrypted upload template and validated preparation data.
- User can inspect the values that will be filled into the form/file before download: 신고 양식, 귀속기간, 사업자, 대상자, 합계, 일회성 식별정보 입력 상태.
- Hometax upload guide is shown for the prepared artifact.
- User uploads the prepared form/file and submits directly; SemuAgent does not log in, copy-type values into Hometax, or submit.
- The official non-encrypted template source/version/applicability date and
  Hometax direct-acceptance route are recorded, with no unresolved field-mapping gaps.
- Preview values and generated form/file come from one shared read model.
- File name, file type, template structure, required fields, totals,
  tenant/business/period isolation, and non-persistence are tested.
- A representative file passes Hometax/Witax non-encrypted upload validation;
  implementation without this operational verification remains open.

Path 1 beta means simplified wage and one additional compatible tax type satisfy
the per-tax completion line above. Withholding W0 is closed blocked, so the
next tax type that passes Stage A becomes the beta companion. VAT is the current
Stage A track. JC-030 planned-matrix decision close means withholding, VAT,
local-income special collection, business-status report, and annual payment
statement each either satisfy the per-tax completion line or are closed blocked
by official Stage A evidence. A blocked track is not counted as Path 1 support.
The implementation order is fixed in [Roadmap §4](./36_PATH1_FORM_FILL_ROADMAP.md).

#### Path 3 — 인증·암호화 파일 (excluded)

fcrypt, encrypted upload files, electronic-filing passwords and certification
tooling are not part of the current product completion contract. A tax type
that requires them remains blocked instead of silently expanding Path 1.

Non-goals (all JC-030 layers):

- User-approved auto-submit (JC-023).
- Tax-representative marketplace positioning.
- File types without an official current layout.
- Hometax screen transcription guide.

### JC-035 — 부가세 AI 세무판단 보조

Type: 세무판단 보조. 신고 준비 품질 기능이며 JC-030 파일 생성과 분리한다.

Current gate: **VAI-0~6b 코드 구현·migration 0070 dev 적용 완료, prod·브라우저 확인·PR 머지 대기.**
규칙/패턴/조건부 AI/사용자 확정과 VAT rebuild/package gate 연결은 구현됐고,
완료선과 고정 순서는 [VAT AI Tax Treatment Completion Contract](./44_VAT_AI_TAX_TREATMENT_COMPLETION_CONTRACT.md),
[Rule Matrix](./45_VAT_AI_TAX_TREATMENT_RULE_MATRIX.md),
[Pre-Code Brief](./46_VAT_AI_TAX_TREATMENT_PRE_CODE_BRIEF.md)에 있다.

Implementation preconditions:

- 기존 JC-011 화면과 구분되는 JC-035 Preview를 프로젝트 오너가 승인한다.
- 공제/불공제/안분/과세/영세율/면세 공식 규칙 매트릭스의 출처·버전·적용일이 고정된다.
- 추천 source(규칙/이전 패턴/AI/consensus)와 사용자 최종 결정의 저장 경계가 Pre-Code Brief에 고정된다.
- timeout·quota·provider 실패 시 화면 비차단·수동 검토 전환 계약이 테스트 가능한 형태로 고정된다.

Done means:

- AI가 판단 가능성, 근거, 필요한 증빙, 부족한 사실을 한 행에서 설명한다.
- 영세율·면세와 고위험 판단은 필수 증빙 또는 사용자 확인 없이는 확정되지 않는다.
- 사용자가 영세율·면세 필수 증빙을 확인 완료로 기록하고 그 확인자·시각을 감사할 수 있다.
- 사용자 확인 없이 VAT fact·공제 decision·세액·package gate가 변경되지 않는다.
- AI가 실패해도 VAT 화면·수동 검토·기존 mutation이 계속 동작한다.
- 추천과 최종 결정, 규칙 버전, 확정자, 확정시각을 감사할 수 있다.
- 미확정·보류·전문가 확인·필수 증빙·안분 미완료가 있으면 rebuild/package gate가 차단된다.
- tenant·사업장·기간·이전 패턴이 격리되고 대표 브라우저 E2E와 전체 회귀가 통과한다.

Non-goals before done:

- 공식 업로드 파일 생성 또는 홈택스 직접입력 안내.
- 자동 제출·자동 납부·세무대리.
- AI의 자동 최종확정.
- 모든 복잡한 세무 예외의 자동 처리.

### JC-034 — GIWA handoff package (Path 2 · ZIP Export v1)

Current gate: scope fixed in [JC-034 Scope Gate](./34_JC034_GIWA_HANDOFF_PACKAGE_SCOPE_GATE.md), but
**implementation deferred** until Path 1 beta is stable ([Path 1 Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)). The earlier 08 preview handoff panel is superseded by the Path 1-only filing-preparation preview.

May start implementation only after:

- [ ] UI-First Gate for handoff export panel — Path 1 beta 이후 신규 Preview로 재승인
- [x] Pre-Code Brief with manifest Zod schema and per-track CSV/Excel columns — [35_JC034_GIWA_HANDOFF_PACKAGE_PRE_CODE_BRIEF.md](./35_JC034_GIWA_HANDOFF_PACKAGE_PRE_CODE_BRIEF.md), approved 2026-07-07
- [ ] Copy approved: existing firm only, no marketplace/referral language
- [ ] JC-030 Validation integrated for 간이지급 v1 scope

Done means (v1):

- User can export a ZIP for a selected period containing manifest + at least one track section.
- Export is blocked when Validation has blocking errors (configurable per track).
- User confirms handoff scope before download; export event is audit-logged (no raw PII in logs).
- README-handoff states firm responsibility for filing and certified SW submission.
- Tests cover manifest schema, tenant isolation, empty/inapplicable tracks, and validation gating.

Non-goals (v1):

- SemuAgent ↔ GIWA real-time API
- Tax-firm discovery, referral fees, or bookkeeping-fee sharing
- Hometax submission or certificate storage
- Replacing firm's Wehago/Semusarang workflow

v2 (separate contract update): invitation link, API push, receipt sync back to SemuAgent.

### JC-031 — 레거시 GIWA upload/email 서브시스템 은퇴

Type: 기반 정리.

Current state: Slice 1 through Slice 4-2-0 documented. Slice 3 downstream FK migration is complete. [Slice 4 Schema Retirement Allowlist](./25_SLICE4_SCHEMA_RETIREMENT_ALLOWLIST.md) classifies remaining `upload_session`/`outbound_email` references, and [Upload Session Column Retirement Pre-Code Brief](./26_UPLOAD_SESSION_COLUMN_RETIREMENT_PRE_CODE_BRIEF.md) fixes the Slice 4-2 blockers before any table rebuild.

Remaining slices:

1. ~~**Slice 2c — Transaction-purpose internal task/FK decision**~~ **완료(2026-07-05)**
   - `transaction_purpose_request`는 과거 용도 확인 기록 + 분류 확정 연동으로 유지. 신규 고객 메일 워크플로는 제거.
   - `sent_email_id -> outbound_email.id` 제거(migration 0060).
   - draft/create/read/update API 410, dead service/UI 삭제. classification answer/application 유지.
2. **Slice 3 — Source batch replacement**
   - Introduce or designate an internal source-lineage model, such as `source_batch`.
   - **3a complete:** `source_batch` table, `upload_file.source_batch_id`, existing data backfill, and direct-upload dual-write are implemented.
   - **3b complete:** priority read models use `source_batch` scoping first while legacy downstream tables still bridge through `legacy_upload_session_id`.
   - **3c-0 complete:** downstream FK migration strategy is fixed: 3c-1 company-home read switch, 3c-2 source collection validation additive FK, 3c-3 bookkeeping additive FK, 3c-4 payroll lineage decision, 3c-4a payroll extraction additive FK, 3c-5 adaptive structuring allowlist/migration.
   - **3c-1 complete:** `company-home` read switch to `source_batch` scoping; `INTERNAL_SOURCE_BATCH_READ_KINDS` includes `sample_data` for first-run sample parity.
   - **3c-2 complete:** `request_item_validation` and `upload_item_declaration` have nullable `source_batch_id`, migration 0062 backfill, and new-row dual-write; dev/prod DB validation completed.
   - **3c-3 implemented:** bookkeeping material/link/run/row/voucher tables receive nullable `source_batch_id` via additive migration 0063 and deterministic dual-write; dev/prod DB validation completed. Read prefer remains later work.
   - **3c-4 decision complete:** payroll lineage must add generic `source_batch_id -> source_batch.id` only to `payroll_extraction_batch`, `payroll_extraction_row`, `payroll_rule_profile_application`, and `payroll_excel_draft`. Existing `payroll_employee_line.source_batch_id` points to `payroll_extraction_batch.id` and must not be reused for generic source lineage.
   - **3c-4a complete:** migration 0064 adds nullable `source_batch_id` to the selected payroll extraction tables, backfills by `legacy_upload_session_id`, and dual-writes extraction batch/rows/rule application/draft. dev/prod DB 0064 applied and validated before PR #107 merge.
   - **3c-5 decision complete:** `adaptive_structure_model.source_upload_session_id` and `adaptive_structure_model_run.upload_session_id` are provenance/audit pointers, not generic source-lineage FK targets. No additive migration in Slice 3; classify for Slice 4 allowlist.
   - Migrate `upload_file` and downstream bookkeeping/payroll/review references away from legacy `upload_session` where they only need source lineage.
   - Preserve direct-upload behavior and historical traceability.
   - Execute in the fixed order from Brief 24: **3a schema/backfill/dual-write -> 3b read model switch -> 3c-0 migration strategy -> 3c-1..3c-5 downstream FK migration**. Payroll is split into 3c-4 decision and 3c-4a additive FK implementation.
   - `upload_session` deletion is not part of Slice 3; it remains a compatibility surface until Slice 4.
3. **Slice 4 — Schema retirement**
   - **4-0 complete:** allowlist audit in [Slice 4 Schema Retirement Allowlist](./25_SLICE4_SCHEMA_RETIREMENT_ALLOWLIST.md). `upload_session` 116 TS/TSX refs categorized; `outbound_email` runtime INSERT paths none.
   - **4-1 complete:** removed `createSessionAndSend`, `lib/email/missing-request.ts`, `period-gap-missing-request`, `missing-request-targets`, and `lib/validations/session.ts`. `session-service.ts` retains only `createDirectUploadSession`. No DB migration.
   - **4-2-0 complete:** [Upload Session Column Retirement Pre-Code Brief](./26_UPLOAD_SESSION_COLUMN_RETIREMENT_PRE_CODE_BRIEF.md) confirms immediate table rebuild is unsafe. `token_hash/upload_url/expires_at/request_kind/request_event_id/request_email_*` and AI/review context columns still have runtime readers or compatibility responsibilities.
   - **4-2a complete:** removed redirect-blocked `sessions/new`, `extract-criteria` API, and `direct-send` module. Live `request_email_*` paths documented for 4-2b.
   - **4-2b complete:** [Brief 26 §2.4](./26_UPLOAD_SESSION_COLUMN_RETIREMENT_PRE_CODE_BRIEF.md) audits live read/write per criteria column. Decision: retain `analysis_notes`, `session_evaluation`, `request_email_subject/body`, and criteria reads through 4-2c; `request_email_cc` is 4-2c DROP candidate (runtime read 0). Optional **4-2b-impl** for inference migration before dropping subject/body/criteria columns.
   - **4-2c complete (micro):** migration 0065 drops `upload_session.request_email_cc`; dev+prod applied 2026-07-06 (Brief 26 §2.5). subject/body/criteria columns remain.
   - Remove or quarantine remaining `outbound_email`, request-event, mail-console, and legacy upload-session schema pieces after FK migration.
   - Keep only explicitly approved compatibility surfaces, if any, and document why they remain.

**Paused (2026-07-06):** The epic is **not done**. Backlog status stays `todo`. This is an intentional pause at a safe checkpoint after 4-2c micro, not epic completion. Live `upload_session` columns (`analysis_notes`, `extracted_criteria`, `additional_criteria`, `session_evaluation`, `request_email_subject`, `request_email_body`) remain for v1 direct-upload and AI/review pipelines. **Resume paths (optional, not required now):**

1. **Slice 4-3+** — retire dead schema (`outbound_email`, request-event remnants) after allowlist re-audit; less live-pipeline risk than 4-2b-impl.
2. **optional 4-2b-impl** — migrate inference off subject/body/criteria, then additional 4-2c micro column drops.

Product backlog (e.g. JC-030 filing files) may take priority until legacy schema causes operational pain. Do not mark JC-031 `done` until all "Done means" criteria below are met.

Done means:

- No runtime route, API, service, UI, or side effect creates or depends on GIWA-style external customer request email.
- `/upload/[token]` and portal-only APIs remain quarantined or deleted, while direct-upload shared APIs remain working.
- `outbound_email` is absent from runtime code except approved migration/history/documentation references.
- `upload_session` no longer acts as the active source-lineage model for SemuAgent v1, or the table has been formally renamed/reframed with legacy-only columns removed.
- `transaction_purpose_request.sent_email_id` no longer depends on `outbound_email`.
- Direct-upload, source collection, bookkeeping review, payroll, VAT, filing support, reminders, filing preparation, clients, billing, and jaryo-admin still pass their tests and smoke checks.
- `rg` checks for `outbound_email`, `outboundEmail`, `upload_session`, and `uploadSession` are documented with an allowlist.
- Final schema migration and DB schema docs match the code.

Non-goals before done:

- Breaking direct-upload or source traceability.
- Removing work-email or internal reminder domains.
- One-shot deletion of all historical data without retention policy.

## 4. Process Rule For New Discoveries

If a later audit finds another legacy surface, it must be classified into one of the existing JC-031 remaining slices. If it does not fit, the completion contract must be updated first. New slices should not be added casually; otherwise JC-031 will not have a stable finish line.

## 5. Related Documents

- [Backlog](../04_Logic_Progress/00_BACKLOG.md)
- [JC-023 Hometax Auto-submit Research](./13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md)
- [E-Filing File Generation Scope Gate](./19_EFILING_FILE_GENERATION_SCOPE_GATE.md)
- [JC-034 GIWA Handoff Package Scope Gate](./34_JC034_GIWA_HANDOFF_PACKAGE_SCOPE_GATE.md)
- [JC-034 GIWA Handoff Pre-Code Brief](./35_JC034_GIWA_HANDOFF_PACKAGE_PRE_CODE_BRIEF.md)
- [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [Path 1 End-to-End Filing Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md)
- [JC-030 E-Filing File PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
- [JC-030 Simplified Wage E-Filing Layout Acquisition](./28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md)
- [Legacy Upload/Email Retirement Audit](./20_LEGACY_UPLOAD_EMAIL_RETIREMENT_AUDIT.md)
- [Legacy Mail Side-effect Audit](./21_LEGACY_MAIL_SIDE_EFFECT_AUDIT.md)
- [Upload Session Column Retirement Pre-Code Brief](./26_UPLOAD_SESSION_COLUMN_RETIREMENT_PRE_CODE_BRIEF.md)
