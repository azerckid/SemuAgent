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

The adopted direction is **ledger table + cell actions + focused modals**. The Clobe-style lower evidence list is useful as a reference for evidence selection, but SemuAgent should keep the primary work inside the row where the issue appears.

- The ledger table is the main work surface.
- The evidence-status cell opens `증빙있음`, `증빙 찾기`, or `소명 입력` modals.
- The account cell opens the searchable account selector.
- The one-line conclusion column shows the recommended decision and basis before any modal opens.
- Previous-period pattern recommendation means the UI can say why it suggests an account/evidence/exclusion, for example last month or recent months had the same counterparty, amount pattern, evidence source, or exclusion decision.
- Candidate counts are not a user-facing answer. The row cell or modal must show either AI-found evidence rows or a manual **증빙 찾기** path, and let the user connect, reject, search manually, unlink, or replace.
- For rows already marked **증빙있음**, **증빙 확인** must show one compact **찾은 증빙** line before the source selector. If the user clicks that line, the relevant source list opens and the found row is visually distinguished with a selected background, border, or marker. The source selector remains available only for review/replace/search, not as the first answer.
- On mobile/narrow screens, row-level modals may become full-screen dialogs, but the interaction contract stays the same.
- Convenience should come from prioritization, not more modes: next-action queue first, tabs second.
- The row shows a one-line conclusion before detailed evidence and AI/pattern rationale opens in a modal.
- Batch suggestion acceptance is allowed only for safe repeated groups and always requires user confirmation.
- Missing-source issues should link back to 자료수집 with source type and period context; recent apply/confirm actions should support shallow undo.
- Period scope must be explicit: month, quarter, half-year, year, and custom range. The default follows the filing context rather than forcing one global period.
- "증빙없음" is not a completed state. The UI must show action-oriented states such as 증빙 필요, 소명 필요, 소명 완료, 증빙 예외, or 제외됨.

## Current Implementation Caveat

The current app screen is still an initial slice. It should not be treated as the completed 자료대조원장 until these workbench functions exist:

- bank deposit/withdrawal to tax-invoice matching,
- bank-row evidence connection to tax invoice, cash receipt, or card rows; card rows themselves focus on account/explanation/exclusion by default,
- evidence finder with 세금계산서/현금영수증/체크카드 selection,
- connected evidence review that opens the source list and highlights the linked row,
- explanation and bank usage-description memo,
- visible AI account recommendation confidence and user account selection,
- personal/private or low-business-use expense detection,
- exclusion reason selection,
- inline account editing from the 자료대조원장 account cell,
- previous-period pattern recommendations that the user can accept, change, or reject without automatic confirmation.

## Approved Information Structure

- Hero: Path 1 data readiness progress and blocker counts.
- Source summary: bank, card, tax invoice, cash receipt, evidence/explanation-needed, exclusion-review counts.
- Ledger table: one row per reconciled transaction candidate.
- Key columns: transaction date, source, counterparty, memo/item, amount/tax, evidence status, account, one-line conclusion, status/action.
- Required actions: start from next-action queue, connect evidence, explain usage, confirm evidence exception, apply or reject prior-period pattern recommendation, batch-accept safe repeated suggestions, assign account, confirm transaction, exclude private/business-unrelated use, resolve amount mismatch, use source back link, and undo the latest apply/confirm action.
- Gate panel: tax-type file generation readiness reads this confirmed ledger.
- States: loading, empty, error, no permission.

## Responsibility Boundary

- This preview does not introduce a new calculation engine.
- This preview does not generate Hometax files.
- This preview does not change the final filing rule: the user uploads and submits on Hometax directly.
- Direct Hometax screen entry/copying remains excluded from Path 1.
