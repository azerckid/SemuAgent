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

## Adopted UI Direction

The adopted direction is **ledger table + right work panel**. The Clobe-style lower evidence list is useful as a reference for evidence selection, but SemuAgent should make the selected transaction and its work state clearer.

- The ledger table stays visible on the left/center.
- Selecting a row opens a right work panel.
- The panel shows the selected transaction, remaining difference, suggested evidence, previous-period pattern recommendation, evidence finder, account selector, explanation memo, exclusion reason, and save/cancel actions.
- Previous-period pattern recommendation means the UI can say why it suggests an account/evidence/exclusion, for example last month or recent months had the same counterparty, amount pattern, evidence source, or exclusion decision.
- "후보 N건" is not enough. The panel must show the actual evidence rows and let the user connect, reject, search manually, unlink, or replace.
- On mobile/narrow screens, the same panel may become a drawer, but the interaction contract stays the same.
- Period scope must be explicit: month, quarter, half-year, year, and custom range. The default follows the filing context rather than forcing one global period.
- "증빙없음" is not a completed state. The UI must show action-oriented states such as 증빙 필요, 소명 필요, 소명 완료, 증빙 예외, or 제외됨.

## Current Implementation Caveat

The current app screen is still an initial slice. It should not be treated as the completed 자료대조원장 until these workbench functions exist:

- bank deposit/withdrawal to tax-invoice matching,
- card payment to evidence connection,
- evidence finder with 세금계산서/현금영수증/체크카드 selection,
- explanation and bank usage-description memo,
- visible AI account recommendation confidence and user account selection,
- personal/private or low-business-use expense detection,
- exclusion reason selection,
- inline account editing from the 자료대조원장 work panel,
- previous-period pattern recommendations that the user can accept, change, or reject without automatic confirmation.

## Approved Information Structure

- Hero: Path 1 data readiness progress and blocker counts.
- Source summary: bank, card, tax invoice, cash receipt, evidence/explanation-needed, exclusion-review counts.
- Ledger table: one row per reconciled transaction candidate.
- Key columns: transaction date, source, counterparty, memo/item, supply amount, tax amount, linked evidence, account, counterparty master, status, action.
- Required actions: connect evidence, explain usage, confirm evidence exception, apply or reject prior-period pattern recommendation, assign account, confirm transaction, exclude private/business-unrelated use, resolve amount mismatch.
- Gate panel: tax-type file generation readiness reads this confirmed ledger.
- States: loading, empty, error, no permission.

## Responsibility Boundary

- This preview does not introduce a new calculation engine.
- This preview does not generate Hometax files.
- This preview does not change the final filing rule: the user uploads and submits on Hometax directly.
- Direct Hometax screen entry/copying remains excluded from Path 1.
