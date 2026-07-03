# SemuDesk MVP UX Baseline
> Created: 2026-07-01 17:56
> Last Updated: 2026-07-01 17:56

## First Screen Principle

The app should open into the working product, not a marketing page.

Primary dashboard information:

- Current accounting period status
- Missing or unreviewed source materials
- Transaction classification queue
- VAT preparation status
- Payroll preparation status
- Filing-material package status
- Recent submissions and receipts

## Core Workspaces

1. **Company Home**
   - period status
   - next actions
   - blockers before filing

2. **Source Collection**
   - file upload
   - import status
   - source type normalization
   - collection completeness

3. **Bookkeeping Review**
   - transaction classification
   - period attribution
   - journal entry preview
   - approval state

4. **VAT**
   - taxable/exempt/zero-rated grouping
   - purchase deduction review
   - supporting schedules
   - filing package preview

5. **Payroll**
   - employee/payroll input
   - payroll calculation
   - withholding and four-insurance review
   - wage statement draft

6. **Filing Support**
   - Hometax entry guide
   - generated attachment package
   - submission receipt storage
   - post-filing checklist

## Reuse Notes

Reusable JARYO-GIWA UI:

- shadcn/base UI components under `components/ui`
- dashboard layout and sidebar primitives
- review tables and status chips
- payroll workspace components

Must change:

- "client request" wording should become "company source collection" or
  "internal review".
- "accountant approval" wording should become "company approval" unless an
  external tax accountant reviewer is explicitly configured.
- public upload portal flows should be re-evaluated before reuse, because
  company self-use may not need external client upload links in the same form.

## Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 사용자
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 6개 화면 흐름 및 데이터 입출력
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 디자인 시스템 및 화면별 컴포넌트
- **UI_Screens**: [HTML Preview 폴더](./previews/) - 브라우저 확인용 프로토타입(6화면)
- **Technical_Specs**: [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) - 화면별 컴포넌트·라이브러리 계획
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - 화면별 구현 항목(JC-006·009~013)
