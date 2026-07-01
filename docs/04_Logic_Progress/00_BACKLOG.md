# JARYO Company Backlog
> Created: 2026-07-01 17:57
> Last Updated: 2026-07-01 23:55

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
| JC-005 | doing | Define company tenant data model delta | `lib/db/schema.ts` | Company/operator model documented before DB migration — 설계: [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) (client→business_entity 재정의, 이메일 서브시스템 v1 제외). 물리 마이그레이션·부가세/신고 신규 테이블 컬럼은 후속 |
| JC-006 | done | Shape first working dashboard | `app/(dashboard)`, `components/ui` | Dashboard shows collection, bookkeeping, VAT, payroll, filing support status |
| JC-007 | todo | Define filing package model | bookkeeping/payroll modules | Filing material package can store generated docs, Hometax guide, receipt, and audit state |
| JC-008 | todo | Review residual npm audit findings | `package.json`, parser/import libraries | Decide replacements or mitigations for `xlsx`, `viem/ws`, `drizzle-kit/esbuild`, and Next/PostCSS audit advisories |
| JC-009 | todo | Build source collection workspace | `app/upload`, `lib/ai/extract`, `components/ui` | Company-internal upload → parse → normalize flow matches approved 자료수집 UI; external client portal excluded |
| JC-010 | todo | Build bookkeeping review workspace | `lib/bookkeeping`, `lib/ai`, `components/ui` | Transaction classification queue with AI-suggested accounts, confidence, journal-entry preview, and company approval matches approved 기장검토 UI |
| JC-011 | todo | Build VAT workspace | `lib/bookkeeping`, `components/ui` | VAT summary (output−input tax), taxable/zero/exempt grouping, purchase-deduction review, schedules, and filing-package preview (generation locked until deduction review complete) match approved 부가세 UI; no auto Hometax submission |
| JC-012 | todo | Build payroll workspace | `lib/payroll`, `components/ui` | Payroll register with derived totals, withholding/4-insurance deduction, payslip/statement preview, and close (locked until missing-employee issues resolved) match approved 급여 UI; PII masking applied |
| JC-013 | todo | Build filing support workspace | `lib/bookkeeping`, `lib/payroll`, `components/ui` | Filing items (VAT/withholding/insurance) with packages, Hometax step-by-step input guide, receipt storage, and post-filing checklist match approved 신고지원 UI; no auto submission/payment |

## Implementation Rule

Do not implement from a backlog row alone. Read the linked Concept, UI,
Technical, and QA docs first, then prepare a short implementation brief.

## Backlog Context Lock

구현 착수 전, 해당 backlog 항목은 아래 Context Lock을 충족해야 한다. Lock은
**사용자 확인이 끝난 UI**를 참조한다. 미충족 전제조건이 하나라도 남아 있으면 코드 구현을 시작하지 않는다.

### JC-005 · Define company tenant data model delta

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related UI Docs: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: [00_company_home.html](../02_UI_Screens/previews/00_company_home.html) · [01_source_collection.html](../02_UI_Screens/previews/01_source_collection.html) · [02_bookkeeping_review.html](../02_UI_Screens/previews/02_bookkeeping_review.html) · [03_vat.html](../02_UI_Screens/previews/03_vat.html) · [04_payroll.html](../02_UI_Screens/previews/04_payroll.html) · [05_filing_support.html](../02_UI_Screens/previews/05_filing_support.html)
- Related Technical Docs: [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
- Related QA Docs: 테넌트 격리·기간 필터는 [Company Home Test Scenarios](../05_QA_Validation/02_COMPANY_HOME_TEST_SCENARIOS.md) S-41·S-42에서 일부 검증. 부가세/신고 신규 테이블·물리 마이그레이션 검증 시나리오는 JC-005 후속에서 추가.
- Prototype Review / 승인: 6개 승인 Preview(회사 홈·자료수집·기장검토·부가세·급여·신고지원)의 데이터 요구사항을 DB Schema에 반영.
- Implementation Preconditions:
  - [x] HTML UI Preview 사용자 확인 및 피드백 기록 반영(6/6 승인)
  - [x] 화면/UI 선확인, 사용자 동선 확인, 데이터 흐름 확인, 로딩·빈 상태·오류 상태 확인
  - [x] 기존 Drizzle 앱 스키마(`lib/db/schema.ts` 56개 테이블)와 Auth 스키마(`lib/db/auth-schema.ts` 7개 테이블) 조사
  - [x] `client` → `business_entity` 개념 전환 방침 문서화
  - [x] 이메일 요청·수신함 서브시스템 v1 제외 방침 문서화
  - [ ] `business_entity` 물리 rename 여부와 마이그레이션 순서 확정 — **미충족**
  - [ ] 부가세·신고지원 신규 테이블 컬럼·인덱스·FK 확정 — **미충족**
  - [ ] 과세기간·귀속월·전표 기간 표현 모델 확정 — **미충족**
  - [ ] QA 테스트 시나리오 작성 (Layer 5) — **미충족**
- Acceptance Criteria:
  - [x] 6개 승인 화면의 데이터 요구사항이 기존 테이블 재사용/신규 테이블 필요성으로 매핑된다.
  - [x] 회사 셀프사용 컨텍스트에서 `clientId`의 개념 전환(`businessEntityId`)이 명시된다.
  - [x] v1 제외 테이블과 제외 사유가 제품 범위와 일치한다.
  - [ ] 실제 Drizzle 스키마 변경안과 마이그레이션 순서가 확정된다.
  - [ ] 부가세·신고지원 테이블의 최소 컬럼, FK, 인덱스가 구현 가능한 수준으로 확정된다.
- Document Sync Check: DB Schema / Backlog / 6개 승인 Preview의 데이터 요구사항을 상호 링크함 (2026-07-01 기준, 물리 마이그레이션은 후속)

### JC-006 · Shape first working dashboard (회사 홈)

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related UI Docs: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.1](../02_UI_Screens/01_UI_DESIGN.md) · [MVP UX Baseline](../02_UI_Screens/01_MVP_UX_BASELINE.md)
- Related HTML Preview: [00_company_home.html](../02_UI_Screens/previews/00_company_home.html)
- Related Technical Docs: [Component & Library Plan 7.1](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) · [Company Home Pre-Code Brief](../03_Technical_Specs/04_COMPANY_HOME_PRE_CODE_BRIEF.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Related QA Docs: [Company Home Test Scenarios](../05_QA_Validation/02_COMPANY_HOME_TEST_SCENARIOS.md) - 대시보드 렌더·기간 파생·범위 격리·상태·제외 테이블 검증 시나리오
- Prototype Review / 승인: [Company Home Review](../02_UI_Screens/02_COMPANY_HOME_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [x] Component & Library Plan 작성 (Layer 3, Component & Library Planning Gate) — [7.1 회사 홈 매핑](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
  - [x] Pre-Code Technical Brief(데이터 소스·최소 필드·mutation·acceptance) 정리 — [Company Home Pre-Code Brief](../03_Technical_Specs/04_COMPANY_HOME_PRE_CODE_BRIEF.md)
  - [x] 회사 tenant/기간 데이터 모델 설계 확인 — [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) 기준 `client`를 `business_entity`로 개념 전환, 기간은 URL context/read model로 처리
  - [x] QA 테스트 시나리오 작성 (Layer 5) — [Company Home Test Scenarios](../05_QA_Validation/02_COMPANY_HOME_TEST_SCENARIOS.md)
- Acceptance Criteria:
  - [x] 로그인 직후 회사 홈(대시보드)으로 진입한다(마케팅 페이지 아님).
  - [x] 현재 회계기간 상태·마감 D-day·준비 현황 카드·최근 제출/영수증이 승인된 화면 구조대로 표시된다.
  - [x] "다음 할 일" CTA가 미수집·미분류·급여 확인 필요 상태에 따라 자료수집·기장검토·급여로 라우팅된다. 부가세/신고지원은 전용 React 라우트가 후속 JC-011/JC-013 범위라 현재 준비 현황 카드에서 회사 홈 섹션 앵커로 연결한다.
  - [x] 로딩·빈·오류 상태가 화면에 구현된다.
  - [x] 대시보드는 읽기 전용이며 데이터 mutation을 수행하지 않는다.
  - [x] 회사 홈 데이터 로더는 v1 제외 테이블(`client_request_event`, `outbound_email`, `inbound_email`, `staff_mailbox`)을 참조하지 않는다.
- Document Sync Check: Screen Flow / UI Design / Prototype Review / Preview / Component Plan / DB Schema / Pre-Code Brief / QA Scenarios가 상호 링크됨. 구현 파일: `lib/company-home/summary.ts`, `app/(dashboard)/dashboard/page.tsx`, `app/(dashboard)/dashboard/_components/company-home.tsx`, `app/(dashboard)/dashboard/loading.tsx`, `app/(dashboard)/dashboard/error.tsx` (2026-07-01 기준 일치)
- Follow-up (JC-006 범위 밖 · 후속 이관): PR #2 리뷰에서 도출, JC-006 머지를 막지 않음.
  - [ ] Hero 진행률 의미 확장: 현재 "기간 경과(deadlineProgress)" → VAT/기장/급여 read model 성숙 후 "업무 준비율" 합성 지표 설계 (후속 JC).
  - [ ] payroll issue count의 latest-batch 스코프 정합: S-33 Given 문구와 구현 정렬 → 급여 워크스페이스(JC-012)에서 batch 스코프와 함께 수정. MVP 과대 카운트 리스크 낮음.
  - [ ] `?period=` Zod 스키마 + loader 통합 테스트: 현재 regex fallback으로 안전. 단독 chore PR 권장.
  - [ ] layout/page의 session·redirect 중복 정리: tenant 없음 레이아웃 동작 재검증 필요하여 JC-006과 분리(별도 chore).

### JC-009 · Build source collection workspace (자료수집) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related UI Docs: [Screen Flow 4b](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.2](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: [01_source_collection.html](../02_UI_Screens/previews/01_source_collection.html)
- Related Technical Docs: [Component & Library Plan 7.2](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [Source Collection Pre-Code Brief](../03_Technical_Specs/05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Related QA Docs: [Source Collection Test Scenarios](../05_QA_Validation/03_SOURCE_COLLECTION_TEST_SCENARIOS.md) - 업로드·파싱 mutation·JC-004 슬라이스·범위 격리 검증
- Prototype Review / 승인: [Source Collection Review](../02_UI_Screens/03_SOURCE_COLLECTION_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [x] Component & Library Plan 작성 (업로드/파싱/정규화 컴포넌트·라이브러리) — [7.2 자료수집 매핑](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
  - [x] Pre-Code Technical Brief(업로드 mutation·정규화 파이프라인·acceptance) 정리 — [Source Collection Pre-Code Brief](../03_Technical_Specs/05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md)
  - [x] 외부 업로드 포털 제외 방침 반영한 업로드 라우트 재검토 (JC-004 연계, JC-009 범위 슬라이스) — Brief §3
  - [x] QA 테스트 시나리오 작성 (Layer 5) — [Source Collection Test Scenarios](../05_QA_Validation/03_SOURCE_COLLECTION_TEST_SCENARIOS.md)
- Acceptance Criteria:
  - [ ] 회사 내부 사용자가 XLSX/CSV/PDF/이미지/ZIP을 업로드하면 파싱→정규화 큐에 등록된다.
  - [ ] 자료유형(세금계산서/통장/카드/영수증)별 집계와 정규화 상태가 표시된다.
  - [ ] 파싱 오류 건은 danger 상태로 표시되고 재시도할 수 있다.
  - [ ] 수집 완결성(미수집 건수)과 미수집·확인 필요 목록이 표시된다.
  - [ ] 외부 고객 업로드 포털은 노출되지 않는다(내부 업로드만).
  - [ ] 로딩·빈·오류 상태가 화면에 구현된다.
- Document Sync Check: Screen Flow 4b / UI Design 4.2 / Prototype Review / Preview / Component Plan 7.2 / Pre-Code Brief / QA Scenarios 상호 링크됨 (2026-07-01 게이트 기준). 구현 파일은 착수 후 갱신.

### JC-010 · Build bookkeeping review workspace (기장검토) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related UI Docs: [Screen Flow 4c](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.3](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: [02_bookkeeping_review.html](../02_UI_Screens/previews/02_bookkeeping_review.html)
- Related Technical Docs: [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Related QA Docs: N/A - Layer 5 QA 문서 미작성. 구현 착수 전 분류·승인·분개 전표 테스트 시나리오 추가 필요(전제조건에 반영).
- Prototype Review / 승인: [Bookkeeping Review](../02_UI_Screens/04_BOOKKEEPING_REVIEW_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [ ] Component & Library Plan에 기장검토 전용 컴포넌트(Confidence Bar·Journal Entry Preview) 반영 — **미충족**
  - [ ] Pre-Code Technical Brief(분류 큐 데이터 소스·AI 추천 신뢰도·승인 mutation·전표 확정) 정리 — **미충족**
  - [ ] 회사 tenant/기간·전표 데이터 모델 확정 (JC-005 연계) — **미충족**
  - [ ] QA 테스트 시나리오 작성 (Layer 5) — **미충족**
- Acceptance Criteria:
  - [ ] 정규화된 거래가 분류 큐에 AI 추천 계정과목·신뢰도와 함께 표시된다.
  - [ ] 신뢰도 낮은 거래는 승인 전 "계정 지정"으로 강제 확인된다.
  - [ ] 개별·다중(일괄) 승인이 가능하고 승인 시 확정 전표로 이동한다.
  - [ ] 선택 거래의 분개 미리보기(차/대변, 부가세대급금 포함)와 기간 귀속·부가세 공제가 표시된다.
  - [ ] AI 추천은 초안이며 최종 확정 책임은 사용자에게 있다.
  - [ ] 로딩·빈·오류 상태가 화면에 구현된다.
- Document Sync Check: Screen Flow 4c / UI Design 4.3 / Prototype Review / Preview 상호 링크됨 (2026-07-01 기준 일치)

### JC-011 · Build VAT workspace (부가세) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related UI Docs: [Screen Flow 4d](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.4](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: [03_vat.html](../02_UI_Screens/previews/03_vat.html)
- Related Technical Docs: [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Related QA Docs: N/A - Layer 5 QA 문서 미작성. 구현 착수 전 세액 집계·공제 판정·안분·패키지 생성 잠금 테스트 시나리오 추가 필요(전제조건에 반영).
- Prototype Review / 승인: [VAT Review](../02_UI_Screens/05_VAT_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [ ] Component & Library Plan에 부가세 전용 컴포넌트(Tax Summary·Deduction Review·잠금 버튼 래퍼) 반영 — **미충족**
  - [ ] Pre-Code Technical Brief(확정 전표 집계·공제 판정·공통매입 안분·패키지 생성 mutation) 정리 — **미충족**
  - [ ] 회사 tenant/기간·전표 데이터 모델 확정 (JC-005 연계, 기장검토 확정 전표 선행) — **미충족**
  - [ ] QA 테스트 시나리오 작성 (Layer 5) — **미충족**
- Acceptance Criteria:
  - [ ] 확정 전표 기준 매출세액·매입세액·납부(예정)세액이 집계·표시된다.
  - [ ] 매출이 과세/영세율/면세로 구분되어 그룹별 공급가액·세액이 표시된다.
  - [ ] 불공제 후보·공통매입 안분 대상이 표시되고 사용자가 공제/불공제/안분을 확정한다.
  - [ ] 부속 명세 준비 상태가 표시된다.
  - [ ] 신고 패키지 생성 버튼은 공제 검토 완료 전까지 잠금(disabled + aria-disabled)이며, 사유가 함께 노출된다. React 구현 시 disabled 버튼을 래퍼로 감싸 툴팁을 접근성 있게 처리한다.
  - [ ] 자동 홈택스 제출은 제공하지 않는다(패키지 + 입력 가이드까지). 세액은 검토 완료 전 "예정" 표기.
  - [ ] 로딩·빈·오류 상태가 화면에 구현된다.
- Document Sync Check: Screen Flow 4d / UI Design 4.4 / Prototype Review / Preview 상호 링크됨 (2026-07-01 기준 일치)

### JC-012 · Build payroll workspace (급여) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related UI Docs: [Screen Flow 4e](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.5](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: [04_payroll.html](../02_UI_Screens/previews/04_payroll.html)
- Related Technical Docs: [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Related QA Docs: N/A - Layer 5 QA 문서 미작성. 구현 착수 전 급여 계산 정합성·공제·마감 잠금·PII 마스킹 테스트 시나리오 추가 필요(전제조건에 반영).
- Prototype Review / 승인: [Payroll Review](../02_UI_Screens/06_PAYROLL_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [ ] Component & Library Plan에 급여 전용 컴포넌트(Payroll Register·Deduction Breakdown·마감 잠금 래퍼) 반영 — **미충족**
  - [ ] Pre-Code Technical Brief(급여 입력·공제 계산·마감 mutation·PII 처리) 정리 — **미충족**
  - [ ] 회사 tenant·직원·급여 데이터 모델 확정 (JC-005 연계) — **미충족**
  - [ ] 개인정보(급여·주민정보) 접근 권한·마스킹·감사로그 방침 확정 — **미충족**
  - [ ] QA 테스트 시나리오 작성 (Layer 5) — **미충족**
- Acceptance Criteria:
  - [ ] 급여대장이 직원별 기본급·수당·지급계·원천세·4대보험·공제계·실지급으로 표시된다.
  - [ ] 금액은 파생 계산으로 정합한다: 지급계=기본급+수당, 공제계=원천세+4대보험, 실지급=지급계−공제계, 합계=각 열의 합.
  - [ ] 원천세·4대보험 공제 상세가 항목별로 집계·표시된다.
  - [ ] 확인 필요(오류/누락) 직원이 표시되고, 처리 전에는 급여 마감 버튼이 잠금(disabled + aria-disabled)이다. React 구현 시 래퍼 툴팁 처리.
  - [ ] 급여명세서·지급명세서를 미리보기/생성하고, 원천징수 지급명세서는 신고지원으로 전달한다.
  - [ ] 개인정보는 권한에 따라 마스킹된다.
  - [ ] 로딩·빈·오류 상태가 화면에 구현된다.
- Document Sync Check: Screen Flow 4e / UI Design 4.5 / Prototype Review / Preview 상호 링크됨 (2026-07-01 기준 일치)

### JC-013 · Build filing support workspace (신고지원) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) — MVP 비범위(자동 홈택스 제출 제외)
- Related UI Docs: [Screen Flow 4f](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.6](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: [05_filing_support.html](../02_UI_Screens/previews/05_filing_support.html)
- Related Technical Docs: [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Related QA Docs: N/A - Layer 5 QA 문서 미작성. 구현 착수 전 신고 항목 연동·패키지 생성·접수증 보관·책임 경계(자동 제출 없음) 테스트 시나리오 추가 필요(전제조건에 반영).
- Prototype Review / 승인: [Filing Support Review](../02_UI_Screens/07_FILING_SUPPORT_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [ ] Component & Library Plan에 신고지원 전용 컴포넌트(Filing Item Card·Input Guide·Receipts·Checklist) 반영 — **미충족**
  - [ ] Pre-Code Technical Brief(신고 항목 연동·패키지 생성·접수증 보관·체크리스트 mutation) 정리 — **미충족**
  - [ ] 부가세(JC-011)·급여(JC-012) 산출물 데이터 모델 선행 — **미충족**
  - [ ] QA 테스트 시나리오 작성 (Layer 5) — **미충족**
- Acceptance Criteria:
  - [ ] 신고 항목(부가세/원천세/4대보험)이 선행 화면 산출물과 연동되어 상태와 함께 표시된다.
  - [ ] 부가세 패키지는 공제 검토 완료 전 잠금이다.
  - [ ] 홈택스 단계별 입력 가이드가 확정 값과 함께 제공되고 값 복사가 가능하다.
  - [ ] 제출 접수증을 업로드·보관하고 미제출 항목은 대기로 표시된다.
  - [ ] 사후 체크리스트로 납부·보관을 확인한다.
  - [ ] **자동 홈택스 제출·자동 납부·자격증명 서버 저장은 제공하지 않는다**(책임 경계를 화면에 반복 노출).
  - [ ] 로딩·빈·오류 상태가 화면에 구현된다.
- Document Sync Check: Screen Flow 4f / UI Design 4.6 / Prototype Review / Preview 상호 링크됨 (2026-07-01 기준 일치)

> 현재 여섯 항목 모두 **UI-First Gate 통과 (UI 6/6 완료)**. JC-005는 DB Schema 설계 초안을 완료했으나 물리 마이그레이션·부가세/신고 신규 테이블 컬럼·기간 모델 확정은 남아 있다. JC-006은 회사 홈 구현·머지 완료. JC-009는 Pre-Code Brief·JC-004 업로드 슬라이스·Layer 5 QA 시나리오까지 게이트 충족 — **구현 착수 가능**. JC-010~013은 Pre-Code Brief·QA 미작성. JC-004 전체 라우트 감사는 `todo` 유지(JC-009 §3은 업로드 슬라이스만 완료). 남은 공통 구현 착수 전제조건은 JC-010~013 **Pre-Code Brief**, JC-005 후속(기장·부가세·신고 구현 전), JC-012 개인정보 마스킹 방침, **Layer 5 QA**(JC-006·JC-009 완료, 나머지 미작성)이다.

## Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 MVP 범위
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 화면 흐름·컴포넌트(Context Lock 참조 대상)
- **UI_Screens**: [HTML Preview 폴더](../02_UI_Screens/previews/) - 승인된 화면 프로토타입(6화면)
- **Technical_Specs**: [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) - 스택 및 컴포넌트 계획
- **QA_Validation**: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md) - 검증 기준(Acceptance 연계)
