# SemuDesk MVP QA Baseline
> Created: 2026-07-01 17:57
> Last Updated: 2026-07-01 17:57

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

## Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 검증 대상 제품 범위
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 화면·상태 검증 기준
- **Technical_Specs**: [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) - 린트·타입·빌드 기준
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - 각 JC 항목 Acceptance Criteria(테스트 시나리오 대상)
