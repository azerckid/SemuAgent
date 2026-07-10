# VAT Confirmed-Ledger Provenance Audit
> Created: 2026-07-10 09:55 KST
> Last Updated: 2026-07-10 09:55 KST

## 0. Purpose

This audit fixes the implementation boundary for Reconciliation Slice 2d-3.
The goal is not to make the current VAT snapshot look verified. The goal is to
prove that every value used by a VAT Path 1 package came from confirmed,
filing-relevant evidence rows for the same tenant, business entity, and period.

The package must remain locked when that proof cannot be reproduced.

## 1. Audit Result

The current model cannot prove `vat_period_summary` provenance and cannot yet
perform a safe deterministic rebuild.

| Surface | Current fact | Consequence |
|:---|:---|:---|
| `vat_period_summary` | Runtime code reads and updates deduction/package state, but no runtime producer builds its tax values from confirmed ledger rows. First-run sample seed inserts the values directly. | Snapshot presence is not proof of origin. |
| `bookkeeping_transaction_classification` | Has generic date, counterparty, gross amount, direction, account, status, and `evidenceJson`. It has no normalized VAT supply amount, tax amount, tax category, or sale/purchase treatment. | Output/input tax and taxable/zero-rated/exempt supply cannot be reproduced safely. |
| `evidenceJson` | Current sample only records classification basis such as amount/date/counterparty. | It is not a VAT fact contract and must not be parsed as one. |
| `vat_deduction_review` | Has optional `classificationRowId`, `sourceVoucherId`, and `sourceVoucherLineId`, but the current sample rows leave all three empty. | Review amounts are not tied to a confirmed source row. |
| Journal vouchers | VAT account lines can exist, but the current sample has one unrelated draft voucher. New vouchers are stored as drafts until explicitly confirmed. | Draft lines cannot prove filing values. |
| Tax category detail | Journal lines can identify output/input tax accounts, but do not preserve zero-rated/exempt classification for every source transaction. | Journal totals alone cannot rebuild all fields in `vat_period_summary`. |

Read-only dev DB evidence for `2026-H1`:

- `vat_period_summary`: one seed snapshot (`outputTaxKrw=32,000,000`, `inputTaxKrw=18,000,000`).
- `vat_deduction_review`: four rows; classification/voucher/voucher-line links are `0/0/0`.
- journal vouchers: one `draft` voucher with only `소모품비 120,000 / 보통예금 120,000`.
- confirmed tax-invoice classification rows: one row, while the snapshot contains much larger aggregate values.

Therefore Slice 2d-3 must not flip `provenanceVerified` to `true` by comparing
the current totals or by assuming every gross amount is supply plus 10% VAT.

## 2. Decision

For v1, reuse `bookkeeping_transaction_classification` as the canonical
transaction identity and add explicit VAT fact fields. Do not create a second
general transaction table.

### 2.1 Additive classification fields

The exact schema names may follow project conventions, but the contract must
represent these values explicitly:

| Field | Contract |
|:---|:---|
| VAT direction | `sale` / `purchase` / `not_applicable` / `needs_review` |
| VAT tax type | `taxable` / `zero_rated` / `exempt` / `non_taxable` / `needs_review` |
| supply amount | Exact KRW supply amount from the evidence source |
| tax amount | Exact KRW VAT amount from the evidence source |
| gross amount | Exact source total used for arithmetic validation |
| VAT fact source | Parser/manual origin and source-row identity |
| VAT fact status | `derived` / `confirmed` / `needs_review` / `excluded` |

These fields must come from parsed tax invoices, card/receipt VAT detail, or an
explicit user confirmation. The implementation must not infer VAT by dividing a
gross amount by 11 when the source does not provide a tax basis.

Bank rows are payment/settlement rows, not VAT facts. When a bank row points to
an evidence row through `linked_evidence_row_id`, only the evidence row is
aggregated so the payment and evidence are not double-counted.

### 2.2 Additive summary provenance fields

`vat_period_summary` needs enough metadata to prove that a stored snapshot is
the current deterministic result:

| Field | Purpose |
|:---|:---|
| provenance version | Identifies the rebuild algorithm contract |
| source fingerprint | Hash of sorted confirmed VAT fact IDs and filing values |
| source row count | Audit count for the period |
| rebuilt at | Timestamp of the deterministic rebuild |

No package-generation timestamp or status may substitute for these fields.

## 3. Deterministic Rebuild Contract

The rebuild service must:

1. scope by `tenantId`, business entity, and VAT half-year period;
2. select only the latest completed classification run for each active source batch/session;
3. use only filing-relevant evidence rows with `status='confirmed'` and confirmed VAT fact fields;
4. exclude bank rows, excluded rows, unresolved VAT facts, and stale/superseded runs;
5. reject the rebuild when any filing-relevant evidence row has missing or inconsistent VAT fields;
6. aggregate taxable, zero-rated, exempt, output-tax, and input-tax values from the normalized VAT facts;
7. apply `vat_deduction_review` decisions only when each review points to a confirmed row in the same tenant/client/period;
8. calculate deductible input tax and payable tax from the rebuilt values;
9. create a deterministic fingerprint from sorted source row IDs plus the rebuilt values;
10. update the snapshot values and provenance metadata in one transaction.

The package API must recompute or verify the current fingerprint immediately
before changing `packageStatus`. A mismatch, missing source field, unlinked
deduction review, or unresolved VAT fact returns `409` and leaves the package
locked.

## 4. Fixed Implementation Order

| Slice | Work | Completion line |
|:---|:---|:---|
| 2d-3a | This audit and completion-contract update | Existing gaps, chosen model, non-goals, and QA gates are documented before schema/code changes. |
| 2d-3b | Additive VAT fact + summary provenance schema and writers | Parsed/manual VAT facts are stored with source identity; sample data uses the same writer contract; existing rows remain locked until backfilled/confirmed. |
| 2d-3c | Deterministic rebuild + package-gate verification | Rebuild tests cover all tax categories and stale/missing sources; the UI/API unlock only when the current fingerprint verifies. |

No further 2d-3 sub-slice may be added without updating this contract first.
Slice 2d-3 is complete only when both 2d-3b and 2d-3c are merged and the package
gate no longer contains an unconditional provenance lock.

## 5. Non-Goals

- No Hometax upload-file assembly; that remains JC-030.
- No direct-entry guidance or automatic submission.
- No gross/11 heuristic when exact VAT facts are absent.
- No use of draft journal vouchers as filing truth.
- No package unlock for sample data merely to demonstrate a green state.
- No reconciliation gate on payroll-only filing routes.
- No partial-payment or many-to-one evidence model expansion in this slice.

## 6. Acceptance And QA Gates

- [ ] Tenant A facts can never affect Tenant B rebuilds or fingerprints.
- [ ] Only the selected business entity and `periodKey` are aggregated.
- [ ] Bank/evidence pairs are counted once through the evidence row.
- [ ] Suggested, needs-decision, excluded, and stale-run rows are rejected or omitted according to the contract.
- [ ] Taxable, zero-rated, exempt, input-tax, and output-tax totals are reproduced from exact VAT facts.
- [ ] Every deduction review is linked to a confirmed same-scope source row before it affects the package.
- [ ] A source change after rebuild invalidates the stored fingerprint.
- [ ] UI and POST API show the same provenance failure reason and remain non-mutating on `409`.
- [ ] A verified rebuild is the only path that changes package provenance to ready.

## 7. Rubric Check

| Criterion | Status | Evidence |
|:---|:---:|:---|
| Functionality | PASS·설계 | Unsafe unlock is prevented; deterministic inputs and failure states are fixed. |
| Potential Impact | PASS·설계 | VAT package values become auditable from source evidence through filing output. |
| Novelty | N/A | This is correctness infrastructure, not a novelty claim. |
| UX | PASS·설계 | Existing blocker UI remains; users receive actionable provenance failures rather than a false ready state. |
| Open-source | PASS·설계 | Rebuild and fingerprint contracts are isolated from UI/API consumers. |
| Business Plan | PASS·설계 | Reliable Path 1 package preparation is a beta prerequisite. |

## 8. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - company self-use and assisted filing boundary.
- **UI_Screens**: [Reconciliation Ledger Prototype Review](../02_UI_Screens/12_RECONCILIATION_LEDGER_PROTOTYPE_REVIEW.md) - confirmed-row workflow and Path 1 gate UX.
- **Technical_Specs**: [Path 1 Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md) - end-to-end beta path; [Reconciliation Ledger Phase 2 Brief](./41_RECONCILIATION_LEDGER_V2_PRE_CODE_BRIEF.md) - 2d consumer contract; [DB Schema](./03_DB_SCHEMA.md) - current bookkeeping and VAT tables.
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - 2d-3 execution state.
- **QA_Validation**: [Bookkeeping Review Scenarios](../05_QA_Validation/04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md) - S-125~S-128 downstream gates; [VAT Scenarios](../05_QA_Validation/05_VAT_TEST_SCENARIOS.md) - package lock and rebuild cases.
