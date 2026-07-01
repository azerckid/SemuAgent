# JARYO Company MVP QA Baseline

## Setup QA

- Project can be installed with npm.
- `.env.local.example` contains placeholders only.
- `.env*` files except `.env.local.example` are ignored.
- `.agent/skills` is local-only and not committed.
- Root page loads without requiring database or auth env values.

## Product Boundary QA

- UI does not claim to automatically submit tax filings.
- UI does not ask for Hometax passwords, certificate passwords, bank passwords,
  or card-company passwords.
- Filing flow clearly shows company review/approval before submission.
- Generated filing materials remain editable/reviewable before use.

## Reuse QA

For every adapted JARYO-GIWA module:

- Accounting-firm-only terms are removed from company-facing UI.
- Tenant isolation is preserved.
- Data query filters remain company scoped.
- Tests are preserved or replaced with company-specific equivalents.
- Env validation stays strict for server-only features.

## Verification Commands

```bash
npm run lint
npm test
npm run build
```

Network-dependent package installation may require an approved network
environment before these checks can run locally.
