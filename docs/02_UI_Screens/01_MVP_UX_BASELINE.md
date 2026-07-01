# JARYO Company MVP UX Baseline

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
