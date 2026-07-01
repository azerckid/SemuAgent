# JARYO Company Product Baseline

## Purpose

JARYO Company helps a company run its own accounting and tax operation:

`source collection -> classification/bookkeeping -> VAT calculation -> payroll -> review/approval -> filing-material package -> Hometax submission support -> receipt storage`

The product is designed for company-side users, not accounting-firm operators.

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
- In JARYO Company, the company is the tenant/operator.
- Email request and accountant approval flows usually become internal company
  review/approval flows.
