# Reconciliation Ledger Prototype Review

- Date: 2026-07-08
- Reviewer: Project owner
- Preview: [12_reconciliation_ledger.html](./previews/12_reconciliation_ledger.html)
- Status: Approved

## Decision

The Path 1 data readiness gate is approved as a dedicated **기장검토 > 자료대조원장** preview.

This screen is the first place the user checks after source collection is complete. It is not a tax-filing finish screen and not a filing-preparation child. Its job is to turn uploaded bank, card, tax-invoice, and cash-receipt records into a confirmed transaction ledger that tax-type Path 1 file generation can trust.

## Reference Inputs

The user provided Clobe reference screens for dense source-ledger workflows:

- Bank transactions
- Card approvals
- Tax invoices
- Cash receipts

The SemuAgent preview uses those screens only as operational inspiration. It does not copy their information architecture directly; it adapts the pattern to SemuAgent's Path 1 workflow.

## Approved Information Structure

- Hero: Path 1 data readiness progress and blocker counts.
- Source summary: bank, card, tax invoice, cash receipt, no-evidence, exclusion-review counts.
- Ledger table: one row per reconciled transaction candidate.
- Key columns: transaction date, source, counterparty, memo/item, supply amount, tax amount, linked evidence, account, counterparty master, status, action.
- Required actions: connect evidence, assign account, confirm transaction, exclude private/business-unrelated use, resolve amount mismatch.
- Gate panel: tax-type file generation readiness reads this confirmed ledger.
- States: loading, empty, error, no permission.

## Responsibility Boundary

- This preview does not introduce a new calculation engine.
- This preview does not generate Hometax files.
- This preview does not change the final filing rule: the user uploads and submits on Hometax directly.
- Direct Hometax screen entry/copying remains excluded from Path 1.
