# SemuAgent

AI-powered tax operations assistant for small companies.

SemuAgent reuses the proven JARYO-GIWA codebase, but changes the product
operator from an accounting firm to the company itself. The goal is to help a
small company use AI-assisted workflows to collect evidence, classify
transactions, prepare bookkeeping entries, calculate VAT and payroll, review
the results, and generate filing materials for direct Hometax submission.

## Product Direction

MVP scope:

- Source document and transaction collection
- Automatic classification and bookkeeping review
- VAT calculation material preparation
- Payroll calculation and wage statement drafting
- Review/approval workflow for company staff
- Filing-material package and Hometax submission guidance
- Submission receipt and audit-trail storage
- AI-assisted missing-item checks, reminders, and filing-preparation automation

Out of scope for MVP:

- Automatic Hometax submission
- Storing Hometax, bank, card, certificate, or password credentials
- Tax-representative positioning without a licensed professional workflow

## Reused Base

This project was initialized from JARYO-GIWA while excluding the old product
documents, git metadata, build artifacts, local env files, and dependency
folders.

Primary reuse candidates:

- `lib/bookkeeping`
- `lib/payroll`
- `lib/ai`
- `lib/db`
- `components/ui`
- Dashboard primitives under `app/(dashboard)`
- Drizzle/Turso, Better Auth, Vercel Blob, Resend, and AI provider wiring

Before shipping reused code, adapt accounting-firm assumptions to company
self-use and AI-assisted tax-preparation assumptions.

## Solmate Skills

The current machine already has `solmate-skills` available at:

```text
/Users/namhyeongseog/Documents/solmate-skills
```

This repo links those local skills into:

```text
.agent/skills
```

So a network install is not required for local Codex use. The normal package
installer is still:

```bash
npx solmate-skills@latest install all
```

Use that only when you want to refresh from the published npm package instead
of the local source checkout.

## Development

Copy `.env.local.example` to `.env.local` and fill local development values.

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

Important env rules:

- Never commit `.env*` except `.env.local.example`.
- Keep local and production env values separate.
- Add banking/card/Hometax connector env only after security and product review.

## Documentation

The source of truth starts here:

- `docs/01_Concept_Design/01_PRODUCT_BASELINE.md`
- `docs/02_UI_Screens/01_MVP_UX_BASELINE.md`
- `docs/03_Technical_Specs/01_DEVELOPMENT_SETUP.md`
- `docs/04_Logic_Progress/00_BACKLOG.md`
- `docs/05_QA_Validation/01_MVP_QA_BASELINE.md`
