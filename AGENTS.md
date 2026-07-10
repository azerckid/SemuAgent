# SemuAgent Repository Instructions
> Created: 2026-07-01

## 1. Project Summary

SemuAgent is an AI-powered tax operations assistant for small companies.
It helps a company collect its own source documents, classify transactions,
prepare bookkeeping entries, calculate VAT and payroll, review/approve the
results, and generate the materials needed for direct Hometax submission.

This is not the same product as JARYO-GIWA. JARYO-GIWA is the accounting-firm
workflow for managing client documents. SemuAgent is for a small company's
representative, finance staff, or operations staff to automate and review its
own tax-preparation workflow directly.

## 2. Source Reuse Policy

Reuse JARYO-GIWA code aggressively, but never copy its product assumptions
blindly.

Preferred reuse sources:

- `lib/bookkeeping`: transaction extraction, account classification, ledger,
  journal entry, period attribution, and VAT-related bookkeeping logic.
- `lib/payroll`: payroll material extraction, rule profiles, structured payroll
  calculation, and wage statement drafting.
- `lib/ai`: file extraction, model orchestration, provider ordering, and
  structured review logic.
- `lib/db`, `drizzle`, `lib/auth*`: database, auth, and tenant isolation
  foundations.
- `components/ui`, `app/(dashboard)/_components`: design system and operational
  dashboard primitives.

Before reusing a JARYO-GIWA module, check:

1. Does it assume the operator is an accounting firm?
2. Does it expose a client/customer workflow that should become an internal
   company workflow?
3. Does it send, approve, or store data in a way that changes legal
   responsibility?
4. Does it require Hometax, banking, card, or certificate credentials?

If any answer is yes, adapt the copy and document the changed responsibility
boundary before shipping.

## 3. Product Boundaries

- MVP is not automatic tax filing.
- MVP creates reviewable bookkeeping, VAT, payroll, and filing-material
  packages that a company can use to submit directly through Hometax.
- The app may guide users through uploading an official non-encrypted filing
  form/file and preserve submission receipts. It does not provide a Hometax
  screen-by-screen direct-entry workflow.
- fcrypt, electronic-filing passwords, encrypted Hometax upload files, and
  filing-software certification tooling are outside the current product scope.
- AI automation may assist source collection, classification, missing-item
  checks, reminders, calculations, and filing-package preparation, but final
  submission and payment remain user-confirmed actions.
- The app must not store Hometax passwords, joint certificates, bank passwords,
  or card-company credentials.
- Any future banking/card/Hometax connector must use explicit consent, read-only
  scopes where possible, encryption, audit logs, and revocation.
- Avoid "tax agency" or "tax representative" wording unless a licensed tax
  professional flow is explicitly designed.

## 4. Development Rules

- Use the local Solmate skills under `.agent/skills`.
- Start broad product or implementation work with `rules-product`.
- Start code work with `rules-dev` and `rules-workflow`.
- For React UI work, apply `rules-react` before coding.
- Before release or a PR, use `verify-implementation`.
- Use Zod for env, API inputs, external data, and AI responses.
- Use Luxon for accounting periods, deadlines, expiry, and timezone-aware time.
- Keep tenant isolation on every company-scoped query.
- Keep raw financial, payroll, and tax documents out of git.

## 5. Required Documentation Layers

Use `docs/` as the source of truth:

| Area | Required docs |
|---|---|
| Product scope | `docs/01_Concept_Design/01_PRODUCT_BASELINE.md` |
| UX and flows | `docs/02_UI_Screens/01_MVP_UX_BASELINE.md` |
| Technical setup | `docs/03_Technical_Specs/01_DEVELOPMENT_SETUP.md` |
| Backlog | `docs/04_Logic_Progress/00_BACKLOG.md` |
| QA | `docs/05_QA_Validation/01_MVP_QA_BASELINE.md` |

## 6. Final Response Contract

After implementation work, report:

- `문서 요구사항 반영:` what product or docs requirements were reflected.
- `JARYO-GIWA 재사용:` what was copied or adapted from JARYO-GIWA.
- `미반영/축소 구현:` what was intentionally left out.
- `검증 결과:` tests, checks, or why verification could not run.
