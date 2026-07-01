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
| JC-009 | todo | Build source collection workspace | `app/upload`, `lib/ai/extract`, `components/ui` | Company-internal upload → parse → normalize flow matches approved 자료수집 UI; external client portal excluded |

## Implementation Rule

Do not implement from a backlog row alone. Read the linked Concept, UI,
Technical, and QA docs first, then prepare a short implementation brief.

## Backlog Context Lock

구현 착수 전, 해당 backlog 항목은 아래 Context Lock을 충족해야 한다. Lock은
**사용자 확인이 끝난 UI**를 참조한다. 미충족 전제조건이 하나라도 남아 있으면 코드 구현을 시작하지 않는다.

### JC-006 · Shape first working dashboard (회사 홈)

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related UI Docs: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.1](../02_UI_Screens/01_UI_DESIGN.md) · [MVP UX Baseline](../02_UI_Screens/01_MVP_UX_BASELINE.md)
- Related HTML Preview: [00_company_home.html](../02_UI_Screens/previews/00_company_home.html)
- Related Technical Docs: [Component & Library Plan 7.1](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Prototype Review / 승인: [Company Home Review](../02_UI_Screens/02_COMPANY_HOME_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [x] Component & Library Plan 작성 (Layer 3, Component & Library Planning Gate) — [7.1 회사 홈 매핑](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
  - [ ] Pre-Code Technical Brief(데이터 소스·최소 필드·mutation·acceptance) 정리 — **미충족**
  - [ ] 회사 tenant/기간 데이터 모델 확정 (JC-005 선행)
- Document Sync Check: Screen Flow / UI Design / Prototype Review / Preview가 상호 링크됨 (2026-07-01 기준 일치)

### JC-009 · Build source collection workspace (자료수집) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related UI Docs: [Screen Flow 4b](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.2](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: [01_source_collection.html](../02_UI_Screens/previews/01_source_collection.html)
- Related Technical Docs: [Component & Library Plan 7.2](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Prototype Review / 승인: [Source Collection Review](../02_UI_Screens/03_SOURCE_COLLECTION_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [x] Component & Library Plan 작성 (업로드/파싱/정규화 컴포넌트·라이브러리) — [7.2 자료수집 매핑](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
  - [ ] Pre-Code Technical Brief(업로드 mutation·정규화 파이프라인·acceptance) 정리 — **미충족**
  - [ ] 외부 업로드 포털 제외 방침 반영한 업로드 라우트 재검토 (JC-004 연계)
- Document Sync Check: Screen Flow 4b / UI Design 4.2 / Prototype Review / Preview 상호 링크됨 (2026-07-01 기준 일치)

> 현재 두 항목 모두 **UI-First Gate 통과 + Component & Library Plan 완료**(Layer 3). 남은 구현 착수 전제조건은 **Pre-Code Technical Brief**(데이터 소스·최소 필드·mutation·acceptance)와 tenant/기간 데이터 모델(JC-005) 및 업로드 라우트 재검토(JC-004)다. 이들이 채워지기 전에는 코드 구현을 시작하지 않는다.
