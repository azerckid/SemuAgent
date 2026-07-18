# SemuAgent Docs
> Created: 2026-07-01 17:50
> Last Updated: 2026-07-18 19:34 KST

This documentation set defines SemuAgent, an AI-powered tax operations assistant
for small companies. The active filing product path is **Path 1**: SemuAgent fills
an official non-encrypted upload template accepted directly by Hometax or Witax,
the user reviews and downloads it, and the user uploads and submits it. Path 2
(direct A2A into the JARYO review queue, with ZIP only as fallback) is deferred until
Path 1 beta validation. Encrypted
or certified upload files formerly called Path 3 are outside the current product
scope.

## Layers

- `01_Concept_Design`: product scope, user, responsibility boundary
- `02_UI_Screens`: screen and flow design
- `03_Technical_Specs`: architecture, setup, integrations, data model
- `04_Logic_Progress`: backlog and implementation tracking
- `05_QA_Validation`: QA scenarios and release checks

JARYO-GIWA remains the primary code reuse source, but these documents decide
how reused code must be adapted for small-company self-use and AI-assisted
tax-preparation workflows.

## Related Documents
- **Concept_Design**: [Product Baseline — 3 Filing Paths](./01_Concept_Design/01_PRODUCT_BASELINE.md) · [Filing Preparation Pipeline](./01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md) · [Agent-to-Agent Tax Collaboration Master Plan](./01_Concept_Design/03_AGENT_TO_AGENT_TAX_COLLABORATION_MASTER_PLAN.md) · [Conversational Tax Workspace Product Direction](./01_Concept_Design/04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md) · [Sebiseo Operating Model](./01_Concept_Design/05_SEBISEO_OPERATING_MODEL.md)
- **Technical_Specs**: [App Theme System Pre-Code Brief](./03_Technical_Specs/64_JC045_APP_THEME_SYSTEM_PRE_CODE_BRIEF.md) · [Path 1 Form Fill Roadmap](./03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md) · [Withholding W0 Final Audit](./03_Technical_Specs/37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md) · [VAT Stage A Audit](./03_Technical_Specs/43_JC030_VAT_NONENCRYPTED_UPLOAD_TEMPLATE_AUDIT.md) · [Withholding Field Mapping](./03_Technical_Specs/38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md) · [Withholding Pre-Code Brief](./03_Technical_Specs/39_JC030_WITHHOLDING_EFILING_PRE_CODE_BRIEF.md) · [JC-034 ZIP Fallback Scope Gate](./03_Technical_Specs/34_JC034_GIWA_HANDOFF_PACKAGE_SCOPE_GATE.md) · [Open Backlog Completion Contracts](./03_Technical_Specs/22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- **UI_Screens**: [Screen Flow](./02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design](./02_UI_Screens/01_UI_DESIGN.md) · [MVP UX Baseline](./02_UI_Screens/01_MVP_UX_BASELINE.md)
- **Technical_Specs**: [Development Setup](./03_Technical_Specs/01_DEVELOPMENT_SETUP.md) · [Component & Library Plan](./03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [DB Schema](./03_Technical_Specs/03_DB_SCHEMA.md) · [Company Home Pre-Code Brief](./03_Technical_Specs/04_COMPANY_HOME_PRE_CODE_BRIEF.md)
- **Logic_Progress**: [Backlog](./04_Logic_Progress/00_BACKLOG.md)
- **QA_Validation**: [MVP QA Baseline](./05_QA_Validation/01_MVP_QA_BASELINE.md) · [App Theme System Test Scenarios](./05_QA_Validation/14_JC045_APP_THEME_SYSTEM_TEST_SCENARIOS.md)
