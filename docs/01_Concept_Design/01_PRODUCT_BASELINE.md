# SemuAgent Product Baseline
> Created: 2026-07-01 17:55
> Last Updated: 2026-07-03 15:46

## Purpose

SemuAgent helps a small company use AI-assisted workflows to prepare its own
tax filing materials:

`source collection -> classification/bookkeeping -> VAT calculation -> payroll -> review/approval -> filing-material package -> Hometax submission support -> receipt storage`

The product is designed for small-company users who want to prepare and review
their own tax filing workflow without routing every step through an accounting
or tax office. SemuAgent is not automatic tax filing; final Hometax submission
and payment remain user-confirmed actions.

## Primary Users

- CEO or owner-manager who wants direct visibility into accounting status
- Finance/accounting staff
- Operations staff handling receipts, payroll, and tax materials
- Optional external tax accountant as reviewer or advisor

## MVP Scope

- Upload or import source documents: tax invoices, bank statements, card
  statements, receipts, payroll files, Hometax exports.
- Classify transactions and generate reviewable bookkeeping entries.
- Prepare VAT-period summaries and supporting schedules.
- Calculate payroll from structured company payroll inputs.
- Generate filing-material packages and Hometax entry guidance.
- Store submission receipts, payment notices, and audit trail.
- Use AI-assisted automation for source classification, missing-item checks,
  reminders, and filing-preparation updates.

## MVP Non-Scope

- Automatic Hometax submission.
- Server-side storage of Hometax, bank, card, certificate, or password
  credentials.
- Licensed tax-representative service positioning.
- Direct financial transactions or tax payments without a separate reviewed
  integration design.

## JARYO-GIWA Relationship

JARYO-GIWA remains the accounting-firm workflow. Its code is the first reuse
source for data extraction, bookkeeping, payroll, AI analysis, auth, database,
and dashboard UI.

Every reused flow must be checked for operator mismatch:

- `client` in JARYO-GIWA often means an accounting-firm customer company.
- In SemuAgent, the company is the tenant/operator.
- Email request and accountant approval flows usually become internal company
  review/approval flows.

## Related Documents
- **UI_Screens**: [MVP UX Baseline](../02_UI_Screens/01_MVP_UX_BASELINE.md) - 6개 워크스페이스 UX 기준선
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 화면 흐름 및 데이터 입출력
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **Technical_Specs**: [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) - 런타임·스택·재사용 기반
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - MVP 실행 항목 및 Context Lock
- **QA_Validation**: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md) - 품질 기준선
