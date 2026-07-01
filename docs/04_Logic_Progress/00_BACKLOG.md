# JARYO Company Backlog

## Status Legend

- `todo`
- `doing`
- `done`
- `blocked`

## MVP Setup Backlog

| ID | Status | Task | Reuse Source | Acceptance Criteria |
|---|---|---|---|---|
| JC-001 | done | Initialize project from JARYO-GIWA reusable base | JARYO-GIWA root | Code/config copied without git metadata, env files, build artifacts, or old docs |
| JC-002 | done | Link local Solmate skills | solmate-skills | `.agent/skills` contains symlinks to local skill folders with `SKILL.md` |
| JC-003 | done | Switch package manager baseline to npm | package setup | README and PR template use npm commands; pnpm files removed |
| JC-004 | todo | Audit copied routes and rename accounting-firm assumptions | `app`, `lib`, `components` | Company self-use terminology and responsibility boundary are reflected in visible routes |
| JC-005 | todo | Define company tenant data model delta | `lib/db/schema.ts` | Company/operator model documented before DB migration |
| JC-006 | todo | Shape first working dashboard | `app/(dashboard)`, `components/ui` | Dashboard shows collection, bookkeeping, VAT, payroll, filing support status |
| JC-007 | todo | Define filing package model | bookkeeping/payroll modules | Filing material package can store generated docs, Hometax guide, receipt, and audit state |
| JC-008 | todo | Review residual npm audit findings | `package.json`, parser/import libraries | Decide replacements or mitigations for `xlsx`, `viem/ws`, `drizzle-kit/esbuild`, and Next/PostCSS audit advisories |

## Implementation Rule

Do not implement from a backlog row alone. Read the linked Concept, UI,
Technical, and QA docs first, then prepare a short implementation brief.
