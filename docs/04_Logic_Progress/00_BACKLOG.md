# SemuAgent Backlog
> Created: 2026-07-01 17:57
> Last Updated: 2026-07-04 01:43

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
| JC-004 | done | Audit copied routes and rename accounting-firm assumptions | `app`, `lib`, `components` | Company self-use terminology and responsibility boundary are reflected in visible routes. 노출 표면 정리(설정 GIWA 'CC 참조메일' 탭 제거) + dead GIWA 컴포넌트 삭제. 레거시 GIWA 워크플로 라우트 6종(sessions·reviews·emails·calendar·checklists·law-search) 및 사업장 하위 GIWA 요청 라우트(events·schedules·request-templates·payroll-requests) redirect 차단. `clients`(=사업장 등록·관리, v1 필수)·`billing`(=요금제)은 기능 유지. clients 화면 용어 사업장화(고객사→사업장). 설정 업무메일 탭 정리(work-email '사무소'→'회사', GIWA 고객 리마인더-days 섹션 제거). 사업장 상세(clients/[id]) GIWA 탭 제거(사업장 문서·사내급여기준·법적기준만 유지). jaryo-admin은 GIWA 잔재가 아니라 JARYO 플랫폼 운영자 콘솔로, `requireJaryoAdminSession`(operator allowlist, 비허용 이메일 404) 가드 + 테넌트 제품 미링크로 이미 격리됨 — 코드 조치 불필요(감사 완료). PR #21~#25 |
| JC-005 | done | Define company tenant data model delta | `lib/db/schema.ts` | 데이터 모델 델타 확정 — [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md): client→business_entity 재정의(물리명 `client` 유지·rename 지연, §2.1), 이메일 서브시스템 v1 제외(§2.2), 기간 표현 도메인별 canonical(§2.4). 신규 도메인 물리 migration 0053~0057 순차 적용 완료 |
| JC-006 | done | Shape first working dashboard | `app/(dashboard)`, `components/ui` | Dashboard shows collection, bookkeeping, VAT, payroll, filing support status |
| JC-007 | done | Define filing package model | `lib/filing-support`, `lib/db/schema.ts` | JC-013 신고지원 도메인으로 실현: `filing_item`(packageStatus·packageStorageKey·generatedAt·submittedAt)로 생성 문서/감사 상태, `filing_receipt`로 접수증, `filing_checklist_item`로 사후 상태 저장. Hometax guide는 확정값에서 파생 계산(저장 아님), 실제 PDF 생성은 deferred(storage key 준비). 별도 package 모델은 JC-013 중복이라 미신설 |
| JC-008 | done | Review residual npm audit findings | `package.json`, parser/import libraries | `npm audit` 0건 달성. `xlsx`→SheetJS 공식 CDN 0.20.3 핀(prototype pollution·ReDoS 수정, API 동일). `ws`^8.21.0·`postcss`^8.5.10 overrides 유지. 오래된 `@esbuild-kit/core-utils`의 `esbuild ~0.18.20`만 `^0.25.0`으로 좁게 override하고, Vite/tsx peer는 root `esbuild`^0.28.0으로 충족해 `npm ls` 정합성 확보. viem은 http 전송만 사용해 ws DoS 미도달, drizzle-kit 정상 검증 |
| JC-009 | done | Build source collection workspace | `app/(dashboard)/dashboard/direct-upload`, `lib/source-collection`, `components/ui` | Company-internal upload → parse → normalize flow matches approved 자료수집 UI; external client portal excluded (PR #4 머지) |
| JC-010 | done | Build bookkeeping review workspace | `lib/bookkeeping`, `lib/ai`, `components/ui` | Transaction classification queue with AI-suggested accounts, confidence, journal-entry preview, and company approval matches approved 기장검토 UI |
| JC-011 | done | Build VAT workspace | `lib/bookkeeping`, `components/ui` | VAT summary (output−input tax), taxable/zero/exempt grouping, purchase-deduction review, schedules, and filing-package preview (generation locked until deduction review complete) match approved 부가세 UI; no auto Hometax submission |
| JC-012 | done | Build payroll workspace | `lib/payroll-workspace`, `app/(dashboard)/dashboard/payroll`, `app/api/payroll` | Payroll register with derived totals, withholding/4-insurance deduction, insurance notice manual input/match, payslip/statement preview, and close guard match approved 급여 UI; PII raw fields/storage keys not exposed |
| JC-013 | done | Build filing support workspace | `lib/filing-support`, `app/(dashboard)/dashboard/filing-support`, `app/api/filing` | Filing items (VAT/withholding/insurance) with packages, Hometax step-by-step input guide, receipt storage, and post-filing checklist match approved 신고지원 UI; no auto submission/payment |
| JC-014 | done | Provision env secrets and verify upload→parse E2E | `.env`, Vercel Blob, AI providers | 착수 전 정리 완료: `.env.local`의 Blob 토큰 중복 제거·`JARYO_ADMIN_EMAILS` 실운영자값·`EMAIL_FROM` 브랜드(SemuAgent). 실제 자격증명 E2E 통과(2026-07-03): 파일→Vercel Blob(private) put/get 바이트 일치→텍스트추출→AI 파싱→`analysis_run` 3건 정규화 저장→상태 전이(needs_review). Gemini·Claude는 "급여대장" high confidence 합의(consensus=medium), 파일 매칭용 checklist 미보유로 material_match 0. **미해결: OPENAI_API_KEY 429(quota/billing) — 3-provider 합의 복구하려면 OpenAI 결제 충전 필요(파이프라인은 2/3로 graceful 동작 확인).** |
| JC-015 | done | Build employee directory | `lib/employee-directory`, `app/(dashboard)/dashboard/employees`, `app/api/employees` | 직원 명부를 급여 실행 결과와 분리된 마스터로 관리. read model·화면·추가/수정 API·0056 migration 구현 완료. 급여 line은 `employee_code` 읽기 전용 최근 귀속월 매칭으로 연결하며, 리마인드 직원 수신자 연동은 JC-018 후속 |
| JC-016 | done | Build internal reminder mail | `lib/internal-reminders`, `app/(dashboard)/dashboard/reminders`, `app/api/internal-reminders` | 내부 staff/본인 수신 기반 리마인드 read model·화면·토글/테스트 발송/즉시 발송 API·0057 migration 구현 완료. Vercel Cron 자동 예약은 JC-017, 직원 명부 기반 직원 수신은 JC-018 후속 |
| JC-017 | todo | Schedule internal reminder cron | `app/api/cron/reminder`, `vercel.json`, `lib/internal-reminders` | Vercel Cron이 신규 내부 리마인드 발송 흐름을 실행한다. 레거시 세션/outboundEmail 기반 cron과 회사 v1 내부 리마인드 책임을 분리하고, idempotency·발송 로그·provider missing 처리를 검증한다. |
| JC-018 | todo | Connect employee directory recipients to reminders | `lib/internal-reminders`, `lib/employee-directory`, `employee_profile` | `employee_profile.work_email`과 `notification_enabled`를 내부 리마인드 수신자 후보로 연결한다. 직원 수신자는 비활성/이메일 없음/알림 꺼짐 상태를 제외하고, 기존 담당자 본인·staff 수신 정책과 충돌하지 않는다. |
| JC-019 | doing | Provide first-run sample workspace data | onboarding, approved previews, workspace read models | 신규 테넌트가 가입 직후 승인 Preview와 같은 샘플 업무 데이터를 보고 메뉴 구조를 이해할 수 있다. 샘플 데이터는 명확히 표시되고, 실사용 전 사용자가 한 번에 삭제할 수 있어야 한다. 구현 PR 진행 중 — browser E2E 전까지 doing 유지. |
| JC-020 | done | Fix signup-to-onboarding routing | `app/(auth)/sign-up`, `app/(auth)/sign-in`, `app/(dashboard)/layout.tsx`, `app/onboarding` | 신규 가입자가 tenant/organization이 없는 상태에서 깨진 dashboard/clients 화면으로 이동하지 않고 `/onboarding`으로 안내된다. 기존 tenant가 있는 사용자는 기존 대시보드 진입을 유지한다. **구현(2026-07-04)**: sign-up→`/onboarding`, sign-in은 org 있으면 setActive 후 dashboard·없으면 `/onboarding`, dashboard layout은 활성 테넌트 없으면 `/onboarding` redirect(깨진 children 렌더 제거), onboarding은 이미 org 있는 사용자를 setActive 후 dashboard로 자기교정. |
| JC-021 | todo | Remove remaining JARYO brand residue from first-run UX | signup welcome modal, onboarding copy, domain suffix | 프로덕션 첫 가입 흐름에서 `JARYO beta` 모달·`.jaryo.kr` 서브도메인 접미사 등 잔여 브랜드가 SemuAgent 문맥으로 정리된다. 상류 JARYO-GIWA 이력 문구와 운영자 콘솔 식별자는 범위 밖이다. |
| JC-022 | todo | Refine settings screen product language | `app/(dashboard)/dashboard/settings`, `app/onboarding`, `app/api/settings` | 설정 화면의 개발자/상류 용어(`테넌트`, `.jaryo.kr`)를 사용자가 이해하는 회사/사업자 문맥으로 정리한다. 설정 정보구조는 회사 정보·담당자·업무메일·사업장 관리가 SemuAgent 제품 책임과 맞게 보이도록 재검토한다. |

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
- Related QA Docs: 테넌트 격리·기간 필터는 [Company Home Test Scenarios](../05_QA_Validation/02_COMPANY_HOME_TEST_SCENARIOS.md) S-41·S-42에서 일부 검증. 부가세 논리 모델 검증은 [VAT Test Scenarios](../05_QA_Validation/05_VAT_TEST_SCENARIOS.md), 신고지원 테이블·책임 경계 검증은 [Filing Support Test Scenarios](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)에 추가.
- Prototype Review / 승인: 6개 승인 Preview(회사 홈·자료수집·기장검토·부가세·급여·신고지원)의 데이터 요구사항을 DB Schema에 반영.
- Implementation Preconditions:
  - [x] HTML UI Preview 사용자 확인 및 피드백 기록 반영(6/6 승인)
  - [x] 화면/UI 선확인, 사용자 동선 확인, 데이터 흐름 확인, 로딩·빈 상태·오류 상태 확인
  - [x] 기존 Drizzle 앱 스키마(`lib/db/schema.ts` 56개 테이블)와 Auth 스키마(`lib/db/auth-schema.ts` 7개 테이블) 조사
  - [x] `client` → `business_entity` 개념 전환 방침 문서화
  - [x] 이메일 요청·수신함 서브시스템 v1 제외 방침 문서화
  - [x] 부가세 신규 테이블 논리 컬럼 확정 — [DB Schema 4.1](../03_Technical_Specs/03_DB_SCHEMA.md), [VAT Pre-Code Brief](../03_Technical_Specs/07_VAT_PRE_CODE_BRIEF.md)
  - [x] `business_entity` 물리 rename 여부와 마이그레이션 순서 확정 — 물리명 `client` 유지(개념만 business_entity), rename 지연 결정 [DB Schema 2.1](../03_Technical_Specs/03_DB_SCHEMA.md). 신규 도메인 물리 migration은 0053~0057 순차 적용 완료
  - [x] 부가세 물리 Drizzle migration·인덱스·FK 적용 — `lib/db/schema.ts`, `drizzle/0053_add_vat_tables.sql`
  - [x] 급여 물리 Drizzle migration·인덱스·FK 적용 — `lib/db/schema.ts`, `drizzle/0054_add_payroll_workspace_tables.sql`
  - [x] 신고지원 신규 테이블 컬럼·인덱스·FK 확정 — [DB Schema 4.3](../03_Technical_Specs/03_DB_SCHEMA.md), [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md)
  - [x] 과세기간·귀속월·전표 기간 표현 모델 확정 — 도메인별 canonical(부가세·신고 반기 `YYYY-H`, 급여 월 `YYYY-MM`, 전표 회계연도+월, filing dual-key 브리지) [DB Schema 2.4](../03_Technical_Specs/03_DB_SCHEMA.md)
  - [x] QA 테스트 시나리오 작성 (Layer 5) — [Filing Support Test Scenarios](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
- Acceptance Criteria:
  - [x] 6개 승인 화면의 데이터 요구사항이 기존 테이블 재사용/신규 테이블 필요성으로 매핑된다.
  - [x] 회사 셀프사용 컨텍스트에서 `clientId`의 개념 전환(`businessEntityId`)이 명시된다.
  - [x] v1 제외 테이블과 제외 사유가 제품 범위와 일치한다.
  - [x] 실제 Drizzle 스키마 변경안과 마이그레이션 순서가 확정된다 — 신규 도메인 물리 migration 0053(부가세)·0054(급여)·0055(신고지원)·0056(직원명부)·0057(리마인드) 순차 적용, `client` 물리 rename은 지연.
  - [x] 부가세 테이블의 최소 논리 컬럼이 구현 가능한 수준으로 확정된다.
  - [x] 부가세 물리 FK/인덱스가 구현 가능한 수준으로 확정되어 migration에 반영된다.
  - [x] 신고지원 테이블의 최소 컬럼, FK, 인덱스가 구현 가능한 수준으로 확정된다.
- Document Sync Check: DB Schema / Backlog / 6개 승인 Preview의 데이터 요구사항을 상호 링크함 (2026-07-03 기준, `client` 물리명 유지·rename 지연 결정, 도메인별 기간 canonical, 신규 도메인 migration 0053~0057 반영)

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
  - [x] "다음 할 일" CTA가 미수집·미분류·급여 확인 필요 상태에 따라 자료수집·기장검토·급여로 라우팅된다. 부가세·급여는 전용 React route로 연결됐고, 신고지원은 후속 JC-013 implementation 범위다.
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
  - [x] 회사 내부 사용자가 XLSX/CSV/PDF/이미지/ZIP을 업로드하면 파싱→정규화 큐에 등록된다. — 실제 자격증명 E2E 검증 완료(JC-014, 2026-07-03): Vercel Blob(private) 저장·재읽기, AI 파싱, `analysis_run` 정규화 저장, 상태 전이까지 통과.
  - [x] 자료유형(세금계산서/통장/카드/영수증)별 집계와 정규화 상태가 표시된다. (read model + UI 구현, summary.test.ts 단위 검증; 실데이터 표시는 미검증)
  - [x] 파싱 오류 건은 danger 상태로 표시되고 재시도할 수 있다. (`canRetry` 단위 검증 + UI)
  - [x] 수집 완결성(미수집 건수)과 미수집·확인 필요 목록이 표시된다. (단위 검증 + UI)
  - [x] 외부 고객 업로드 포털은 노출되지 않는다(내부 업로드만). (source-collection.test.ts S-70 정적 검증)
  - [x] 로딩·빈·오류 상태가 화면에 구현된다. (`loading.tsx`/`error.tsx` + 빈 상태)
- Document Sync Check: Screen Flow 4b / UI Design 4.2 / Prototype Review / Preview / Component Plan 7.2 / Pre-Code Brief / QA Scenarios 상호 링크됨. 구현 파일(머지 완료): `lib/source-collection/summary.ts`, `app/(dashboard)/dashboard/direct-upload/page.tsx`, `_components/source-collection.tsx`, `_components/source-collection-upload.tsx`, `loading.tsx`, `error.tsx` (PR #4·#5). 실제 Blob·AI E2E 검증 완료(JC-014, 2026-07-03).

### JC-010 · Build bookkeeping review workspace (기장검토) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related UI Docs: [Screen Flow 4c](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.3](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: [02_bookkeeping_review.html](../02_UI_Screens/previews/02_bookkeeping_review.html)
- Related Technical Docs: [Component & Library Plan 7.3](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [Bookkeeping Review Pre-Code Brief](../03_Technical_Specs/06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md) · [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Related QA Docs: [Bookkeeping Review Test Scenarios](../05_QA_Validation/04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md) - 분류 큐 집계·신뢰도·승인 mutation·Preview 계약·범위 격리 검증
- Prototype Review / 승인: [Bookkeeping Review](../02_UI_Screens/04_BOOKKEEPING_REVIEW_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [x] Component & Library Plan에 기장검토 전용 컴포넌트(Confidence Bar·Journal Entry Preview) 반영 — [7.3 기장검토 매핑](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
  - [x] Pre-Code Technical Brief(분류 큐 데이터 소스·AI 추천 신뢰도·승인 mutation·분류 확정) 정리 — [Bookkeeping Review Pre-Code Brief](../03_Technical_Specs/06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md)
  - [x] 회사 tenant/기간·전표 데이터 모델 확인 — [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) 기준 기존 bookkeeping 테이블 재사용, `clientId`→`businessEntityId` 개념 전환, 물리 rename은 JC-005 후속
  - [x] QA 테스트 시나리오 작성 (Layer 5) — [Bookkeeping Review Test Scenarios](../05_QA_Validation/04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md)
- Acceptance Criteria:
  - [x] 정규화된 거래가 분류 큐에 AI 추천 계정과목·신뢰도와 함께 표시된다.
  - [x] 신뢰도 낮은 거래는 승인 전 "계정 지정"으로 강제 확인된다.
  - [x] 개별·다중(일괄) 승인이 가능하고 승인 시 분류 status가 confirmed로 확정된다(전표 생성은 v1 범위 밖, 후속). 다중 승인은 세션별 그룹 호출.
  - [x] 선택 거래의 분개 미리보기(차/대변, 부가세대급금 포함)와 기간 귀속·부가세 공제가 표시된다.
  - [x] AI 추천은 초안이며 최종 확정 책임은 사용자에게 있다.
  - [x] **회사 기장검토 화면은 GIWA `/dashboard/reviews` 워크스페이스 컴포넌트를 import/render하지 않는다**(Preview 계약, 정적 테스트로 강제).
  - [x] 로딩·빈·오류 상태가 화면에 구현된다.
- Document Sync Check: Screen Flow 4c / UI Design 4.3 / Prototype Review / Preview / Component Plan 7.3 / Pre-Code Brief / QA Scenarios 상호 링크됨. 구현 파일: `lib/bookkeeping-review/summary.ts`, `app/(dashboard)/dashboard/bookkeeping/page.tsx`, `app/(dashboard)/dashboard/bookkeeping/_components/bookkeeping-review.tsx`, `app/(dashboard)/dashboard/bookkeeping/loading.tsx`, `app/(dashboard)/dashboard/bookkeeping/error.tsx`, `app/(dashboard)/dashboard/bookkeeping/_components/bookkeeping-review.test.ts`.

### JC-011 · Build VAT workspace (부가세) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related UI Docs: [Screen Flow 4d](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.4](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: [03_vat.html](../02_UI_Screens/previews/03_vat.html)
- Related Technical Docs: [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) · [VAT Pre-Code Brief](../03_Technical_Specs/07_VAT_PRE_CODE_BRIEF.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Related QA Docs: [VAT Test Scenarios](../05_QA_Validation/05_VAT_TEST_SCENARIOS.md)
- Prototype Review / 승인: [VAT Review](../02_UI_Screens/05_VAT_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [x] Component & Library Plan에 부가세 전용 컴포넌트(Tax Summary·Deduction Review·잠금 버튼 래퍼) 반영 — [Component Plan 7.4](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
  - [x] Pre-Code Technical Brief(확정 전표 집계·공제 판정·공통매입 안분·패키지 생성 mutation) 정리 — [VAT Pre-Code Brief](../03_Technical_Specs/07_VAT_PRE_CODE_BRIEF.md)
  - [x] 회사 tenant/기간·전표/VAT 데이터 모델 확정 — [DB Schema 4.1](../03_Technical_Specs/03_DB_SCHEMA.md), 물리 Drizzle migration `0053_add_vat_tables.sql`
  - [x] QA 테스트 시나리오 작성 (Layer 5) — [VAT Test Scenarios](../05_QA_Validation/05_VAT_TEST_SCENARIOS.md)
- Acceptance Criteria:
  - [ ] 확정 전표 기준 매출세액·매입세액·납부(예정)세액이 집계·표시된다.
  - [ ] 매출이 과세/영세율/면세로 구분되어 그룹별 공급가액·세액이 표시된다.
  - [ ] 불공제 후보·공통매입 안분 대상이 표시되고 사용자가 공제/불공제/안분을 확정한다.
  - [ ] 부속 명세 준비 상태가 표시된다.
  - [ ] 신고 패키지 생성 버튼은 공제 검토 완료 전까지 잠금(disabled + aria-disabled)이며, 사유가 함께 노출된다. React 구현 시 disabled 버튼을 래퍼로 감싸 툴팁을 접근성 있게 처리한다.
  - [ ] 자동 홈택스 제출은 제공하지 않는다(패키지 + 입력 가이드까지). 세액은 검토 완료 전 "예정" 표기.
  - [ ] 로딩·빈·오류 상태가 화면에 구현된다.
- Document Sync Check: Screen Flow 4d / UI Design 4.4 / Prototype Review / Preview / Component Plan 7.4 / VAT Pre-Code Brief / QA Scenarios 상호 링크됨. 구현 파일(1~9단계): `lib/db/schema.ts`, `drizzle/0053_add_vat_tables.sql`, `lib/vat/summary.ts`, `lib/vat/summary.test.ts`, `lib/validations/vat.ts`, `lib/validations/vat.test.ts`, `app/api/vat/deduction-reviews/[reviewId]/route.ts`, `app/api/vat/periods/[periodKey]/package/route.ts`, `app/(dashboard)/dashboard/vat/page.tsx`, `app/(dashboard)/dashboard/vat/_components/vat-workspace.tsx`, `app/(dashboard)/dashboard/vat/_components/vat-actions.tsx`, `app/(dashboard)/dashboard/vat/_components/vat-workspace.test.ts`, `app/(dashboard)/dashboard/vat/loading.tsx`, `app/(dashboard)/dashboard/vat/error.tsx`, `app/(dashboard)/_components/sidebar.tsx`, `lib/company-home/summary.ts`.

### JC-012 · Build payroll workspace (급여) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related UI Docs: [Screen Flow 4e](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.5](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: [04_payroll.html](../02_UI_Screens/previews/04_payroll.html)
- Related Technical Docs: [Component & Library Plan 7.5](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [DB Schema 4.2](../03_Technical_Specs/03_DB_SCHEMA.md) · [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Related QA Docs: [Payroll Test Scenarios](../05_QA_Validation/06_PAYROLL_TEST_SCENARIOS.md) - 급여 금액 산식·4대보험 고지액 매칭·마감 잠금·PII 마스킹 검증
- Prototype Review / 승인: [Payroll Review](../02_UI_Screens/06_PAYROLL_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [x] Component & Library Plan에 급여 전용 컴포넌트(Payroll Register·Deduction Breakdown·Insurance Notice Match·마감 잠금 래퍼) 반영
  - [x] Pre-Code Technical Brief(급여 입력·공제 계산·고지액 매칭·마감 mutation·PII 처리) 정리 — [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md)
  - [x] 회사 tenant·직원·급여 데이터 모델 확정 (JC-005 연계) — [DB Schema 4.2](../03_Technical_Specs/03_DB_SCHEMA.md)
  - [x] 개인정보(급여·주민정보) 접근 권한·마스킹·감사로그 방침 확정 — Brief §5·§10, QA S-80~S-84
  - [x] QA 테스트 시나리오 작성 (Layer 5) — [Payroll Test Scenarios](../05_QA_Validation/06_PAYROLL_TEST_SCENARIOS.md)
- Acceptance Criteria:
  - [x] 급여대장이 직원별 기본급·수당·지급계·원천세·4대보험·공제계·실지급으로 표시된다. (`payroll-workspace.tsx`, 정적 테스트 S-60)
  - [x] 금액은 파생 계산으로 정합한다: 지급계=기본급+수당, 공제계=원천세+4대보험, 실지급=지급계−공제계, 합계=각 열의 합. (`summary.test.ts` S-20~S-26)
  - [x] 원천세·4대보험 공제 상세가 항목별로 집계·표시된다. (`buildPayrollDeductionBreakdown`, UI)
  - [x] 건강보험 EDI/사회보험 고지내역을 수동 입력해 직원별 4대보험 고지액과 매칭하고, 고지액을 최종 공제액에 우선 반영한다. 자동 로그인·공동인증서 저장은 제공하지 않는다. (`insurance-notices` import/match API + 수동 입력 UI)
  - [x] 확인 필요(오류/누락) 직원이 표시되고, 처리 전에는 급여 마감 버튼이 잠금(disabled + aria-disabled)이다. (`PayrollResolveIssueButton`, `PayrollCloseButton`)
  - [x] 급여명세서·지급명세서를 생성 상태로 전환하고, 원천징수 지급명세서/4대보험 산출물 상태를 신고지원이 읽을 수 있게 제공한다. (`documents` API + summary documents)
  - [x] 개인정보 helper는 권한에 따라 직원명을 마스킹하고, 주민등록번호·계좌번호·전화번호·storage key 원문은 신규 화면/고지 import UI에 노출하지 않는다. (세부 권한 정책은 후속 hardening)
  - [x] 로딩·빈·오류 상태가 화면에 구현된다. (`loading.tsx`, `error.tsx`, 빈 상태)
- Document Sync Check: Screen Flow 4e / UI Design 4.5 / Prototype Review / Preview / Component Plan 7.5 / DB Schema 4.2 / Payroll Pre-Code Brief / QA Scenarios 상호 링크됨. 구현 파일: `lib/db/schema.ts`, `drizzle/0054_add_payroll_workspace_tables.sql`, `lib/payroll-workspace/summary.ts`, `lib/payroll-workspace/recalculate.ts`, `lib/payroll-workspace/summary.test.ts`, `lib/validations/payroll-workspace.ts`, `app/(dashboard)/dashboard/payroll/page.tsx`, `_components/payroll-workspace.tsx`, `_components/payroll-actions.tsx`, `_components/payroll-workspace.test.ts`, `loading.tsx`, `error.tsx`, `app/api/payroll/employee-lines/[lineId]/route.ts`, `app/api/payroll/employee-lines/[lineId]/resolve/route.ts`, `app/api/payroll/periods/[period]/insurance-notices/route.ts`, `app/api/payroll/periods/[period]/insurance-notices/match/route.ts`, `app/api/payroll/periods/[period]/documents/route.ts`, `app/api/payroll/periods/[period]/close/route.ts`.

### JC-013 · Build filing support workspace (신고지원) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) — MVP 비범위(자동 홈택스 제출 제외)
- Related UI Docs: [Screen Flow 4f](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.6](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: [05_filing_support.html](../02_UI_Screens/previews/05_filing_support.html)
- Related Technical Docs: [Component & Library Plan 7.6](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [DB Schema 4.3](../03_Technical_Specs/03_DB_SCHEMA.md) · [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Related QA Docs: [Filing Support Test Scenarios](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md) — 신고 항목 연동·패키지 잠금·입력 가이드·접수증 보관·책임 경계(자동 제출 없음)
- Prototype Review / 승인: [Filing Support Review](../02_UI_Screens/07_FILING_SUPPORT_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [x] Component & Library Plan에 신고지원 전용 컴포넌트(Filing Item Card·Input Guide·Receipts·Checklist) 반영 — [Component Plan 7.6](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
  - [x] Pre-Code Technical Brief(신고 항목 연동·패키지 생성·접수증 보관·체크리스트 mutation) 정리 — [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md)
  - [x] 부가세(JC-011)·급여(JC-012) 산출물 데이터 모델 선행 — `vat_period_summary`, `payroll_period_summary`
  - [x] QA 테스트 시나리오 작성 (Layer 5) — [Filing Support Test Scenarios](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
- Acceptance Criteria:
  - [x] 신고 항목(부가세/원천세/4대보험)이 선행 화면 산출물과 연동되어 상태와 함께 표시된다. (`loadFilingSupportSummary`, `FilingItemsSection`)
  - [x] 부가세 패키지는 공제 검토 완료 전 잠금이다. (`pendingDeductionCount` 기반 locknote + disabled CTA)
  - [x] 홈택스 단계별 입력 가이드가 확정 값과 함께 제공되고 값 복사가 가능하다. (`buildFilingInputGuide`, `FilingGuideCopyButton`)
  - [x] 제출 접수증을 업로드·보관하고 미제출 항목은 대기로 표시된다. (`filing_receipt`, `/api/filing/receipts`)
  - [x] 사후 체크리스트로 납부·보관을 확인한다. (`filing_checklist_item`, `/api/filing/checklist-items/[itemId]`)
  - [x] **자동 홈택스 제출·자동 납부·자격증명 서버 저장은 제공하지 않는다**(책임 경계를 화면에 반복 노출).
  - [x] 로딩·빈·오류 상태가 화면에 구현된다. (`loading.tsx`, `error.tsx`, 빈 상태)
- Document Sync Check: Screen Flow 4f / UI Design 4.6 / Prototype Review / Preview / Component Plan 7.6 / DB Schema 4.3 / Filing Support Pre-Code Brief / QA Scenarios 상호 링크됨. 구현 파일: `lib/db/schema.ts`, `drizzle/0055_add_filing_support_tables.sql`, `lib/filing-support/summary.ts`, `lib/filing-support/summary.test.ts`, `lib/validations/filing-support.ts`, `app/(dashboard)/dashboard/filing-support/page.tsx`, `_components/filing-support-workspace.tsx`, `_components/filing-actions.tsx`, `_components/filing-support-workspace.test.ts`, `loading.tsx`, `error.tsx`, `app/api/filing/receipts/route.ts`, `app/api/filing/receipts/[receiptId]/route.ts`, `app/api/filing/checklist-items/[itemId]/route.ts`.

### JC-015 · Build employee directory (직원 명부) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) — 회사 셀프사용 운영 데이터
- Related UI Docs: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) 7번 항목 · [UI Design 4.8](../02_UI_Screens/01_UI_DESIGN.md) · [Prototype Review](../02_UI_Screens/08_EMPLOYEE_DIRECTORY_PROTOTYPE_REVIEW.md)
- Related HTML Preview: [06_employee_directory.html](../02_UI_Screens/previews/06_employee_directory.html) — UI Preview 작성·사용자 확인 완료(2026-07-02).
- Related Technical Docs: [DB Schema 4.4](../03_Technical_Specs/03_DB_SCHEMA.md) · [Employee Directory Pre-Code Brief](../03_Technical_Specs/10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) · [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md)
- Related QA Docs: [Employee Directory Test Scenarios](../05_QA_Validation/08_EMPLOYEE_DIRECTORY_TEST_SCENARIOS.md)
- Prototype Review / 승인: 화면 승인 완료(2026-07-02) — [Prototype Review](../02_UI_Screens/08_EMPLOYEE_DIRECTORY_PROTOTYPE_REVIEW.md).
- Implementation Preconditions:
  - [x] 기능 방향 승인 — 직원 명부가 급여·4대보험 고지액 매칭·리마인드의 기준 데이터가 되어야 함
  - [x] Pre-Code Technical Brief 작성 — [Employee Directory Pre-Code Brief](../03_Technical_Specs/10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md)
  - [x] DB Schema 논리 초안 작성 — [DB Schema 4.4](../03_Technical_Specs/03_DB_SCHEMA.md)
  - [x] QA 테스트 시나리오 작성 — [Employee Directory Test Scenarios](../05_QA_Validation/08_EMPLOYEE_DIRECTORY_TEST_SCENARIOS.md)
  - [x] UI Preview 작성 및 사용자 확인 — 완료(2026-07-02), [06_employee_directory.html](../02_UI_Screens/previews/06_employee_directory.html)
  - [x] 화면 진입 위치 확정 — 독립 메뉴 `/dashboard/employees`(설정 하위 아님)
  - [x] `employee_profile` 물리 Drizzle migration 확정 — `lib/db/schema.ts`, `drizzle/0056_add_employee_profile.sql`
  - [x] 개인정보 저장 금지/마스킹 정책 확정 — 주민번호·계좌·전화 필드 미보유, `maskEmployeeName`+`canViewEmployeeNames`. 세밀한 접근 권한(role)은 후속
  - [x] 급여 line과 직원 마스터 연결 방식 확정 — `employee_code` 읽기 전용 매칭(최근 급여 귀속월 표시), 수동 연결 mutation 없음
- Acceptance Criteria:
  - [x] 직원 명부는 급여 실행 결과와 분리된 마스터 데이터로 관리된다. (`employee_profile`, `/api/employees`)
  - [x] 재직 상태, 급여 대상 여부, 4대보험 확인 상태가 직원별로 표시된다. (`loadEmployeeDirectorySummary`, `EmployeeTable`)
  - [x] 직원 명부는 최근 급여 line을 `employee_code`로 읽기 전용 매칭하고, 마감된 급여 실행 결과를 임의 변경하지 않는다. 실제 리마인드 발송 수신자 연동은 JC-018 후속이다.
  - [x] 리마인드 연동에 필요한 `workEmail`/`notificationEnabled` 필드를 직원 명부에 보유한다. 실제 수신자 후보 사용은 JC-018 후속이다.
  - [x] 주민등록번호·계좌번호·전화번호 원문은 신규 명부 화면과 QA seed에 저장/노출하지 않는다.
  - [x] 로딩·빈·오류 상태가 화면에 구현된다.
- Document Sync Check: Screen Flow 7 / UI Design 4.8 / Prototype Review / HTML Preview / DB Schema 4.4 / Employee Directory Pre-Code Brief / QA Scenarios / Backlog Context Lock 상호 링크됨. 구현 파일: `lib/db/schema.ts`, `drizzle/0056_add_employee_profile.sql`, `lib/employee-directory/summary.ts`, `lib/employee-directory/summary.test.ts`, `lib/validations/employee-directory.ts`, `app/(dashboard)/dashboard/employees/page.tsx`, `_components/employee-directory-workspace.tsx`, `_components/employee-table.tsx`, `_components/employee-actions.tsx`, `_components/employee-directory-workspace.test.ts`, `loading.tsx`, `error.tsx`, `app/api/employees/route.ts`, `app/api/employees/[employeeId]/route.ts`.

### JC-016 · Build internal reminder mail (내부 리마인드 메일) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) — 신고 보조 책임 경계, 자동 제출 제외
- Related UI Docs: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) 8번 항목 · [UI Design 4.9](../02_UI_Screens/01_UI_DESIGN.md) · [Prototype Review](../02_UI_Screens/09_INTERNAL_REMINDER_PROTOTYPE_REVIEW.md)
- Related HTML Preview: [07_internal_reminder.html](../02_UI_Screens/previews/07_internal_reminder.html) — UI Preview 작성·사용자 확인 완료(2026-07-02).
- Related Technical Docs: [DB Schema 4.5](../03_Technical_Specs/03_DB_SCHEMA.md) · [Internal Reminder Mail Pre-Code Brief](../03_Technical_Specs/11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) · [Employee Directory Pre-Code Brief](../03_Technical_Specs/10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) · [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md)
- Related QA Docs: [Internal Reminder Mail Test Scenarios](../05_QA_Validation/09_INTERNAL_REMINDER_MAIL_TEST_SCENARIOS.md)
- Prototype Review / 승인: 화면 승인 완료(2026-07-02) — [Prototype Review](../02_UI_Screens/09_INTERNAL_REMINDER_PROTOTYPE_REVIEW.md).
- Implementation Preconditions:
  - [x] 기능 방향 승인 — 자료수집·기장검토·부가세·급여·신고지원의 확인 필요 상태를 내부 수신자에게 리마인드
  - [x] 책임 경계 확정 — 외부 고객 요청 메일, 외부 업로드 포털 초대, 자동 홈택스 제출/납부는 제외
  - [x] Pre-Code Technical Brief 작성 — [Internal Reminder Mail Pre-Code Brief](../03_Technical_Specs/11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md)
  - [x] DB Schema 논리 초안 작성 — [DB Schema 4.5](../03_Technical_Specs/03_DB_SCHEMA.md)
  - [x] QA 테스트 시나리오 작성 — [Internal Reminder Mail Test Scenarios](../05_QA_Validation/09_INTERNAL_REMINDER_MAIL_TEST_SCENARIOS.md)
  - [x] UI Preview 작성 및 사용자 확인 — 완료(2026-07-02), [07_internal_reminder.html](../02_UI_Screens/previews/07_internal_reminder.html)
  - [x] 화면 진입 위치 확정 — 독립 메뉴 `/dashboard/reminders`
  - [x] 수신자 source 결정 — v1은 담당자 본인·내부 staff 발송(자가 리마인드). 직원 명부(JC-015) 기반 직원 수신은 후속
  - [x] `internal_reminder_*` 물리 Drizzle migration 확정 — `lib/db/schema.ts`, `drizzle/0057_add_internal_reminder_tables.sql`
  - [x] Resend/env/test-send 확인 — provider missing guard + 테스트 발송 API 구현. 실제 provider E2E는 배포 env 설정 후 검증
  - [x] 실행 방식과 idempotency key 확정 — v1은 수동 즉시 발송 + deterministic idempotency key. Vercel Cron 자동 예약은 후속
- Acceptance Criteria:
  - [x] 리마인드는 회사 내부 수신자에게만 발송된다.
  - [x] 확인 필요 상태가 리마인드 대상으로 연결된다.
  - [x] v1 수신자는 담당자 본인·내부 staff로 결정되며, 비활성/이메일 없는 대상은 제외된다. 직원 명부 기반 직원 수신은 후속이다.
  - [x] 같은 조건의 수동 리마인드는 idempotency key로 중복 발송되지 않는다. Cron 자동 예약은 후속이다.
  - [x] 발송 로그는 성공/실패/스킵 상태와 실패 사유를 남긴다.
  - [x] 외부 고객 요청 메일, 외부 업로드 포털 초대, 자동 홈택스 제출/납부는 제공하지 않는다.
  - [x] 로딩·빈·오류·provider missing 상태가 구현된다.
- Document Sync Check: Screen Flow 8 / UI Design 4.9 / Prototype Review / HTML Preview / DB Schema 4.5 / Internal Reminder Mail Pre-Code Brief / QA Scenarios / Backlog Context Lock 상호 링크됨. 구현 파일: `lib/db/schema.ts`, `drizzle/0057_add_internal_reminder_tables.sql`, `lib/internal-reminders/summary.ts`, `lib/internal-reminders/send.ts`, `lib/internal-reminders/summary.test.ts`, `lib/internal-reminders/send.test.ts`, `lib/validations/internal-reminders.ts`, `app/(dashboard)/dashboard/reminders/page.tsx`, `_components/internal-reminders-workspace.tsx`, `_components/reminder-actions.tsx`, `_components/internal-reminders-workspace.test.ts`, `loading.tsx`, `error.tsx`, `app/api/internal-reminders/rules/[ruleId]/route.ts`, `app/api/internal-reminders/rules/[ruleId]/test-send/route.ts`, `app/api/internal-reminders/send-now/route.ts`, `app/(dashboard)/_components/sidebar.tsx`, `app/(dashboard)/layout.tsx`.

### JC-019 · Provide first-run sample workspace data (첫 가입 샘플 데이터) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) — 신규 사용자가 회사 셀프사용 흐름을 이해하도록 돕는 온보딩 경험
- Related UI Docs: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design](../02_UI_Screens/01_UI_DESIGN.md) · [MVP UX Baseline](../02_UI_Screens/01_MVP_UX_BASELINE.md)
- Related HTML Preview: [00_company_home.html](../02_UI_Screens/previews/00_company_home.html) · [01_source_collection.html](../02_UI_Screens/previews/01_source_collection.html) · [02_bookkeeping_review.html](../02_UI_Screens/previews/02_bookkeeping_review.html) · [03_vat.html](../02_UI_Screens/previews/03_vat.html) · [04_payroll.html](../02_UI_Screens/previews/04_payroll.html) · [05_filing_support.html](../02_UI_Screens/previews/05_filing_support.html) · [06_employee_directory.html](../02_UI_Screens/previews/06_employee_directory.html) · [07_internal_reminder.html](../02_UI_Screens/previews/07_internal_reminder.html)
- Related Technical Docs: [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [First-run Sample Data Pre-Code Brief](../03_Technical_Specs/12_FIRST_RUN_SAMPLE_DATA_PRE_CODE_BRIEF.md) · [Company Home Pre-Code Brief](../03_Technical_Specs/04_COMPANY_HOME_PRE_CODE_BRIEF.md) · [Source Collection Pre-Code Brief](../03_Technical_Specs/05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md) · [Bookkeeping Review Pre-Code Brief](../03_Technical_Specs/06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md) · [VAT Pre-Code Brief](../03_Technical_Specs/07_VAT_PRE_CODE_BRIEF.md) · [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md) · [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md)
- Related QA Docs: [First-run Sample Data Test Scenarios](../05_QA_Validation/10_FIRST_RUN_SAMPLE_DATA_TEST_SCENARIOS.md) · [Company Home Test Scenarios](../05_QA_Validation/02_COMPANY_HOME_TEST_SCENARIOS.md) · [Source Collection Test Scenarios](../05_QA_Validation/03_SOURCE_COLLECTION_TEST_SCENARIOS.md) · [Bookkeeping Review Test Scenarios](../05_QA_Validation/04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md) · [VAT Test Scenarios](../05_QA_Validation/05_VAT_TEST_SCENARIOS.md) · [Payroll Test Scenarios](../05_QA_Validation/06_PAYROLL_TEST_SCENARIOS.md) · [Filing Support Test Scenarios](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
- Prototype Review / 승인: 기존 8개 승인 Preview의 데이터 서사를 first-run 샘플 seed 기준으로 재사용한다. 샘플 데이터 생성/삭제 UI는 [UI Design 4.10](../02_UI_Screens/01_UI_DESIGN.md)과 [First-run Sample Data Pre-Code Brief](../03_Technical_Specs/12_FIRST_RUN_SAMPLE_DATA_PRE_CODE_BRIEF.md)로 보강했다.
- Implementation Preconditions:
  - [x] 샘플 데이터 정책 확정 — 온보딩 완료 시 자동 생성(best effort), 실패해도 onboarding 완료를 막지 않음
  - [x] 샘플 데이터 삭제 범위 확정 — registry가 추적하는 샘플 행만 삭제하고 실데이터는 보존하는 tenant-scoped cleanup
  - [x] 모든 샘플 행 식별 방식 확정 — `sample_dataset` + `sample_entity_ref` registry, 전역 visible banner/badge
  - [x] Preview 데이터와 실제 seed 데이터의 수치 정합표 작성 — [First-run Sample Data Pre-Code Brief §5](../03_Technical_Specs/12_FIRST_RUN_SAMPLE_DATA_PRE_CODE_BRIEF.md)
  - [x] 샘플 생성/삭제 QA 시나리오 추가 — [First-run Sample Data Test Scenarios](../05_QA_Validation/10_FIRST_RUN_SAMPLE_DATA_TEST_SCENARIOS.md)
- Acceptance Criteria:
  - [x] 신규 tenant는 가입/온보딩 직후 승인 Preview와 유사한 채워진 화면을 볼 수 있다. — onboarding route에서 seed best-effort 호출, seed plan 수치 단위 테스트
  - [x] 샘플 데이터는 화면에서 명확히 표시되어 실데이터와 혼동되지 않는다. — dashboard layout 전역 `SampleDataBanner`
  - [x] 사용자는 실사용 전 샘플 데이터를 한 번에 삭제할 수 있다. — `DELETE /api/first-run-sample` + 확인 dialog
  - [x] 샘플 삭제는 같은 tenant의 샘플 데이터에만 작동하고, 실제 업로드/급여/신고 데이터는 삭제하지 않는다. — registry whitelist cleanup, `client`/사업장 행 제외
  - [x] 기존 tenant나 이미 실데이터가 있는 tenant에는 샘플 데이터가 자동 재생성되지 않는다. — onboarding 신규 생성 경로에만 자동 seed, deleted dataset은 재생성 skip
- Document Sync Check: 2026-07-04 구현 반영. Screen Flow 4h / UI Design 4.10 / Component Plan 7.7 / DB Schema 4.6 / Pre-Code Brief / QA Scenarios가 상호 링크됨. 구현 파일: `drizzle/0058_add_first_run_sample_tables.sql`, `lib/first-run-sample/{seed,cleanup,summary}.ts`, `app/api/first-run-sample/route.ts`, `app/(dashboard)/_components/sample-data-banner.tsx`, `app/(dashboard)/layout.tsx`, `app/api/onboarding/route.ts`. Browser E2E는 PR 배포 후 신규 계정으로 확인 예정.

### JC-020 · Fix signup-to-onboarding routing (가입 후 온보딩 라우팅) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) — 회사 사용자가 자기 사업자 회사를 먼저 등록해야 하는 멀티테넌트 구조
- Related UI Docs: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: N/A - 기존 Preview는 로그인 후 워크스페이스 중심이며, auth/onboarding first-run 라우팅은 프로덕션 E2E에서 발견된 버그성 흐름이다.
- Related Technical Docs: [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) · [DB Schema 2.1](../03_Technical_Specs/03_DB_SCHEMA.md) · [Company Home Pre-Code Brief](../03_Technical_Specs/04_COMPANY_HOME_PRE_CODE_BRIEF.md)
- Related QA Docs: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md) · [Company Home Test Scenarios](../05_QA_Validation/02_COMPANY_HOME_TEST_SCENARIOS.md) S-70~S-71(미인증/tenant 미소속 상태)
- Prototype Review / 승인: N/A - 사용자 프로덕션 E2E 중 확인된 신규 가입 라우팅 버그. 구현 전 auth/onboarding flow를 짧은 technical brief 또는 QA case로 보강한다.
- Implementation Preconditions:
  - [x] 신규 가입 직후 no-tenant/no-organization 상태의 라우팅 계약 확정 — "활성 테넌트 없음 → `/onboarding`"으로 확정
  - [x] Better Auth organization/session 생성 타이밍과 `requireTenantSession` 실패 경로 확인 — `activeOrganizationId`는 로그인 직후 null, `setActive()`로 설정됨을 확인
  - [x] `/dashboard/clients` 진입 전 tenant 없음 상태를 `/onboarding`으로 redirect하는 위치 결정 — `app/(dashboard)/layout.tsx` 서버 가드
  - [ ] signup success path 회귀 테스트 또는 browser smoke 추가 — 자동 회귀 테스트는 미추가(후속). 현재 `tsc`/`next build` 통과로 대체하고 인증 플로우는 배포 후 수동 확인.
- Acceptance Criteria:
  - [x] 신규 가입자가 tenant/organization 없이 인증된 상태가 되면 `/onboarding`으로 이동한다. — sign-up→`/onboarding`, layout redirect 구현
  - [x] 기존 tenant가 있는 사용자는 로그인 후 기존 대시보드/회사 홈으로 이동한다. — sign-in setActive 후 dashboard, onboarding 자기교정
  - [x] 첫 가입자가 `/dashboard/clients`에서 "현황 로드 실패" 상태를 먼저 보지 않는다. — layout이 깨진 children 대신 redirect
  - [x] 온보딩 완료 후 tenant/member/client 생성 흐름은 기존처럼 정상 동작한다. — `createTenantWithOrg` 경로 미변경
- Document Sync Check: 2026-07-03 프로덕션 E2E에서 회원가입 성공 후 `organization=0`, `tenant=0` 상태로 dashboard/clients에 진입하며 오류가 보인 사실을 근거로 등록. **구현 완료(2026-07-04, PR #39)** — sign-up/sign-in/dashboard layout/onboarding 라우팅 + 홈 로그인 CTA. `tsc`/`next build` 통과. 자동 회귀 테스트는 후속, 인증 플로우 런타임 확인은 배포 후 수동으로 남김.

### JC-021 · Remove remaining JARYO brand residue from first-run UX (첫 가입 브랜드 잔재 정리) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) — SemuAgent 제품 정체성과 책임 경계
- Related UI Docs: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: N/A - 문제 표면은 signup welcome modal/onboarding copy로, 기존 워크스페이스 Preview 범위 밖이다. 필요 시 auth/onboarding preview를 추가한다.
- Related Technical Docs: [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
- Related QA Docs: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md)
- Prototype Review / 승인: N/A - 2026-07-03 프로덕션 첫 가입 화면에서 발견된 브랜드 잔재. 상류 JARYO-GIWA 이력 문구는 보존하고, 사용자 first-run 노출 문구만 정리한다.
- Implementation Preconditions:
  - [ ] 프로덕션 first-run 노출 표면 전수 검색 — signup, sign-in, onboarding, welcome modal, metadata, email sender, domain suffix
  - [ ] `JARYO beta`, `JARYO Company`, `SemuDesk`, `.jaryo.kr` 잔재를 SemuAgent 정책에 맞게 분류
  - [ ] `jaryo-admin`/`JARYO_ADMIN_EMAILS`는 운영자 콘솔 식별자 유지 여부를 JC-014/운영자 콘솔 정책과 별도 결정
  - [ ] 브라우저 smoke로 신규 가입→온보딩 copy 확인
- Acceptance Criteria:
  - [ ] 가입 직후 welcome modal은 SemuAgent 문맥과 카피를 사용한다.
  - [ ] 온보딩 서브도메인 suffix는 `.jaryo.kr`로 노출되지 않는다. SemuAgent 도메인 또는 중립 문구로 교체한다.
  - [ ] 첫 가입/온보딩 사용자가 보는 표면에 `JARYO Company`, `JARYO beta`, `SemuDesk` 잔재가 없다.
  - [ ] JARYO-GIWA 출처 기록과 운영자 콘솔 식별자는 제품 first-run UX와 구분해 보존 또는 별도 PR로 처리한다.
- Document Sync Check: 2026-07-03 프로덕션 E2E에서 `JARYO beta` 모달과 `.jaryo.kr` suffix가 발견되어 등록. 코드 변경은 후속 PR에서 처리.

### JC-022 · Refine settings screen product language (설정 화면 제품 언어 정리) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) — 소규모 회사가 직접 쓰는 세무 보조 제품 문맥
- Related UI Docs: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: N/A - 설정 화면은 기존 승인 workspace Preview 범위 밖이며, 프로덕션 E2E에서 실제 설정 화면을 보고 발견한 UX/용어 후속이다. 필요 시 settings preview를 추가한다.
- Related Technical Docs: [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) · [DB Schema 2.1](../03_Technical_Specs/03_DB_SCHEMA.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
- Related QA Docs: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md)
- Prototype Review / 승인: N/A - 현재 설정 화면의 `테넌트 설정`, `테넌트 정보`, `.jaryo.kr` suffix가 사용자 언어와 맞지 않는다는 프로덕션 E2E 관찰에 기반한다.
- Implementation Preconditions:
  - [ ] 설정 화면 노출 문구 전수 검색 — `app/(dashboard)/dashboard/settings/page.tsx`, `settings-panel.tsx`, `app/api/settings/*` 오류 메시지
  - [ ] `테넌트` UI 표기를 사용자 언어로 확정 — 예: `회사 설정`, `회사 정보`, `운영 회사`
  - [ ] 서브도메인 표시 정책 확정 — 실제 SemuAgent 도메인, neutral preview, 또는 숨김/읽기 전용 설명
  - [ ] `업무메일 설정` 탭이 JC-016 내부 리마인드와 중복/혼동되지 않는지 검토
  - [ ] 설정 화면 browser smoke 또는 정적 텍스트 회귀 테스트 추가
- Acceptance Criteria:
  - [ ] 설정 화면 탭과 부제에서 개발자 용어 `테넌트`가 사용자에게 보이는 문구로 노출되지 않는다.
  - [ ] 서브도메인 읽기 전용 필드가 `.jaryo.kr`로 표시되지 않는다.
  - [ ] 회사명, 담당자, 업무메일, 사업장 관리가 SemuAgent 책임 경계에 맞는 설명으로 정리된다.
  - [ ] 운영자 콘솔/DB 내부 식별자(`tenant_id`, `jaryo-admin`)는 사용자 설정 화면과 분리해 보존하거나 별도 PR에서 처리한다.
- Document Sync Check: 2026-07-03 프로덕션 E2E 중 설정 화면에서 발견. 코드 변경은 후속 PR에서 처리하며, JC-021(first-run 브랜드 잔재)와 구현 범위가 겹치면 같은 PR에서 함께 처리 가능.

> 현재 기존 여섯 워크스페이스는 **UI-First Gate 통과 및 구현 완료**. JC-005는 데이터 모델 델타를 확정했다(`done`) — client→business_entity 재정의(물리명 `client` 유지·rename 지연), 기간 표현 도메인별 canonical, 신규 도메인 migration 0053~0057. JC-011에서 부가세 물리 Drizzle migration과 read model/UI 구현이 완료됐다. JC-006은 회사 홈 구현·머지 완료. JC-009는 자료수집 read model·UI 구현·머지 완료(PR #4·#5, Preview 정합 포함). JC-010은 기장검토 read model·UI 구현과 QA Result 반영 완료. JC-012는 급여 read model·UI·고지액 수동 입력/match·문서 생성·마감 guard 구현을 완료했다. JC-013은 신고지원 read model·UI·접수증 보관·체크리스트 구현과 QA Result 반영을 완료했다. JC-015는 UI Preview·화면 승인(2026-07-02)에 이어 read model·`/dashboard/employees`·추가/수정 API·`0056` migration 구현을 완료했다(급여 line은 읽기 전용 매칭, 개인정보 최소 저장). JC-016은 `internal_reminder_*` 물리 테이블, read model, `/dashboard/reminders`, 토글/테스트 발송/즉시 발송 API, provider missing 상태, idempotency key를 구현했다. 직원 명부 기반 직원 수신은 JC-018, Vercel Cron 자동 예약 실행은 JC-017 후속이다. JC-004는 노출 표면 정리(설정 GIWA CC 탭·사무소 문구 제거), dead GIWA 컴포넌트 삭제, 레거시 GIWA 라우트 10종 redirect 차단, 링크 정리, clients 용어 사업장화, 설정 업무메일 탭 정리, 사업장 상세 GIWA 탭 제거를 완료(`done`, PR #21~#25). `clients`(사업장 등록·관리)·`billing`(요금제)은 v1 필수 기능으로 유지하고, jaryo-admin은 operator allowlist로 격리된 플랫폼 콘솔이라 조치 불필요로 감사 종료했다. JC-014 실제 업로드→Blob 저장→AI 파싱→정규화 E2E 검증을 완료했다(`done`, 2026-07-03) — Gemini·Claude high confidence 합의로 파이프라인 정상 동작 확인. 유일한 인프라 후속은 OPENAI_API_KEY 429(quota) 결제 충전으로 3-provider 합의를 완전 복구하는 것(현재 2/3 graceful 동작). 2026-07-03 프로덕션 first-run E2E에서 발견된 신규 사용자 경험 후속은 JC-019(샘플 데이터 first-run), JC-020(가입 후 온보딩 라우팅), JC-021(브랜드 잔재 정리), JC-022(설정 화면 제품 언어 정리)로 등록했다.

## Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 MVP 범위
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 화면 흐름·컴포넌트(Context Lock 참조 대상)
- **UI_Screens**: [HTML Preview 폴더](../02_UI_Screens/previews/) - 승인된 화면 프로토타입(6개 워크스페이스 + 직원 명부 + 리마인드)
- **Technical_Specs**: [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md) · [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md) · [Employee Directory Pre-Code Brief](../03_Technical_Specs/10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) · [Internal Reminder Mail Pre-Code Brief](../03_Technical_Specs/11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) - 스택 및 컴포넌트/급여·신고지원·직원 명부·내부 리마인드 구현 계약
- **QA_Validation**: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md) · [Payroll Test Scenarios](../05_QA_Validation/06_PAYROLL_TEST_SCENARIOS.md) · [Filing Support Test Scenarios](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md) · [Employee Directory Test Scenarios](../05_QA_Validation/08_EMPLOYEE_DIRECTORY_TEST_SCENARIOS.md) · [Internal Reminder Mail Test Scenarios](../05_QA_Validation/09_INTERNAL_REMINDER_MAIL_TEST_SCENARIOS.md) - 검증 기준(Acceptance 연계)
