# SemuAgent Backlog
> Created: 2026-07-01 17:57
> Last Updated: 2026-07-08 03:25 KST

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
| JC-012 | done | Build payroll workspace | `lib/payroll-workspace`, `app/(dashboard)/dashboard/payroll`, `app/api/payroll` | Payroll register with derived totals, withholding/4-insurance deduction, insurance notice upload/manual confirmation, payslip/statement preview, and close guard match approved 급여 UI; PII raw fields/storage keys not exposed |
| JC-013 | done | Build filing support workspace | `lib/filing-support`, `app/(dashboard)/dashboard/filing-support`, `app/api/filing` | Filing items (VAT/withholding/insurance) with packages, filing preparation values, receipt storage, and post-filing checklist match approved 신고지원 UI; no auto submission/payment |
| JC-014 | done | Provision env secrets and verify upload→parse E2E | `.env`, Vercel Blob, AI providers | 착수 전 정리 완료: `.env.local`의 Blob 토큰 중복 제거·`JARYO_ADMIN_EMAILS` 실운영자값·`EMAIL_FROM` 브랜드(SemuAgent). 실제 자격증명 E2E 통과(2026-07-03): 파일→Vercel Blob(private) put/get 바이트 일치→텍스트추출→AI 파싱→`analysis_run` 3건 정규화 저장→상태 전이(needs_review). Gemini·Claude는 "급여대장" high confidence 합의(consensus=medium), 파일 매칭용 checklist 미보유로 material_match 0. **미해결: OPENAI_API_KEY 429(quota/billing) — 3-provider 합의 복구하려면 OpenAI 결제 충전 필요(파이프라인은 2/3로 graceful 동작 확인).** |
| JC-015 | done | Build employee directory | `lib/employee-directory`, `app/(dashboard)/dashboard/employees`, `app/api/employees` | 직원 명부를 급여 실행 결과와 분리된 마스터로 관리. read model·화면·추가/수정 API·0056 migration 구현 완료. 급여 line은 `employee_code` 읽기 전용 최근 귀속월 매칭으로 연결한다. 리마인드 직원 수신자 연동은 JC-018에서 완료. |
| JC-016 | done | Build internal reminder mail | `lib/internal-reminders`, `app/(dashboard)/dashboard/reminders`, `app/api/internal-reminders` | 내부 staff/본인 수신 기반 리마인드 read model·화면·토글/테스트 발송/즉시 발송 API·0057 migration 구현 완료. Vercel Cron 자동 예약은 JC-017에서 완료했고, 직원 명부 기반 급여 도메인 직원 수신은 JC-018에서 완료. |
| JC-017 | done | Schedule internal reminder cron (내부 리마인드 cron + 레거시 cron 정리) | `app/api/cron/internal-reminder`(신규), `vercel.json`, `lib/internal-reminders` | **우선순위: 최상(기한 내 신고 완성) · 저위험.** Vercel Cron이 신규 내부 리마인드(`internal_reminder_*`) 발송을 매일 실행한다. 세션 없는 테넌트 스코프 시스템 로더로 활성 규칙을 조회하고, D-day 판정(daily_digest=확인필요 있을때만 / deadline_offset=마감−offsetDays 당일 / manual=제외)으로 발송한다. 레거시 cron 4개(reminder·retry-failed·stale-notify·auto-send-requests)는 vercel.json 예약 제거 및 고립 route 삭제까지 완료. cleanup-send-locks·billing-renewals 유지. idempotency·발송 로그·provider missing·테넌트 격리 검증. [Internal Reminder Cron Pre-Code Brief](../03_Technical_Specs/14_INTERNAL_REMINDER_CRON_PRE_CODE_BRIEF.md) 참조. |
| JC-018 | done | Connect employee directory recipients to reminders (급여 도메인 한정) | `lib/internal-reminders`, `lib/employee-directory`, `lib/payroll-workspace`, `employee_profile` | **v1 스코프 확정(2026-07-05).** payroll 도메인 내부 리마인드에 한해 담당자(staff) 전체 요약 수신 + **그 시점 확인 필요(needs_review) 급여 line을 가진 직원만** 대상으로 수신자를 연동한다. 직원 이메일은 금액·세액 등 민감정보를 절대 포함하지 않고 일반 문구("급여/인적사항 확인 요청")만 발송한다. `recipient_source`(mixed)는 payroll 도메인에 코드로 고정하며, 규칙별 사용자 설정 UI는 후속(JC-018-후속)이다. 직원 이메일 없음/알림 꺼짐/명부 미매칭이면 해당 직원만 제외(staff는 그대로 전체 요약 수신). |
| JC-019 | done | Provide first-run sample workspace data | `lib/first-run-sample`, `app/api/first-run-sample`, `app/(dashboard)/_components/sample-data-banner.tsx`, `app/(dashboard)/layout.tsx` | 신규 테넌트가 가입 직후 승인 Preview와 같은 샘플 업무 데이터를 보고 메뉴 구조를 이해할 수 있다. 샘플 데이터는 명확히 표시되고, 실사용 전 사용자가 한 번에 삭제할 수 있어야 한다. **프로덕션 E2E 완료(2026-07-04)**: 신규가입→온보딩 직후 자동 seed(`sample_dataset` active + registry 427행)→전역 배너·워크스페이스 채워짐→"샘플 삭제" 확인 dialog→**샘플 도메인 행 전부 삭제·`client`(사업장)/tenant/staff 보존**·dataset `deleted`(재생성 없음) 확인. registry+whitelist+delete_order+tenant scope 안전장치 실전 검증. 구현 PR #41 · 핫픽스 PR #42(서버/클라 import 경계) · 재발방지 `server-only` 가드. |
| JC-020 | done | Fix signup-to-onboarding routing | `app/(auth)/sign-up`, `app/(auth)/sign-in`, `app/(dashboard)/layout.tsx`, `app/onboarding` | 신규 가입자가 tenant/organization이 없는 상태에서 깨진 dashboard/clients 화면으로 이동하지 않고 `/onboarding`으로 안내된다. 기존 tenant가 있는 사용자는 기존 대시보드 진입을 유지한다. **구현(2026-07-04)**: sign-up→`/onboarding`, sign-in은 org 있으면 setActive 후 dashboard·없으면 `/onboarding`, dashboard layout은 활성 테넌트 없으면 `/onboarding` redirect(깨진 children 렌더 제거), onboarding은 이미 org 있는 사용자를 setActive 후 dashboard로 자기교정. |
| JC-021 | done | Remove remaining JARYO brand residue from first-run UX | `app/(auth)/_components/public-welcome-modal.tsx`, `app/onboarding/page.tsx` | 프로덕션 첫 가입 흐름에서 `JARYO beta` 모달·`.jaryo.kr` 서브도메인 접미사 등 잔여 브랜드가 SemuAgent 문맥으로 정리된다. 상류 JARYO-GIWA 이력 문구와 운영자 콘솔 식별자는 범위 밖이다. **구현(2026-07-04)**: 환영 모달을 "회계사무소/고객사" 포지셔닝→"작은 회사 세무신고 준비(SemuAgent)"로 카피 재구성, 배지 `JARYO 베타`→`SemuAgent 베타`. 온보딩 `.jaryo.kr` 접미사 제거. 홈/문서의 JARYO-GIWA 이력·jaryo-admin·localStorage 내부키는 보존. |
| JC-022 | done | Refine settings screen product language | `app/(dashboard)/dashboard/settings/_components/settings-panel.tsx`, `app/(dashboard)/dashboard/settings/page.tsx` | 설정 화면의 개발자/상류 용어(`테넌트`, `.jaryo.kr`)를 사용자가 이해하는 회사/사업자 문맥으로 정리한다. **구현(2026-07-04)**: 탭 `테넌트 설정`→`회사 설정`, 부제 `테넌트 정보…`→`회사 정보…`, 저장 토스트 문구, 서브도메인 읽기전용 필드 `{sub}.jaryo.kr`→`{sub}`(가짜 도메인 제거), 담당자 추가 설명 `JARYO`→`SemuAgent`. 내부 식별자(`tenant_id`)·코드 주석은 보존. 서브도메인 최종 도메인 정책은 실도메인 확정 후 재적용(후속). |
| JC-023 | todo | Strategic Direction: 사용자 승인 기반 홈택스 자동제출 | `lib/filing-support`, Hometax e-filing 규격, 인증·감사 로그 | **MVP 밖 로드맵/전략 방향** — [Product Baseline Strategic Direction](../01_Concept_Design/01_PRODUCT_BASELINE.md) 참조. 사용자가 신고 내용을 최종 확인·승인하면 SemuAgent가 사용자 권한 범위 안에서 홈택스 제출을 자동 진행하고 접수증까지 자동 회수·보관한다. 현행 신고지원(JC-013)은 준비값 확인·접수증 보관 단계. 원칙: 사용자 최종 승인 필수·자격증명 원문 저장 금지·감사 로그 필수·접수증 자동 보관. 착수 전 조사 필요(전자신고 파일 규격·파일변환신고·인증 기반 제출 자동화 가능성·공식 API vs 비공개 연동). 구현 착수 전 별도 technical brief·법무/보안 검토 필수. |
| JC-024 | done | 연말정산·지급명세서 지원 (급여/원천 확장) | `lib/payment-statements`, `app/(dashboard)/dashboard/filing-preparation/payment-statements`, 급여·원천세·직원명부 데이터 | **구현 완료(2026-07-05).** 근로소득 간이지급명세서 반기 집계와 연말정산 준비·검토 read-only 화면을 제공한다. 지급총액·원천징수세액(근로소득세)·연간 지급합계·기납부 원천세·누락 월/인적사항 확인을 직원 중심으로 검토하며, 정산액 계산·전자신고 파일 생성·자동제출은 범위 밖(JC-030/JC-023). 신고 준비 허브의 지급명세서/연말정산 트랙은 roadmap→live 전환 완료. 신규 DB/마이그레이션 없음. |
| JC-025 | todo | 종합소득세 신고 지원 (개인사업자, self-filing 보조) | `lib/bookkeeping`, 기장 output, `lib/filing-support` | **우선순위: 중 · 법적 리스크: 주의.** 개인사업자 종합소득세(5월) 신고서 계산·초안·검증을 self-filing 보조로 제공한다. 기장검토(JC-010) output을 사용한다. ⚠️ 세무조정이 개입하면 세무사법 제2조("세무서류 작성")에 저촉 소지가 있어, "계산·초안·사용자 최종 확인" 수준으로 한정하고 세무조정계산서 자동작성은 신중히 다룬다. 착수 전 법무 검토 게이트. |
| JC-026 | todo | 법인세 신고 지원 (법인) | `lib/bookkeeping`, 기장 output, `lib/filing-support` | **우선순위: 낮음(안정화·저위험 항목 후) · 법적 리스크: 높음.** 법인세(사업연도 종료 후 3개월) 신고 보조. 기장 output 사용. ⚠️ **세무조정계산서 작성이 핵심 = 세무사 직무(세무사법 제2조)** → 자동작성은 무자격 세무대리 리스크가 가장 크다. self-filing 보조 경계를 엄격히 지키고, 착수 전 **법무 검토를 필수 게이트**로 둔다. 복잡도 높음. |
| JC-027 | done | 지방소득세 연동 지원 (원천세 특별징수분 한정, 신고 준비 허브 마지막 트랙) | `lib/local-income-tax`, `app/(dashboard)/dashboard/filing-preparation/local-income-tax`, `lib/filing-support`, `lib/filing-preparation` | **구현 완료(2026-07-05).** "지방소득세 전체"가 아니라 **원천세 특별징수분만**. 종합소득세분·법인세분 지방소득세는 JC-025/026 이후. 급여에 이미 실제 기록된 `payrollEmployeeLine.localIncomeTaxKrw`를 집계하는 read-only 전용 화면을 추가하고, 신고 준비 허브(JC-029)의 `local_income` 트랙을 roadmap→live 전환했다. **데이터 정합성 수정 포함**: 신고지원(JC-013)이 `withholdingTaxKrw`를 10%/11로 근사 분리하던 방식을 제거하고, JC-027과 동일한 확정 라인 실제 `incomeTaxKrw`·`localIncomeTaxKrw` 합계로 교체했다. `needs_review` 라인은 확인 필요·blocker에는 포함하지만 Hero/표 합계/신고지원 입력값에는 포함하지 않는다. 위택스 자동제출·신규 세액 계산 엔진은 범위 밖. |
| JC-028 | done | 사업장현황신고 지원 (면세 개인사업자) | `lib/business-status-report`, `app/(dashboard)/dashboard/filing-preparation/business-status-report`, `lib/filing-preparation` | **구현 완료(2026-07-05).** 부가세 비대상 **면세 개인사업자**가 2월 10일까지 하는 사업장현황신고 준비 데이터를 검토한다. 수입금액·매입/경비 자료는 자료수집·기장검토의 확정 거래 데이터로 구성하며, 신고 준비 허브의 `business_status` 트랙은 roadmap→live 전환 완료. 홈택스 제출·전자신고 파일·자동제출은 범위 밖. |
| JC-029 | done | 신고 준비 현황 허브 (신고 데이터 준비 파이프라인) | `app/(dashboard)/dashboard/filing-preparation`(신규), 각 도메인 read model, 리마인드(JC-016) | **우선순위: 높음 (JC-024보다 선행) · 저위험(read-only 현황).** 사이드바에 "신고 준비" 추가(신고지원 아래). 목적은 달력/일정표가 아니라 홈택스·위택스에 넣을 확정 데이터가 준비됐는지 보여주는 것. 공통 기반(자료수집→기장검토)과 병렬 트랙(원천세·부가세·지급명세서/연말정산·지방소득세)의 입력·산출·handoff 상태를 표시한다. 세무 일정은 보조 섹션으로 강등. 신규 산출 엔진·신규 DB·자동제출은 범위 밖. [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md) 참조. |
| JC-034 | todo | GIWA handoff 패키지 — Filing Path 2 (ZIP Export v1) | `lib/giwa-handoff`, `lib/filing-preparation`, JC-030 Validation | **우선순위: Path 1 베타 이후.** 문서만 보존, 기존 Preview는 Path 1 우선 화면으로 supersede, **구현 착수 보류**. ZIP(manifest + CSV + README). [Scope Gate](../03_Technical_Specs/34_JC034_GIWA_HANDOFF_PACKAGE_SCOPE_GATE.md) · [Pre-Code Brief](../03_Technical_Specs/35_JC034_GIWA_HANDOFF_PACKAGE_PRE_CODE_BRIEF.md) |
| JC-030 | todo | 전자신고 검증 및 파일 생성 (Validation / Path 1 / Path 3) | `lib/efiling-*`, JC-024·013 | **최우선 — Path 1 세목 확대.** 간이지급 Path 1 완료. **다음: 원천세** layout acquisition → 업로드용 양식·파일 작성 지원. Path 3 미래. [Path 1 Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md) · [Scope Gate](../03_Technical_Specs/19_EFILING_FILE_GENERATION_SCOPE_GATE.md) |
| JC-031 | todo | 레거시 GIWA upload/email 서브시스템 은퇴 (에픽) | `uploadSession`·`outbound_email`(각각 100여·수십 개 파일에 광범위하게 얽힘, 검색 범위·시점에 따라 변동) 스키마·도메인, sessions·`/upload/[token]` 포털·emails·request-events·mail-console | **에픽 · 의도적 보류(paused, 2026-07-06).** Slice 4-2c micro(`request_email_cc` DROP)까지 완료. **에픽은 미완료** — 4-3~4-5·잔여 `upload_session` 컬럼·테이블 은퇴 남음. 재개 시 [Completion Contract §3 Paused](../03_Technical_Specs/22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md) 참조. 제품 backlog 우선 가능. |
| JC-032 | done | 사업자 유형 전용 필드 (신고 준비 dimming 실데이터 연결) | `client.taxEntityType`, `/api/settings/business-entity`, 회사 설정 화면, `lib/filing-preparation/summary.ts` | **우선순위: 높음(JC-029 dimming 완성) · 저위험.** JC-029 신고 준비 허브의 사업자 유형별 흐림 규칙을 실데이터에 연결한다. `client`(사업장)에 `tax_entity_type`(개인/법인/면세, nullable) 컬럼 추가(migration 0059), 회사 설정 화면에서 선택·저장(TENANT_ADMIN), 신고 준비 read model이 이 값을 직접 사용(기존 billing-profile 휴리스틱 제거). 미지정(null)이면 흐림 없음. [Filing Preparation Hub Pre-Code Brief §4](../03_Technical_Specs/15_FILING_PREPARATION_PRE_CODE_BRIEF.md) 참조. |

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
- Related UI Docs: [Screen Flow 4c](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.3/4.3a](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: [02_bookkeeping_review.html](../02_UI_Screens/previews/02_bookkeeping_review.html) — 기장검토 분류 큐. [12_reconciliation_ledger.html](../02_UI_Screens/previews/12_reconciliation_ledger.html) — 자료대조원장 전용 Path 1 관문 Preview(2026-07-08 승인)
- Related Technical Docs: [Component & Library Plan 7.3](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [Bookkeeping Review Pre-Code Brief](../03_Technical_Specs/06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md) · [Reconciliation Ledger Phase 2 Brief](../03_Technical_Specs/41_RECONCILIATION_LEDGER_V2_PRE_CODE_BRIEF.md) · [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) · [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md)
- Related QA Docs: [Bookkeeping Review Test Scenarios](../05_QA_Validation/04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md) - 분류 큐 집계·신뢰도·승인 mutation·Preview 계약·범위 격리 검증
- Prototype Review / 승인: [Bookkeeping Review](../02_UI_Screens/04_BOOKKEEPING_REVIEW_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인. [Reconciliation Ledger](../02_UI_Screens/12_RECONCILIATION_LEDGER_PROTOTYPE_REVIEW.md) — 자료대조원장 전용 Preview, 2026-07-08 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [x] Component & Library Plan에 기장검토 전용 컴포넌트(Confidence Bar·Journal Entry Preview) 반영 — [7.3 기장검토 매핑](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
  - [x] Pre-Code Technical Brief(분류 큐 데이터 소스·AI 추천 신뢰도·승인 mutation·분류 확정) 정리 — [Bookkeeping Review Pre-Code Brief](../03_Technical_Specs/06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md)
  - [x] 회사 tenant/기간·전표 데이터 모델 확인 — [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) 기준 기존 bookkeeping 테이블 재사용, `clientId`→`businessEntityId` 개념 전환, 물리 rename은 JC-005 후속
  - [x] QA 테스트 시나리오 작성 (Layer 5) — [Bookkeeping Review Test Scenarios](../05_QA_Validation/04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md)
  - [x] 자료대조원장 Phase 2 행동 계약 작성 — [Reconciliation Ledger Phase 2 Brief](../03_Technical_Specs/41_RECONCILIATION_LEDGER_V2_PRE_CODE_BRIEF.md)
  - [ ] 자료대조원장 Slice 2a read model 착수 전 검토 — 입출금↔증빙 후보·blocker 파생
  - [x] 자료대조원장 반복 패턴 추천 계약 검토 — 전월/최근 확정 이력 기반 추천, 확정 row 정의, AI 추천과 패턴 추천 관계, 자동 확정 금지
  - [x] 자료대조원장 AI escalation/fallback 계약 검토 — 규칙→패턴→단일 AI→multi-provider consensus→수동 검토, LLM 실패·타임아웃 시 화면 비차단
  - [ ] 자료대조원장 Slice 2b mutation mapping 착수 전 검토 — 계정확정·소명·제외 사유 저장
  - [ ] 자료대조원장 Slice 2c durable match-link schema 필요 여부 판단
- Acceptance Criteria:
  - [x] 정규화된 거래가 분류 큐에 AI 추천 계정과목·신뢰도와 함께 표시된다.
  - [x] 신뢰도 낮은 거래는 승인 전 "계정 지정"으로 강제 확인된다.
  - [x] 개별·다중(일괄) 승인이 가능하고 승인 시 분류 status가 confirmed로 확정된다(전표 생성은 v1 범위 밖, 후속). 다중 승인은 세션별 그룹 호출.
  - [x] 선택 거래의 분개 미리보기(차/대변, 부가세대급금 포함)와 기간 귀속·부가세 공제가 표시된다.
  - [x] AI 추천은 초안이며 최종 확정 책임은 사용자에게 있다.
  - [x] **회사 기장검토 화면은 GIWA `/dashboard/reviews` 워크스페이스 컴포넌트를 import/render하지 않는다**(Preview 계약, 정적 테스트로 강제).
  - [x] 로딩·빈·오류 상태가 화면에 구현된다.
  - [x] 기장검토 하위 메뉴 "자료대조원장"이 Path 1의 자료 대조·계정확정 관문으로 표시된다.
  - [x] 자료대조원장 전용 Preview가 통장·카드·세금계산서·현금영수증을 한 원장 표에서 대조하는 구조로 승인됐다(2026-07-08).
  - [x] `/dashboard/bookkeeping/reconciliation-ledger` 전용 라우트 1차 구현으로 자료대조원장 화면이 기장검토 분류 큐와 분리된다.
  - [ ] 자료대조원장에 입출금↔세금계산서/카드/현금영수증/영수증 매칭 후보가 표시된다.
  - [ ] 자료대조원장에 전월/최근 확정 패턴 기반 계정·증빙·제외 추천이 표시되고, 추천 이유와 수락/변경/거부 액션이 제공된다.
  - [ ] 자료대조원장 AI/LLM 판단은 실패·타임아웃·quota·provider disagreement 상황에서도 화면 렌더와 사용자 검토를 막지 않고 수동 확인 상태로 fallback된다.
  - [ ] 자료대조원장에서 계정항목 확정·사용내역 소명·업무무관/사적 사용 제외 사유가 한 화면 흐름으로 처리된다.
  - [ ] 세목별 Path 1 양식·파일 생성은 자료대조원장 blocker가 해소된 확정 거래만 사용한다.
- Document Sync Check: Screen Flow 4c / UI Design 4.3+4.3a / Prototype Review / Preview / Component Plan 7.3 / Pre-Code Brief / QA Scenarios 상호 링크됨. 2026-07-08: "자료대조원장"은 신고 준비 하위가 아니라 기장검토 하위 진입점으로 정리했고, 전용 Preview(12)에서 통장·카드·세금계산서·현금영수증 대조 원장 구조를 승인했다. `/dashboard/bookkeeping`은 기장검토 분류 큐로 유지하고, `/dashboard/bookkeeping/reconciliation-ledger` 전용 라우트 1차 구현으로 자료대조원장 화면을 분리한다. 1차 구현은 기존 classification read model을 재사용한다. 2026-07-08 02:01: Phase 2 Brief(41)로 입출금↔증빙 후보, 계정확정, 사용내역 소명 모달, 제외 사유 taxonomy, 세목별 Path 1 blocker 계약을 고정했다. 2026-07-08 03:12: 현재 앱의 자료대조원장은 아직 1차 slice이며 완성형이 아니다. 완성 기준은 우측 작업 패널, 통장 입출금↔세금계산서 매칭, 카드↔증빙 연결, 증빙 찾기, 사용내역/소명 입력, AI 계정 추천과 불확실 항목 사용자 선택, 사적·업무무관 의심 표시, 제외 사유 선택, 계정항목 인라인 수정까지 포함한다. 전월/최근 확정 패턴은 계정·증빙·제외 추천의 근거로만 사용하며, 사용자의 수락/변경/거부 없이 자동 확정하지 않는다. AI 판단은 규칙→패턴→단일 AI→multi-provider consensus→수동 검토 fallback 순서로 단계화하고, LLM 실패·타임아웃·quota·provider disagreement가 화면 렌더나 사용자 검토를 막지 않도록 Brief 41에 비차단 런타임 계약을 추가했다. 자동 매칭 엔진·신규 DB는 Brief 41의 Slice 2c 조건 없이는 도입하지 않는다. 구현 파일: `lib/bookkeeping-review/summary.ts`, `app/(dashboard)/dashboard/bookkeeping/page.tsx`, `app/(dashboard)/dashboard/bookkeeping/_components/bookkeeping-review.tsx`, `app/(dashboard)/dashboard/bookkeeping/loading.tsx`, `app/(dashboard)/dashboard/bookkeeping/error.tsx`, `app/(dashboard)/dashboard/bookkeeping/reconciliation-ledger/page.tsx`, `app/(dashboard)/dashboard/bookkeeping/reconciliation-ledger/_components/reconciliation-ledger.tsx`, `app/(dashboard)/dashboard/bookkeeping/_components/bookkeeping-review.test.tsx`.

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
  - [ ] 자동 홈택스 제출은 제공하지 않는다(패키지 + 준비값 확인까지). 세액은 검토 완료 전 "예정" 표기.
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
- Related QA Docs: [Filing Support Test Scenarios](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md) — 신고 항목 연동·패키지 잠금·준비값 확인·접수증 보관·책임 경계(자동 제출 없음)
- Prototype Review / 승인: [Filing Support Review](../02_UI_Screens/07_FILING_SUPPORT_PROTOTYPE_REVIEW.md) — 확인자 프로젝트 오너, 2026-07-01 승인
- Implementation Preconditions:
  - [x] UI-First Gate 통과 (사용자 확인 완료)
  - [x] Component & Library Plan에 신고지원 전용 컴포넌트(Filing Item Card·Preparation Values·Receipts·Checklist) 반영 — [Component Plan 7.6](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
  - [x] Pre-Code Technical Brief(신고 항목 연동·패키지 생성·접수증 보관·체크리스트 mutation) 정리 — [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md)
  - [x] 부가세(JC-011)·급여(JC-012) 산출물 데이터 모델 선행 — `vat_period_summary`, `payroll_period_summary`
  - [x] QA 테스트 시나리오 작성 (Layer 5) — [Filing Support Test Scenarios](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
- Acceptance Criteria:
  - [x] 신고 항목(부가세/원천세/4대보험)이 선행 화면 산출물과 연동되어 상태와 함께 표시된다. (`loadFilingSupportSummary`, `FilingItemsSection`)
  - [x] 부가세 패키지는 공제 검토 완료 전 잠금이다. (`pendingDeductionCount` 기반 locknote + disabled CTA)
  - [x] 신고 준비값 확인 영역이 확정 값과 함께 제공된다. 홈택스 직접입력용 복사 버튼은 Path 1 양식·파일 작성 방향에 맞춰 제거한다. (`buildFilingPreparationValues`)
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
  - [x] 수신자 source 결정 — v1 기본은 담당자 본인·내부 staff 발송(자가 리마인드). 직원 명부(JC-015) 기반 급여 도메인 직원 수신은 JC-018에서 완료
  - [x] `internal_reminder_*` 물리 Drizzle migration 확정 — `lib/db/schema.ts`, `drizzle/0057_add_internal_reminder_tables.sql`
  - [x] Resend/env/test-send 확인 — provider missing guard + 테스트 발송 API 구현. 실제 provider E2E는 배포 env 설정 후 검증
  - [x] 실행 방식과 idempotency key 확정 — 수동 즉시 발송 + deterministic idempotency key 구현, Vercel Cron 자동 예약은 JC-017에서 완료
- Acceptance Criteria:
  - [x] 리마인드는 회사 내부 수신자에게만 발송된다.
  - [x] 확인 필요 상태가 리마인드 대상으로 연결된다.
  - [x] v1 기본 수신자는 담당자 본인·내부 staff로 결정되며, 비활성/이메일 없는 대상은 제외된다. 직원 명부 기반 급여 도메인 직원 수신은 JC-018에서 완료했다.
  - [x] 같은 조건의 수동·cron 리마인드는 idempotency key/send_log로 중복 발송되지 않는다. Cron 자동 예약은 JC-017에서 완료했다.
  - [x] 발송 로그는 성공/실패/스킵 상태와 실패 사유를 남긴다.
  - [x] 외부 고객 요청 메일, 외부 업로드 포털 초대, 자동 홈택스 제출/납부는 제공하지 않는다.
  - [x] 로딩·빈·오류·provider missing 상태가 구현된다.
- Document Sync Check: Screen Flow 8 / UI Design 4.9 / Prototype Review / HTML Preview / DB Schema 4.5 / Internal Reminder Mail Pre-Code Brief / QA Scenarios / Backlog Context Lock 상호 링크됨. 구현 파일: `lib/db/schema.ts`, `drizzle/0057_add_internal_reminder_tables.sql`, `lib/internal-reminders/summary.ts`, `lib/internal-reminders/send.ts`, `lib/internal-reminders/summary.test.ts`, `lib/internal-reminders/send.test.ts`, `lib/validations/internal-reminders.ts`, `app/(dashboard)/dashboard/reminders/page.tsx`, `_components/internal-reminders-workspace.tsx`, `_components/reminder-actions.tsx`, `_components/internal-reminders-workspace.test.ts`, `loading.tsx`, `error.tsx`, `app/api/internal-reminders/rules/[ruleId]/route.ts`, `app/api/internal-reminders/rules/[ruleId]/test-send/route.ts`, `app/api/internal-reminders/send-now/route.ts`, `app/(dashboard)/_components/sidebar.tsx`, `app/(dashboard)/layout.tsx`.

### JC-017 · Schedule internal reminder cron (내부 리마인드 cron + 레거시 cron 정리) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) — 기한 내 신고를 돕는 내부 알림, 자동제출 제외 경계
- Related UI Docs: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) 8번 항목 · [Internal Reminder Prototype Review](../02_UI_Screens/09_INTERNAL_REMINDER_PROTOTYPE_REVIEW.md) — 리마인드 규칙·수신자·발송 로그(JC-016에서 승인 완료)
- Related HTML Preview: [07_internal_reminder.html](../02_UI_Screens/previews/07_internal_reminder.html) — JC-016 승인 화면 재사용(cron은 UI 변경 없음, 백엔드 예약만 추가)
- Related Technical Docs: [Internal Reminder Cron Pre-Code Brief](../03_Technical_Specs/14_INTERNAL_REMINDER_CRON_PRE_CODE_BRIEF.md) — cron 처분·시스템 로더·D-day 판정·멱등성 계약 · [Internal Reminder Mail Pre-Code Brief](../03_Technical_Specs/11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) — JC-016 발송·규칙 선행 계약
- Related QA Docs: [Internal Reminder Mail Test Scenarios](../05_QA_Validation/09_INTERNAL_REMINDER_MAIL_TEST_SCENARIOS.md) — cron due 판정·멱등성·테넌트 격리 시나리오 추가됨(S-80~S-88)
- Prototype Review / 승인: JC-016 화면 승인(2026-07-02) 재사용. cron은 UI 표면 변경 없음.
- Implementation Preconditions:
  - [x] JC-016 발송·규칙·멱등성 계약 확정 (선행)
  - [x] 레거시 cron 6개 성격 조사 완료 — [Brief §2](../03_Technical_Specs/14_INTERNAL_REMINDER_CRON_PRE_CODE_BRIEF.md)
  - [x] 레거시 cron 처분 결정 — vercel.json에서 4개 제거, 고립된 legacy cron route 삭제 완료
  - [x] D-day 트리거 의미 확정 — daily_digest=확인 필요(attentionCount>0)일 때만, deadline_offset=마감−offsetDays 당일, manual=cron 제외([Brief §4](../03_Technical_Specs/14_INTERNAL_REMINDER_CRON_PRE_CODE_BRIEF.md))
  - [x] 세션 없는 시스템 스코프 summary 로더 설계 확정 — `loadInternalReminderSummaryForSystem({ tenantId, periodKey?, today? })`, [Brief §3](../03_Technical_Specs/14_INTERNAL_REMINDER_CRON_PRE_CODE_BRIEF.md)
  - [x] 규칙 `domain` ↔ 세무 마감 매핑 확정 — v1 `deadline_offset` 기본 대상은 `vat`, 그 외 도메인은 `daily_digest` 또는 `manual`, [Brief §4](../03_Technical_Specs/14_INTERNAL_REMINDER_CRON_PRE_CODE_BRIEF.md)
- Acceptance Criteria:
  - [x] `/api/cron/internal-reminder`가 `verifyCronAuth` 통과 후에만 실행되고, cron lock으로 하루 1회 보장된다. (S-80·S-81)
  - [x] daily_digest=확인 필요(attentionCount>0)일 때만 / deadline_offset=마감−offsetDays 당일 / manual=cron 제외로 due가 판정된다. (S-82~S-86)
  - [x] 세션 없이 테넌트 스코프로 활성 규칙을 조회·발송한다(userId 의존 제거). (S-88)
  - [x] 한 테넌트 발송 실패가 다른 테넌트를 막지 않고, 기존 send_log 멱등성으로 재발송이 방지된다. (S-87·S-43)
  - [x] vercel.json에서 레거시 cron 4개 제거 + 신규 cron 1개 등록. cleanup-send-locks·billing-renewals는 유지.
  - [x] 고립된 레거시 cron route 삭제까지 완료됐다.
- Component & Library Plan:
  - shadcn/ui components: N/A - 백엔드 cron 작업, UI 없음
  - Custom components: N/A
  - Reused components: N/A
  - New libraries: N/A - 기존 Resend·drizzle·luxon·cron lock 재사용
  - Libraries intentionally not added: N/A
  - shadcn preset action: N/A - UI 변경 없음
- Document Sync Check: 구현 완료(2026-07-04). Brief(14) / Backlog Context Lock / JC-016 계약 상호 링크. 구현 파일: `app/api/cron/internal-reminder/route.ts`(신규, 테넌트 순회+due 판정+테넌트 격리), `lib/internal-reminders/summary.ts`(`loadInternalReminderSummaryForSystem`·`isInternalReminderRuleDue`·`INTERNAL_REMINDER_SYSTEM_USER_ID` 추가), `lib/internal-reminders/send.ts`(`InternalReminderSendMode`에 `cron` 추가, staffId nullable, cron persist가 편집자 정보 미덮어씀), `lib/internal-reminders/summary.test.ts`(due 판정·시스템 스코프 수신자 5건 추가), `vercel.json`(레거시 4개 제거+internal-reminder 추가), QA 시나리오 S-80~S-88(09_INTERNAL_REMINDER_MAIL_TEST_SCENARIOS). 전체 204파일 1334건 통과, tsc/eslint 클린, CRON_SECRET Production 설정 확인. 고립된 레거시 cron route 삭제 완료.

### JC-018 · Connect employee directory recipients to reminders — 급여 도메인 한정 mixed 수신 (우선순위 높음 · 저위험)

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) — 회사 self-use 세무 준비, 개인정보 최소 수집 원칙
- Related Domain: 내부 리마인드(JC-016·JC-017), 급여(JC-012, `payrollEmployeeLine.status`), 직원 명부(JC-015, `employee_profile.workEmail`·`notificationEnabled`)
- Related UI Docs: N/A - 신규 화면 없음. 기존 리마인드 화면([Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) 8번 항목·[UI Design 4.9](../02_UI_Screens/01_UI_DESIGN.md))의 발송 로직만 확장. 규칙별 recipient_source UI는 후속(그 시점 별도 UI Preview 필요).
- Related HTML Preview: N/A - 신규 화면 없음(기존 리마인드 화면 [07_internal_reminder.html](../02_UI_Screens/previews/07_internal_reminder.html) 그대로, 이메일 발송 로직만 변경).
- Related Technical Docs: [Payroll Employee Reminder Pre-Code Brief](../03_Technical_Specs/17_PAYROLL_EMPLOYEE_REMINDER_PRE_CODE_BRIEF.md) — 직원 매칭·이메일 콘텐츠 분리·발송 흐름 계약 · [Internal Reminder Mail Pre-Code Brief](../03_Technical_Specs/11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) — JC-016 선행 계약 · [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md) — needs_review 라인 정의
- Related QA Docs: [Internal Reminder Mail Test Scenarios](../05_QA_Validation/09_INTERNAL_REMINDER_MAIL_TEST_SCENARIOS.md) — 구현 시 직원 매칭·제외 조건·이메일 콘텐츠 안전성 시나리오 추가 대상(S-90번대)
- Prototype Review / 승인: N/A - 백엔드 발송 정책 변경, 신규 UI 없음.
- **v1 Scope 확정 (2026-07-05):**
  - **대상 도메인**: payroll(급여) 내부 리마인드 규칙 한정. 다른 도메인은 v1에서 staff만 유지.
  - **mixed 수신자 정의**: staff(기존 전체 요약 이메일, 변경 없음) **+ 그 시점 `payrollEmployeeLine.status === 'needs_review'`인 직원만**(전체 직원 아님). employeeCode로 `employee_profile` 매칭.
  - **직원 이메일 내용**: 금액·세액 등 민감정보 절대 미포함. 일반 문구("급여/인적사항 확인 요청이 있습니다")만. staff 이메일(상세 요약)과 다른 별도 템플릿.
  - **제외 조건**: 명부 미매칭·`workEmail` 없음·`notificationEnabled=false`이면 해당 직원만 제외(그 직원 skip일 뿐 staff 발송에는 영향 없음).
  - **recipient_source 설정 UI는 후속**(JC-018-후속). v1은 payroll 도메인에 코드로 `mixed` 고정, 사용자가 규칙별로 바꿀 수 없다.
- Implementation Preconditions:
  - [x] v1 스코프 확정 — 급여 도메인 한정, needs_review 직원만, 민감정보 제외, 설정 UI 없음
  - [x] Pre-Code Brief 작성 — [17_PAYROLL_EMPLOYEE_REMINDER_PRE_CODE_BRIEF.md](../03_Technical_Specs/17_PAYROLL_EMPLOYEE_REMINDER_PRE_CODE_BRIEF.md)
  - [x] 직원 매칭 방식 확정 — employeeCode 정확 매칭만 허용(이름 fallback 미사용, 개인 이메일 오발송 방지). 매칭 실패/이메일 없음/알림 꺼짐/퇴사자는 제외([Brief §2](../03_Technical_Specs/17_PAYROLL_EMPLOYEE_REMINDER_PRE_CODE_BRIEF.md))
- Acceptance Criteria:
  - [x] payroll 리마인드 발송 시 staff는 기존과 동일한 전체 요약을 받는다(회귀 없음).
  - [x] 해당 시점 급여 확인 필요(needs_review) 직원만 추가로 이메일을 받는다(전체 직원 아님)(mode=manual/cron만; test는 직원 미발송).
  - [x] 직원 이메일 본문에 금액·세액·기타 민감정보가 포함되지 않는다(고정 템플릿, 단위 테스트로 금지어 검증).
  - [x] 직원 명부 미매칭·이메일 없음·알림 꺼짐·퇴사자 직원은 제외되고, staff 발송에는 영향 없다.
  - [x] payroll 외 도메인은 v1에서 동작 변경이 없다(staff만 유지, `rule.domain === 'payroll'` 분기로만 확장).
  - [x] recipient_source 규칙별 설정 UI는 이번 범위에 포함하지 않는다(payroll 도메인 mixed는 코드 분기).
- Document Sync Check: 구현 완료(2026-07-05, 리뷰 반영 포함). 구현 파일: `lib/internal-reminders/payroll-attention-employees.ts`(신규, needs_review 직원 조회·순수 필터 함수), `lib/internal-reminders/payroll-attention-employees.test.ts`(8건), `lib/internal-reminders/send.ts`(`composeEmployeePayrollReminderEmail` 신규, `writeSendLog` recipientType 매개변수화, `shouldSendPayrollEmployeeReminder` 순수 게이팅 함수 추출·`persistInternalReminderRule`이 `recipientSource`를 하드코딩 대신 그대로 저장), `lib/internal-reminders/summary.ts`(payroll 기본 규칙 `recipientSource: 'mixed'`, `recipientLabel`이 실제 발송 동작을 반영해 "담당자 본인 + 확인 필요 직원"으로 표시 — 리뷰 P1: 라벨이 "담당자 본인"으로 고정돼 실제 mixed 발송과 어긋나던 문제 수정), `lib/internal-reminders/send.test.ts`(민감정보 미포함 2건 + 게이팅 함수 3건), `lib/internal-reminders/summary.test.ts`(payroll/vat 라벨·recipientSource 회귀 1건). 전체 207파일 1379건 통과, tsc/eslint/build 클린.

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
- Document Sync Check: 2026-07-04 구현 반영. Screen Flow 4h / UI Design 4.10 / Component Plan 7.7 / DB Schema 4.6 / Pre-Code Brief / QA Scenarios가 상호 링크됨. 구현 파일: `drizzle/0058_add_first_run_sample_tables.sql`, `lib/first-run-sample/{seed,cleanup,summary,shared}.ts`, `app/api/first-run-sample/route.ts`, `app/(dashboard)/_components/sample-data-banner.tsx`, `app/(dashboard)/layout.tsx`, `app/api/onboarding/route.ts`.
  - **프로덕션 Browser E2E 완료(2026-07-04, PR #41)**: 신규 계정 가입→온보딩→자동 seed(dataset active, registry 427행)→전역 배너·워크스페이스(급여 12명 등) 채워짐 확인. "샘플 데이터 삭제하고 실제 사용 시작"→확인 dialog→삭제 실행 후 DB 스냅샷 검증: **샘플 도메인 행(payroll_line 12→0, upload_file 4→0, filing_item 3→0, employee_profile 14→0, vat/bookkeeping 0) 전부 삭제 · `client`(사업장)·tenant·staff 보존 · dataset `deleted`(재생성 없음)**. 삭제 경계(registry+whitelist+delete_order+tenant scope) 실전 안전 확인 — 재검증 불필요.
  - **회귀·재발방지**: 배포 중 `SampleDataBanner`(client)가 `summary`→`lib/db`→`lib/env`를 클라이언트 번들로 끌어들여 "Missing required environment variables"로 대시보드가 크래시. `lib/first-run-sample/shared.ts`(db import 없는 client-safe 모듈)로 분리(PR #42), `lib/env`·`lib/db`에 `import 'server-only'` 가드 추가로 동일 누수를 빌드타임에 차단.

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
  - [x] 프로덕션 first-run 노출 표면 전수 검색 — signup, sign-in, onboarding, welcome modal, domain suffix (grep 완료)
  - [x] `JARYO beta`, `JARYO Company`, `SemuDesk`, `.jaryo.kr` 잔재를 SemuAgent 정책에 맞게 분류
  - [x] `jaryo-admin`/`JARYO_ADMIN_EMAILS`는 운영자 콘솔 식별자로 **유지(보존) 결정** — 범위 밖
  - [ ] 브라우저 smoke로 신규 가입→온보딩 copy 확인 — 배포 후 수동 확인 예정
- Acceptance Criteria:
  - [x] 가입 직후 welcome modal은 SemuAgent 문맥과 카피를 사용한다. — 모달 카피 재구성(배지·제목·본문·카드·주의문)
  - [x] 온보딩 서브도메인 suffix는 `.jaryo.kr`로 노출되지 않는다. — 접미사 제거(중립)
  - [x] 첫 가입/온보딩 사용자가 보는 표면에 `JARYO Company`, `JARYO beta`, `SemuDesk` 잔재가 없다. — grep 0건
  - [x] JARYO-GIWA 출처 기록과 운영자 콘솔 식별자는 제품 first-run UX와 구분해 보존한다. — 홈/문서 이력·jaryo-admin·localStorage 내부키 미변경
- Document Sync Check: 2026-07-03 프로덕션 E2E에서 `JARYO beta` 모달과 `.jaryo.kr` suffix가 발견되어 등록. 코드 변경은 후속 PR에서 처리.

### JC-022 · Refine settings screen product language (설정 화면 제품 언어 정리) — 신규

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) — 소규모 회사가 직접 쓰는 세무 보조 제품 문맥
- Related UI Docs: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: N/A - 설정 화면은 기존 승인 workspace Preview 범위 밖이며, 프로덕션 E2E에서 실제 설정 화면을 보고 발견한 UX/용어 후속이다. 필요 시 settings preview를 추가한다.
- Related Technical Docs: [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) · [DB Schema 2.1](../03_Technical_Specs/03_DB_SCHEMA.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
- Related QA Docs: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md)
- Prototype Review / 승인: N/A - 현재 설정 화면의 `테넌트 설정`, `테넌트 정보`, `.jaryo.kr` suffix가 사용자 언어와 맞지 않는다는 프로덕션 E2E 관찰에 기반한다.
- Implementation Preconditions:
  - [x] 설정 화면 노출 문구 전수 검색 — `settings/page.tsx`, `settings-panel.tsx` (grep 완료)
  - [x] `테넌트` UI 표기를 사용자 언어로 확정 — `회사 설정` / `회사 정보`
  - [x] 서브도메인 표시 정책 확정 — **중립(가짜 도메인 제거)**, 실도메인 확정 후 실접미사 재적용(후속)
  - [ ] `업무메일 설정` 탭이 JC-016 내부 리마인드와 중복/혼동되지 않는지 검토 — 후속(이번 범위는 브랜드/용어)
  - [ ] 설정 화면 browser smoke 또는 정적 텍스트 회귀 테스트 추가 — 배포 후 수동 확인 예정
- Acceptance Criteria:
  - [x] 설정 화면 탭과 부제에서 개발자 용어 `테넌트`가 사용자에게 보이는 문구로 노출되지 않는다.
  - [x] 서브도메인 읽기 전용 필드가 `.jaryo.kr`로 표시되지 않는다.
  - [x] 회사명, 담당자, 업무메일, 사업장 관리가 SemuAgent 책임 경계에 맞는 설명으로 정리된다. — 담당자 추가 설명 `JARYO`→`SemuAgent` 등
  - [x] 운영자 콘솔/DB 내부 식별자(`tenant_id`, `jaryo-admin`)는 사용자 설정 화면과 분리해 보존한다. — 코드 주석·내부 식별자 미변경
- Document Sync Check: 2026-07-03 프로덕션 E2E 중 설정 화면에서 발견. 코드 변경은 후속 PR에서 처리하며, JC-021(first-run 브랜드 잔재)와 구현 범위가 겹치면 같은 PR에서 함께 처리 가능.

### JC-023 · Strategic Direction: 사용자 승인 기반 홈택스 자동제출 — 로드맵/전략 방향 (MVP 밖)

- Related Concept: [Product Baseline — Strategic Direction](../01_Concept_Design/01_PRODUCT_BASELINE.md) — MVP는 자동제출 없음(Non-Scope), 최종 목표는 사용자 승인 기반 홈택스 자동제출
- Related Domain: [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md) — 현행 신고지원(JC-013)은 준비값 확인·접수증 보관 단계
- Related Research: [JC-023 Hometax Auto-submit Research](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md) — 2026-07-04 조사 브리프(파일 규격·공식 API·법적 경계·인증 자동화·실무 SW 제출 흐름 통합)
- Related Completion Contract: [Open Backlog Completion Contracts §3 / JC-023](../03_Technical_Specs/22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md) — 자동제출 구현 착수 게이트와 done 조건
- Related HTML Preview: N/A - 로드맵/전략 항목. 구현 착수 시 별도 UI·technical brief 필요.
- Prototype Review / 승인: N/A - MVP 밖 전략 방향. 구현 전 조사·설계·법무/보안 검토 선행.
- Implementation Preconditions (조사 과제):
  - [x] 홈택스 전자신고 파일 규격 조사 — [Research §2.1](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md): 세목별 표준 규격 존재, 부가세·원천세·법인세 파일변환신고 가능. 부가세·법인세 상세 규격서 공식 입수 경로는 [미확인].
  - [x] 파일변환신고 방식 조사 — [Research §2.5](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md): 확인한 주요 실무 SW 매뉴얼 기준 "규격 파일 → 홈택스 파일변환신고 → 인증서 서명 제출" 동일 관문. 최종 서명은 사람.
  - [x] 사용자 인증 기반 제출 자동화 가능성 조사 — [Research §2.4](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md): 자격증명 원문 미저장 자동화 기술적 가능(간편인증 PUSH 등). 일반 공개 무인 제출 API는 확인되지 않음.
  - [ ] 공식 API vs 비공개 연동 여부 **결정** — 공개 조사 기준 제출용 API 미확인·스크래핑은 국세청 차단 중([Research §2.2/§2.4]). 국세청 오픈API 제출 지원 범위·개시·수수료는 [미확인] → 126 공식 문의 후 결정.
  - [ ] 법무/보안 검토 (**구현 게이트**) — 세무사법상 자동 작성·제출의 세무대리 해당 여부, 홈택스 이용규정 자동화 조항, 2026.6.24 개정 마케팅 표현 규제, 인증·개인정보 처리. [Research §2.3]
  - [ ] 파일 규격 **적합성 검정** 요건·절차 확인 (정식 제출 자격의 관문, [Research §2.5]) — 국세청 공식 문의
- Acceptance Criteria (최종 목표 + 필수 원칙):
  - [ ] 사용자가 신고 내용을 최종 확인·승인한 뒤에만 제출이 진행된다.
  - [ ] 홈택스/공동인증서/비밀번호 등 자격증명 원문을 서버에 저장하지 않는다.
  - [ ] 모든 제출 시도·결과가 감사 로그에 남는다.
  - [ ] 제출 후 접수증을 자동으로 회수·보관한다.
  - [ ] 자동제출은 사용자 권한 범위 안에서만 수행되며 세무대리로 포지셔닝하지 않는다.
- Document Sync Check: 2026-07-04 전략 방향 등록 + **실현가능성 리서치 브리프 작성**([13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md), 5개 병렬 조사 통합). MVP 범위는 변경 없음(자동제출 없음, 홈택스 제출 보조). **핵심 결론**: 파일 생성·파일변환신고까지 실현 가능하나 완전 무인 제출은 공개 조사 기준 일반 공개 제출 채널 미확인 → 실현가능한 최대치는 "사용자 승인 기반 self-filing(사용자 최종 인증 서명)". 남은 게이트: 국세청 126 공식 문의(규격 입수·적합성 검정·오픈API 제출 범위) + 법무 검토. 구현 착수 시 별도 Pre-Code Brief/QA 신설.

### JC-024 · 연말정산·지급명세서 지원 — 급여/원천 도메인 확장 (우선순위 높음 · 저위험)

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) — 회사 self-use 세무 준비
- Related Technical Docs: [Payment Statement · Year-end Pre-Code Brief](../03_Technical_Specs/16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md) — 반기 집계·연말정산 검토·허브 트랙 live 데이터 계약.
- Related Domain: 급여(JC-012) · 신고지원 원천세(JC-013) · 직원 명부(JC-015) 데이터 확장. 자동제출은 [JC-023](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md) 원칙 준수.
- Related HTML Preview: [09_payment_year_end.html](../02_UI_Screens/previews/09_payment_year_end.html) — 지급명세서·연말정산 전용 검토 화면(UI-First Gate 승인 2026-07-05). 신고 준비 허브(JC-029) "지급명세서/연말정산" 트랙을 roadmap→live로 전환.

- **v1 Scope 확정 (2026-07-05):**
  - **지급명세서**: 간이지급명세서(근로소득) **우선**. 기존 월별 payroll `withholding_statement` 데이터를 반기 단위로 집계. 연간 지급명세서·사업소득 명세서는 후속.
  - **연말정산**: **데이터 준비·검토까지**. 직원별 연간 지급·기납부 원천세 집계·누락 검토. **정산액(결정세액·환급/추징) 계산은 제외**(후속). 소득·세액공제 자동계산 미포함.
  - **JC-030 경계**: JC-024는 **신고 준비 데이터셋·검토 상태**까지. **전자신고 파일 생성은 JC-030**(JC-024에 넣지 않음).
  - **허브 live 범위**: 신고 준비 허브 트랙 live 전환 **+ 전용 검토 화면**(지급명세서/연말정산 준비·누락 검토).
  - 재사용: 급여 `PayrollDocumentPreview.withholding_statement`, 신고지원 `withholding` 항목, 직원 명부. 지방소득세 분리 근사 로직은 JC-027에서 확정 라인 실제값 집계로 교체됨.
- Implementation Preconditions:
  - [x] v1 스코프 확정 (2026-07-05) — 간이지급명세서(근로) 우선 · 연말정산 데이터·검토까지 · JC-030 경계 · 트랙 live+검토 화면
  - [x] 간이지급명세서(근로소득) 반기 집계 read model 매핑 확정 — 지급총액=ΣgrossPay, 원천징수세액=ΣincomeTax(근로소득세), 준비상태 판정([Brief §4](../03_Technical_Specs/16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md))
  - [x] 연말정산 준비·검토 매핑 확정 — 연간 지급합계·기납부 원천세·중도퇴사, 정산액 계산 제외([Brief §5](../03_Technical_Specs/16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md)). 인적사항 누락은 저장 필드로만(주민번호 미저장, §6)
  - [x] 지급명세서 제출 주기 확인 완료 — JC-024 v1은 근로소득 간이지급명세서 **반기 제출 주기** 기준([Brief §4](../03_Technical_Specs/16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md)). 전자신고 파일 서식은 JC-030으로 이관([JC-023 Research §2.1](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md))
  - [x] self-filing 보조 경계 확정 — 자동 제출 없음·자격증명 미저장·최종 제출은 사용자 직접([Brief §0·§1·§10](../03_Technical_Specs/16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md))
  - [x] **UI-First Gate**: 전용 검토 화면 HTML Preview 작성·사용자 승인 — [09_payment_year_end.html](../02_UI_Screens/previews/09_payment_year_end.html), 2026-07-05 승인(단일 스크롤·직원 중심 표·신고 준비 데이터 용어 통일)
  - [x] Pre-Code Brief 작성 — [16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md](../03_Technical_Specs/16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md)
- Acceptance Criteria:
  - [x] 간이지급명세서(근로소득) 준비 상태·누락을 회사 담당자가 확인하는 read model/화면 제공
  - [x] 연말정산 준비·검토(직원별 연간 지급·기납부 집계)를 제공하되 정산액 계산은 v1 범위 밖으로 명시
  - [x] 신고 준비 허브의 지급명세서/연말정산 트랙이 roadmap→live로 전환되고 입력·산출·handoff로 읽힌다
  - [x] 전자신고 파일 생성은 포함하지 않는다(JC-030 경계)
  - [x] 제출은 사용자 승인 기반(JC-023 원칙), 자격증명 원문 미저장 (read-only, mutation 없음)
  - [x] 급여·원천세·직원명부 기존 데이터와 정합 (신규 테이블·마이그레이션 없음)
- Document Sync Check: 구현 완료(2026-07-05). 구현 파일: `lib/payment-statements/summary.ts`(반기·연말정산 집계·순수함수), `lib/payment-statements/summary.test.ts`(14건), `app/(dashboard)/dashboard/filing-preparation/payment-statements/`(page·_components/payment-statement-review·loading·error), `lib/filing-preparation/summary.ts`(payment_statement 트랙 roadmap→live). 전체 206파일 1360건 통과, tsc/eslint/build 클린. 기존 컬럼만 조회(payroll·employee_profile) — 신규 마이그레이션 없음(프로덕션 DB 조치 불필요).

### JC-025 · 종합소득세 신고 지원 (개인사업자) — self-filing 보조 (우선순위 중 · 법적 경계 주의)

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related Domain: 기장검토(JC-010) output · 신고지원(JC-013). 법적 경계는 [JC-023 Research §2.3](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md)(세무사법).
- Related Completion Contract: [Open Backlog Completion Contracts §3 / JC-025](../03_Technical_Specs/22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md) — 종소세 v1 범위·법무 게이트·done 조건
- Related HTML Preview: N/A.
- Implementation Preconditions:
  - [ ] 종소세 신고서 계산 로직·필요 데이터(기장 output) 매핑
  - [ ] 세무조정 개입 범위 확정 — 자동작성 vs 사용자 입력·확인 경계
  - [ ] **법무 검토** — 세무사법 제2조("세무서류 작성") 저촉 여부, self-filing 경계
- Acceptance Criteria:
  - [ ] 계산·초안은 제공하되 세무 판단·최종 확인은 사용자에게 강제한다
  - [ ] 세무대리로 포지셔닝하지 않고 표시·광고 규제(세무사법 제20조3항·제22조의2 10호) 준수
  - [ ] 제출은 사용자 승인 기반(JC-023)
- Document Sync Check: 2026-07-04 등록. 법적 경계로 법무 검토 게이트. 착수 시 Pre-Code Brief/QA 신설.

### JC-026 · 법인세 신고 지원 (법인) — 법적 경계 강함 (우선순위 낮음)

- Related Concept: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related Domain: 기장검토(JC-010) output. 법적 경계는 [JC-023 Research §2.3](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md).
- Related Completion Contract: [Open Backlog Completion Contracts §3 / JC-026](../03_Technical_Specs/22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md) — 법인세 법무 게이트·defer/제휴/제한 구현 완료선
- Related HTML Preview: N/A.
- Implementation Preconditions:
  - [ ] 법인세 신고·세무조정계산서 범위 정의 및 복잡도 평가
  - [ ] **법무 검토(필수 게이트)** — 세무조정계산서 작성 = 세무사 직무(세무사법 제2조), 무자격 세무대리 리스크 최상
  - [ ] self-filing 보조로 한정 가능한지, 세무사 제휴 필요 여부 판단
- Acceptance Criteria:
  - [ ] 세무조정계산서 관련 기능이 세무대리에 해당하지 않는 범위로 한정된다(법무 확인)
  - [ ] 계산·초안·검증 중심, 세무 판단·최종 확인은 사용자
  - [ ] 제출은 사용자 승인 기반(JC-023)
- Document Sync Check: 2026-07-04 등록. 세 항목 중 법적 리스크 최상 → 안정화·저위험 항목 후 착수. 법무 검토 필수.

### JC-027 · 지방소득세 연동 지원 — 원천세 특별징수분 한정, 신고 준비 허브 마지막 트랙 (우선순위 높음 · 저위험)

- Related Concept: [Product Baseline — Target Tax Coverage](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related Domain: 급여(JC-012, `payrollEmployeeLine.localIncomeTaxKrw`), 신고지원(JC-013, 원천세 준비값 정합성 수정), 신고 준비 허브(JC-029, `local_income` 트랙)
- Related UI Docs: [Screen Flow 4j](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.12](../02_UI_Screens/01_UI_DESIGN.md) — 지방소득세 화면 흐름·컴포넌트(UI-First Gate 승인 2026-07-05).
- Related HTML Preview: [10_local_income_tax.html](../02_UI_Screens/previews/10_local_income_tax.html) — 지방소득세 준비 전용 화면(JC-024 `09_payment_year_end.html`과 유사한 read-only 집계 패턴 재사용).
- Related Technical Docs: [Local Income Tax Pre-Code Brief](../03_Technical_Specs/18_LOCAL_INCOME_TAX_PRE_CODE_BRIEF.md) — 확정 라인 실제값 집계 계약·splitWithholdingTax 교체 계약·허브 트랙 live 전환 계약.
- Related QA Docs: N/A - 별도 QA 문서 없이 단위 테스트·build로 검증.
- Prototype Review / 승인: 2026-07-05 브라우저 검토 승인. 문구 2건 반영(귀속기간/원천세 신고 주기 기준 표현, 소득세(국세)/지방소득세(특별징수) 컬럼 분리).
- **v1 Scope 확정 (2026-07-05):**
  - **대상**: "지방소득세 전체"가 아니라 **원천세 특별징수분만**. 종합소득세분·법인세분 지방소득세는 JC-025/026 완료 이후 별도.
  - **데이터 소스**: 급여에 **이미 실제 기록된** `payrollEmployeeLine.localIncomeTaxKrw`를 반기/월 단위로 집계한다. **신규 세액 계산 엔진 없음** — 10%/11 근사치 재계산 아님. 단, 신고 준비 금액 합계와 신고지원 입력값은 확정 라인(`ready`/`closed`)만 포함하고, `needs_review` 라인은 확인 필요·blocker에만 포함한다.
  - **화면**: 신규 read-only 전용 화면. 신고 준비 허브(JC-029)의 `local_income` 트랙을 roadmap→live로 전환(허브의 마지막 roadmap 트랙 완성).
  - **데이터 정합성 수정(중요, 같은 범위에 포함)**: 신고지원(JC-013)의 `lib/filing-support/summary.ts` `splitWithholdingTax()`가 원천세 합계(`withholdingTaxKrw`)를 10%/11로 **근사 계산**해 지방소득세를 표시하고 있다. 확정 라인의 실제 `localIncomeTaxKrw` 합계(JC-027이 만드는 것과 동일 소스)로 교체해, 신고지원 화면과 JC-027 화면이 **같은 기간에 다른 숫자를 보여주지 않게** 한다.
  - **제외**: 위택스/이택스 자동 제출, 종합소득세분·법인세분 지방소득세, 신규 세액 계산 로직.
- Implementation Preconditions:
  - [x] v1 스코프 확정 — 원천세 특별징수분 한정·실제값 소스·신고지원 정합성 수정 포함·위택스 자동제출 제외
  - [x] UI-First Gate: 지방소득세 준비 화면 HTML Preview 작성·사용자 승인 — [10_local_income_tax.html](../02_UI_Screens/previews/10_local_income_tax.html), 2026-07-05 승인
  - [x] Pre-Code Brief 작성 — [18_LOCAL_INCOME_TAX_PRE_CODE_BRIEF.md](../03_Technical_Specs/18_LOCAL_INCOME_TAX_PRE_CODE_BRIEF.md)
- Acceptance Criteria:
  - [x] 원천세 특별징수분 지방소득세가 직원별/기간별로 집계·표시된다(확정 라인의 실제 `localIncomeTaxKrw` 합계, 파생 계산 아님)
  - [x] `needs_review` 라인은 대상 인원·확인 필요·blocker에는 포함되지만 Hero/표 합계/신고지원 입력값에는 포함되지 않는다
  - [x] 신고 준비 허브의 `local_income` 트랙이 roadmap→live로 전환되고 입력·산출·handoff로 읽힌다
  - [x] 신고지원(JC-013)의 지방소득세 표시가 근사치 대신 확정 라인 실제 합계를 사용하도록 교체된다(정합성)
  - [x] 종합소득세분·법인세분 지방소득세는 이번 범위에 포함하지 않는다
  - [x] 위택스 자동 제출·신규 세액 계산 엔진은 포함하지 않는다
  - [x] 화면은 read-only이며 mutation을 수행하지 않는다
- Document Sync Check: 2026-07-04 등록 · 2026-07-05 v1 스코프 확정 + UI-First Gate 승인 + Pre-Code Brief 작성(18) + 리뷰 반영(`needs_review` 합계 제외 계약) + 구현 완료. 구현 파일: `lib/local-income-tax/summary.ts`, `lib/local-income-tax/summary.test.ts`, `app/(dashboard)/dashboard/filing-preparation/local-income-tax/*`, `lib/filing-support/summary.ts`, `lib/filing-preparation/summary.ts`. 검증: 영향 테스트 28건, 전체 테스트 208파일 1387건, tsc, eslint(기존 경고만), next build 통과. 신규 DB/마이그레이션 없음.

### JC-028 · 사업장현황신고 지원 (면세 개인사업자) — (우선순위 중 · 저위험)

- Related Concept: [Product Baseline — Target Tax Coverage](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- Related UI Docs: [Screen Flow 4k](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design 4.13](../02_UI_Screens/01_UI_DESIGN.md) — 사업장현황신고 화면 흐름·컴포넌트(UI-First Gate 승인 및 구현 완료 2026-07-05).
- Related Technical Docs: [Business Status Report Pre-Code Brief](../03_Technical_Specs/23_BUSINESS_STATUS_REPORT_PRE_CODE_BRIEF.md) — 대상 분기·기장 집계·허브 트랙 live 전환 계약.
- Related Domain: 기장검토(JC-010)·자료수집(JC-009) 데이터. 부가세 비대상 면세사업자용.
- Related Completion Contract: [Open Backlog Completion Contracts §3 / JC-028](../03_Technical_Specs/22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md) — 면세 개인사업자 범위·VAT 분기·done 조건
- Related HTML Preview: [11_business_status_report.html](../02_UI_Screens/previews/11_business_status_report.html) — 면세 개인사업자 사업장현황신고 준비 전용 화면.
- Prototype Review / 승인: 2026-07-05 사용자 승인. 과세사업자·법인은 해당 없음으로 분기하고, 자료수집·기장검토에서 수입금액/매입·경비 자료를 읽는 read-only 화면으로 설계.
- Implementation Preconditions:
  - [x] 대상 확정 — 면세 개인사업자 한정, 과세사업자·법인은 해당 없음 처리
  - [x] 1차 자료 구성 확정 — 수입금액, 매입/경비 자료, 누락/미확정 거래, 사업자 유형 분기
  - [x] UI-First Gate Preview 작성 — [11_business_status_report.html](../02_UI_Screens/previews/11_business_status_report.html)
  - [x] Pre-Code Brief 작성 — [23_BUSINESS_STATUS_REPORT_PRE_CODE_BRIEF.md](../03_Technical_Specs/23_BUSINESS_STATUS_REPORT_PRE_CODE_BRIEF.md)
- Acceptance Criteria:
  - [x] 면세 개인사업자가 사업장현황신고 자료를 준비·검토·제출 보조 받는다
  - [x] 제출은 사용자 직접 수행이며, 자동제출은 JC-023 게이트 전 미도입
- Document Sync Check: 2026-07-05 UI-First Gate 승인 + Pre-Code Brief 작성 + read-only 집계 화면 구현 완료. `lib/business-status-report` read model, `/dashboard/filing-preparation/business-status-report` 화면, 신고 준비 허브 `business_status` 트랙 live 전환, 순수 함수/허브 테스트 반영. 신규 DB·세액 계산 엔진·전자신고 파일·자동제출 없음.

### JC-029 · 신고 준비 현황 허브 — 신고 데이터 준비 파이프라인 가시화 (우선순위 높음 · JC-024 선행)

- Related Concept: [Product Baseline — Target Tax Coverage](../01_Concept_Design/01_PRODUCT_BASELINE.md) — 개인/법인이 해야 하는 세무 전체 범위. [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md) — 세무 일정에서 신고 준비로 재프레임한 Layer 01 방향.
- Related UI Docs: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design](../02_UI_Screens/01_UI_DESIGN.md) — "신고 준비" 화면 흐름·컴포넌트·상태.
- Related HTML Preview: [08_filing_preparation.html](../02_UI_Screens/previews/08_filing_preparation.html) — HTML UI Preview Gate 대상(신고 준비 파이프라인 화면).
- Related Domain: 자료수집(JC-009)·기장검토(JC-010) 공통 기반, 부가세(JC-011)·급여/원천세(JC-012)·신고지원(JC-013)·리마인드 기한(JC-016) read model 집계. 로드맵 세목 JC-024~028이 이 허브에 연결됨.
- Prototype Review / 승인: 화면 승인 완료(2026-07-04) — [08_filing_preparation.html](../02_UI_Screens/previews/08_filing_preparation.html) 브라우저 검토 후 승인. Pre-Code Brief 작성 완료.
- Implementation Preconditions:
  - [x] Layer 01 방향 문서 작성 — [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md)
  - [x] 화면 정보구조 재확정 — 세무 일정(달력) 중심이 아니라 신고 데이터 준비 파이프라인 중심
  - [x] HTML UI Preview 작성 — [08_filing_preparation.html](../02_UI_Screens/previews/08_filing_preparation.html)
  - [x] HTML UI Preview 사용자 승인 (UI-First Gate) — 2026-07-04 브라우저 검토 후 승인
  - [x] 사업자 유형(개인/법인/면세)별 노출 규칙 확정 — 해당 없는 세목 트랙은 흐림(dimmed)+"해당 없음" 배지(숨김 아님), [Brief §4](../03_Technical_Specs/15_FILING_PREPARATION_PRE_CODE_BRIEF.md)
  - [x] Pre-Code Brief 작성 — [Filing Preparation Hub Pre-Code Brief](../03_Technical_Specs/15_FILING_PREPARATION_PRE_CODE_BRIEF.md)
- Acceptance Criteria:
  - [x] 사이드바 "신고 준비" 진입 시 신고 데이터 준비율, 확인 필요 blocker, 다음 액션이 표시된다
  - [x] 공통 기반(자료수집 -> 기장검토)과 병렬 트랙(원천세·부가세·지급명세서/연말정산·지방소득세)이 한 화면에 표시된다
  - [x] 각 트랙이 입력·산출·handoff 기준으로 읽힌다
  - [x] 세무 일정은 하단 보조 섹션으로 표시되고, 화면의 중심은 일정표가 아니다
  - [x] 사업자 유형(개인/법인/면세)별 해당 없는 세목 트랙이 흐림(dimmed)+"해당 없음"으로 표시된다(메커니즘 구현·테스트 완료; 전용 유형 필드 연결 완료·JC-032)
  - [x] 최종 제출·납부는 사용자가 직접 수행한다는 책임 경계가 명시된다
  - [x] 신규 산출 엔진·신규 DB·자동제출은 JC-029 Preview/1차 구현 범위에 포함하지 않는다
  - [x] 화면은 read-only이며 mutation을 수행하지 않는다
  - [x] 로딩·빈·오류·권한 없음 상태가 구현된다
- Document Sync Check: 2026-07-04 재프레임 + UI-First Gate 승인 + Pre-Code Brief 작성. PR #50의 "세무 일정 허브" Preview는 "신고 준비 현황 허브"로 supersede. Context Lock 전제 6/6 충족(브라우저 검토 승인·흐림 노출 규칙·Brief 15). 구현 완료(2026-07-04): lib/filing-preparation/summary.ts(집계 read model + isTrackApplicable·준비율 순수함수), /dashboard/filing-preparation(page·hub·loading·error), 사이드바 항목+layout badge. 테스트 11건·전체 1345건 통과, tsc/eslint/build 클린. 사업자 유형은 JC-032로 `client.taxEntityType`에 직접 연결 완료(billing-profile 휴리스틱·classifyBusinessType 제거, 미지정 null=흐림 없음). 저위험.

### JC-030 · 전자신고 검증 및 파일 생성 — Validation / Path 1 / Path 3

- Related Concept: [Product Baseline — Strategic Direction](../01_Concept_Design/01_PRODUCT_BASELINE.md) — self-filing 편의 경로 중 **홈택스 업로드용 양식·파일 작성 지원** 단계. [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md) — 확정 데이터 준비→handoff 경계. [Path 1 Form Fill Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md) — **세목 확대 최우선**.
- Related Domain: 신고지원(JC-013) 확정 산출물 · 부가세(JC-011)·급여/원천세(JC-012) read model. JC-034(Path 2 ZIP)는 Path 1 세목 확대 후순위. 자동제출 후속은 [JC-023](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md).
- Related Technical Docs: [E-Filing File Generation Scope Gate](../03_Technical_Specs/19_EFILING_FILE_GENERATION_SCOPE_GATE.md) — JC-030 v1 대상·Gate. [PII Policy](../03_Technical_Specs/27_JC030_EFILING_FILE_PII_POLICY.md). [Layout Acquisition](../03_Technical_Specs/28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md). [Field Mapping](../03_Technical_Specs/29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md). [Pre-Code Brief](../03_Technical_Specs/30_JC030_EFILING_FILE_PRE_CODE_BRIEF.md). [Path 1 E2E Readiness Audit](../03_Technical_Specs/40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md). [NTS Crypto Spec](../03_Technical_Specs/31_JC030_NTS_CRYPTO_SPEC_ACQUISITION.md) — Slice 2b 별도 트랙.
- Related Completion Contract: [Open Backlog Completion Contracts §3 / JC-030](../03_Technical_Specs/22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md) — 전자신고 파일 생성·검증의 착수 게이트와 done 조건
- Related Research: [JC-023 Hometax Auto-submit Research §2.1·§2.5](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md) — 세목별 전자신고 파일 규격·파일변환신고 관문·적합성 검정. JC-030은 이 리서치의 "파일 생성·파일변환신고까지"의 실현가능 구간을 독립 기능으로 승격한 것.
- Related UI Docs: [UI Design §4.11](../02_UI_Screens/01_UI_DESIGN.md) — 지급명세서 화면에 JC-030 파일 생성 패널 확장
- Related HTML Preview: [09_payment_year_end.html](../02_UI_Screens/previews/09_payment_year_end.html) — JC-030 파일 생성 패널(UI-First Gate 승인 2026-07-07)
- Related QA Docs: N/A - 착수 시 파일 규격 적합성·정합성 검증 시나리오 신설.
- Prototype Review / 승인: [x] — `09_payment_year_end.html` JC-030 패널 사용자 승인(2026-07-07)
- Implementation Preconditions (조사·설계 과제):
  - [x] 대상 세목 우선순위 확정 — [Scope Gate §4](../03_Technical_Specs/19_EFILING_FILE_GENERATION_SCOPE_GATE.md): v1은 **근로소득 간이지급명세서**. PII·레이아웃 입수 경로 확정 후에도 필드 매핑·Pre-Code Brief 선행.
  - [x] 간이지급(근로) 전자신고 레이아웃 **공식 입수 경로** 확정 — [Layout Acquisition §3](../03_Technical_Specs/28_JC030_SIMPLIFIED_WAGE_EFILING_LAYOUT_ACQUISITION.md)(2026-07-06). NTS 참조 HWP 입수(2019·2021, `scratch/jc-030-reference/`). 제출 직전 홈택스 최신본 재대조.
  - [x] 직원 식별정보 처리 정책 확정 — **서버 미저장 일회성 입력** ([PII Policy](../03_Technical_Specs/27_JC030_EFILING_FILE_PII_POLICY.md), 2026-07-06). `employee_profile` 주민번호 컬럼 추가 없음.
  - [x] 확정 데이터(JC-024 산출물) → 전자신고 파일 필드 매핑 정의 — [Field Mapping](../03_Technical_Specs/29_JC030_SIMPLIFIED_WAGE_EFILING_FIELD_MAPPING.md)(2026-07-07)
  - [x] 파일 형식·정합성 검증 규칙 정의 — Mapping §7 · [Pre-Code Brief §6](../03_Technical_Specs/30_JC030_EFILING_FILE_PRE_CODE_BRIEF.md)(2026-07-07)
  - [ ] 파일변환신고 적합성 검정 요건 확인 — [Conformance Certification Research](../03_Technical_Specs/32_JC030_SW_CONFORMANCE_CERTIFICATION_RESEARCH.md)(2026-07-07 착수, 국세청 공식 문의 대기)
  - [x] **UI-First Gate**: [09_payment_year_end.html](../02_UI_Screens/previews/09_payment_year_end.html) JC-030 파일 생성 패널 — 사용자 승인(2026-07-07)
  - [x] Validation + Path 1 plain·검증·안내 구현 (간이지급)
  - [x] Path 1 다운로드 전 **양식 채움 확인** 구현 — 신고 양식·귀속기간·사업자·대상자·합계·일회성 식별정보 입력 상태 확인
  - [x] 원천세 layout acquisition Slice 0a·0b — [37](../03_Technical_Specs/37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md)
  - [x] Field Mapping Part A · Pre-Code Brief 초안 — [38](../03_Technical_Specs/38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md) · [39](../03_Technical_Specs/39_JC030_WITHHOLDING_EFILING_PRE_CODE_BRIEF.md)
  - [x] 원천세 Slice 1a — filing-support JC-030 검증 패널 (`lib/efiling-withholding`)
  - [ ] 원천세 바이너리 레이아웃 입수 → Slice 1b plain 다운로드
  - [ ] 부가세 Path 1 (원천세 다음)
  - [ ] JC-034 Path 2 ZIP이 Validation 출력 소비 (Path 1 세목 확대 후)
- Acceptance Criteria:
  - [ ] 확정된 신고 데이터로 홈택스 업로드용 양식·파일을 생성하고, 다운로드 전 양식에 채워질 값을 확인한다
  - [ ] 생성 파일의 형식·정합성을 검증하고 오류/경고를 사용자에게 표시한다
  - [ ] 사용자가 파일을 내려받아 **직접** 홈택스에 업로드·제출한다(자동 제출 아님)
  - [ ] 자격증명 저장·자동 로그인·자동 제출은 하지 않는다(JC-023 원칙 유지)
  - [ ] 세무대리로 포지셔닝하지 않고 self-filing 보조 경계를 유지한다
- Document Sync Check: 2026-07-07 **JC-030 v1 완결** — Slices 1a–2a·3 on main(#126·#127). Path 1 세목 확대 최우선·**원천세 다음**. [NTS Crypto Spec](../03_Technical_Specs/31_JC030_NTS_CRYPTO_SPEC_ACQUISITION.md)(#128) — fcrypt 입수·트랙 분리. **Slice 2b** = 윈도우 microservice 별도 트랙·보류(DLL 실행 검증 선행). 2026-07-07 [SW Conformance Certification Research](../03_Technical_Specs/32_JC030_SW_CONFORMANCE_CERTIFICATION_RESEARCH.md) 착수 — 파일변환신고가 적합성 검정 통과 SW만 받을 가능성 확인, 국세청 문의 대기. 2026-07-07 [Path 1 E2E Readiness Audit](../03_Technical_Specs/40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md)로 자료수집→대조→계정확정→양식 채움 확인→홈택스 업로드 흐름을 고정했다. **홈택스 화면에 값을 옮겨 적도록 안내하는 경로는 제외**하고, Path 1은 홈택스 업로드용 양식·파일 작성 지원으로 고정한다.


### JC-034 · GIWA handoff 패키지 — Filing Path 2 (ZIP Export v1)

- Related Concept: [Product Baseline §Filing Path Priority](../01_Concept_Design/01_PRODUCT_BASELINE.md) — Path 2는 Path 1 베타 이후 자료기와 연결 후보.
- **우선순위:** Path 1 베타 테스트 **이후**. 문서만 보존, **코드 착수 보류**.
- Related Domain: JC-029 · JC-024~028 · JC-030 Validation · JARYO-GIWA.
- Related Technical Docs: [JC-034 Scope Gate](../03_Technical_Specs/34_JC034_GIWA_HANDOFF_PACKAGE_SCOPE_GATE.md) · [JC-034 Pre-Code Brief](../03_Technical_Specs/35_JC034_GIWA_HANDOFF_PACKAGE_PRE_CODE_BRIEF.md)
- Related Completion Contract: [Completion Contracts §3 / JC-034](../03_Technical_Specs/22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- Related HTML Preview: N/A — 기존 `08_filing_preparation.html` Path 2 패널은 Path 1 베타 우선 결정으로 supersede. Path 2 재개 시 신규 UI-First Gate 필요.
- Prototype Review / 승인: [ ] — Path 1 베타 이후 Path 2를 재개할 때 다시 승인.
- Implementation Preconditions:
  - [x] Filing Path 2 · v1 ZIP 범위 확정
  - [ ] **UI-First Gate**: Path 1 베타 이후 신규 Preview로 재승인
  - [x] **Pre-Code Brief**: [35_JC034_GIWA_HANDOFF_PACKAGE_PRE_CODE_BRIEF.md](../03_Technical_Specs/35_JC034_GIWA_HANDOFF_PACKAGE_PRE_CODE_BRIEF.md) — 승인(2026-07-07)
  - [ ] **Path 1 선행:** 원천세 등 세목 Path 1 안정 ([Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md))
  - [ ] JC-030 Validation 연동
- Acceptance Criteria (v1):
  - [ ] ZIP Export (manifest + tracks + README)
  - [ ] Validation blocking 시 export 차단
  - [ ] handoff 확인·감사 로그
  - [ ] v1 API 없음 · 알선 없음
- Document Sync Check: 2026-07-07 Path 2 재정의 후 2026-07-07 23:04 Path 1 베타 우선 결정으로 기존 Preview supersede. **구현은 Path 1 베타 이후**.

### JC-031 · 레거시 GIWA upload/email 서브시스템 은퇴 (에픽 · 착수 전 영향 감사 필수)

- Related Concept: [Product Baseline — JARYO-GIWA Relationship](../01_Concept_Design/01_PRODUCT_BASELINE.md) — GIWA 재사용 자산과 회사 self-use 경계
- Related Domain: `uploadSession`·`outbound_email`(각각 100여·수십 개 파일에 광범위하게 얽힘, 검색 범위·시점에 따라 변동) 스키마·도메인. sessions·`/upload/[token]` 포털·emails·request-events·mail-console·일부 대시보드(clients·calendar·emails) 전반에 얽힘.
- Related Technical Docs: [Legacy Upload/Email Retirement Audit](../03_Technical_Specs/20_LEGACY_UPLOAD_EMAIL_RETIREMENT_AUDIT.md) — route/DB/mail 영향 감사와 단계별 은퇴 계획. `upload_session` 즉시 삭제 금지, 외부 포털/메일 요청 흐름부터 격리. [Legacy Mail Side-effect Audit](../03_Technical_Specs/21_LEGACY_MAIL_SIDE_EFFECT_AUDIT.md) — Slice 2b 보충요청 초안 side effect·transaction-purpose FK 감사. [Source Batch Replacement Pre-Code Brief](../03_Technical_Specs/24_SOURCE_BATCH_REPLACEMENT_PRE_CODE_BRIEF.md) — Slice 3 source lineage 이관 모델·3a/3b/3c 순서. [Upload Session Column Retirement Pre-Code Brief](../03_Technical_Specs/26_UPLOAD_SESSION_COLUMN_RETIREMENT_PRE_CODE_BRIEF.md) — Slice 4-2 컬럼 retirement 범위·차단 조건·table rebuild gate.
- Related Completion Contract: [Open Backlog Completion Contracts §3 / JC-031](../03_Technical_Specs/22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md) — 남은 slice를 2c·3·4로 고정하고 최종 schema retirement done 조건 정의
- Related HTML Preview: N/A - 코드/데이터 은퇴 에픽. 사용자 화면 변경은 이미 JC-004 redirect 차단으로 처리됨.
- Prototype Review / 승인: N/A - 내부 정리 에픽.
- Implementation Preconditions (착수 전 영향 감사 필수):
  - [x] 라우트 영향 — [Audit §3](../03_Technical_Specs/20_LEGACY_UPLOAD_EMAIL_RETIREMENT_AUDIT.md): direct-upload은 유지, `/upload/[token]`·sessions·emails·request-events·mail-console은 은퇴 후보로 분리.
  - [x] DB 영향 — [Audit §4](../03_Technical_Specs/20_LEGACY_UPLOAD_EMAIL_RETIREMENT_AUDIT.md): `upload_session`은 현행 source lineage FK라 즉시 삭제 금지, source batch 대체 후 은퇴.
  - [x] 메일 영향 — [Audit §5](../03_Technical_Specs/20_LEGACY_UPLOAD_EMAIL_RETIREMENT_AUDIT.md): 현행 internal_reminder·work-email은 유지, `outbound_email` 기반 고객 요청메일은 은퇴 후보. Slice 2a(2026-07-05)에서 레거시 고객 요청메일 쓰기 API를 410 Gone으로 차단. Slice 2b 감사(2026-07-05)에서 `missing_request` 초안 side effect와 transaction-purpose `sent_email_id -> outbound_email.id` FK를 분리.
  - [x] 업로드 포털 영향 — `/upload/[token]` 외부 포털 v1 제외 승인(2026-07-05). Slice 1(`app/upload/[token]/layout.tsx` redirect, JC-004 패턴) + Slice 1b(2026-07-05) 완료: `page.tsx`는 포털 렌더링 로직을 제거하고 최소 redirect leaf로 유지(`/upload/[token]` 라우트의 명시적 quarantine 보존), 도달 불가능해진 전용 컴포넌트 3개(`upload-portal.tsx`·`payroll-rule-portal-upload.tsx`·`transaction-purpose-portal.tsx`) 삭제, `lib/upload/portal-status.ts` 전체 삭제(다른 사용처 없음 확인), `lib/upload/item-declaration.ts`의 `listSessionItemDeclarations`(다른 사용처 없음, `clearUploadItemDeclaration`은 세션 매칭 API·AI 분석에서 살아있어 유지) 제거. **포털 전용 API 4개**(`/api/upload/declarations`·`/api/upload/payroll-rule`·`/api/upload/purpose-request`·`/api/upload/purpose-request/answers`)를 410 Gone으로 차단(UI가 이미 죽어 있어 기능 회귀 아님, 하위 lib 함수는 미삭제). **공유 API**(`/api/upload`, `/api/upload/submit`, `/api/upload/files/[fileId]`+retry/password — direct-upload 사용)는 미변경. Slice 1c(2026-07-05)에서 `lib/session.ts`의 `getPortalData`+로컬 포털 헬퍼 8개를 제거하고 `verifyToken`만 유지.
  - [x] 테스트 영향 — Slice 1b에서 `portal-status.test.ts` 삭제, `item-declaration.test.ts`의 `listSessionItemDeclarations` 테스트 제거(검증 로직은 직접 DB 조회로 대체). Slice 1c에서 `lib/session.test.ts`의 `getPortalData` 전용 테스트를 제거하고, 남은 `verifyToken` 회귀 테스트로 축소. Slice 2a에서 410 공통 응답/라우트 회귀 테스트 추가. Slice 2b-1에서 `needs_resubmission` outcome 보존·draft 미생성, material-attribution draft 미생성, `missing-requests` 410 회귀 테스트 추가. Slice 2b-2에서 transaction-purpose send route 410 회귀 테스트 추가. Slice 2b-3a에서 reviews approval queue formatter/dedupe 전용 테스트 제거(사용처 제거에 따른 dead-code 삭제). Slice 2b-3b에서 hidden `dashboard/emails` page 전용 mail-console UI 제거(설정의 업무메일 주소 관리 컴포넌트는 보존). Slice 2b-3c에서 calendar/client outbound_email read 제거와 tax-calendar 회귀 테스트 갱신. Slice 2b-3d에서 런타임 호출처 없는 payroll event loader 전용 테스트 2개 제거. Slice 2b-3e에서 redirect-blocked `clients/[id]/events` 상세/생성 page 전용 UI 제거. Slice 2b-4에서 stale `missing_request` draft reject side-effect 제거. Slice 2b-5에서 transaction-purpose send 전용 테스트와 Resend/outbound_email fixture 제거.
  - [x] 단계별 삭제 계획 수립 — [Audit §6](../03_Technical_Specs/20_LEGACY_UPLOAD_EMAIL_RETIREMENT_AUDIT.md): Route Quarantine → Mail Retirement → Source Batch Replacement → Schema Retirement. Slice 2b 세부 순서: missing-request side effect 제거 → transaction-purpose send quarantine → legacy mail read/UI cleanup.
  - [x] Slice 3 Pre-Code Brief 작성 — [Source Batch Replacement Pre-Code Brief](../03_Technical_Specs/24_SOURCE_BATCH_REPLACEMENT_PRE_CODE_BRIEF.md): `source_batch` 모델, `upload_file.source_batch_id` backfill, direct-upload dual-write, read switch, downstream FK migration 순서 고정.
  - [x] Slice 3a 구현 — `source_batch` 테이블·`upload_file.source_batch_id` nullable FK·backfill migration 0061·direct-upload dual-write. dev/prod DB 0061 적용 및 `foreign_key_check` 0 확인.
  - [x] Slice 3b 구현 — 신규 공유 모듈 `lib/source-batch/scope.ts`(`listActiveSourceBatchSessions`·`resolveActiveSourceBatchSessionIds`·`sessionPeriodOverlapsCompanyPeriod`)로 5개 우선순위 read model 중 4개(`source-collection`·`bookkeeping-review`(2개 함수)·`fiscal-year-ledger.ts`(read 함수만)·`fiscal-year-ledger-accepted-materials.ts`·`business-status-report`) 전환. payroll은 순수 source-lineage 조회가 없어 대상 없음. `mergeIncludedAttributionIntoLedger`(쓰기 경로)는 read/write switch 분리 원칙에 따라 제외. **기존 불일치 수정(사용자 승인)**: fiscal-year-ledger 2곳에 빠져 있던 `sourceKind='staff_direct'` 필터를 다른 3곳과 통일.
  - [x] Slice 3c-0 전략 감사 — downstream FK migration을 3c-1(company-home read switch, no migration) → 3c-2(source collection validation nullable `source_batch_id`) → 3c-3(bookkeeping additive FK) → 3c-4(payroll lineage decision) → 3c-4a(payroll extraction additive FK) → 3c-5(adaptive structuring allowlist/migration)으로 고정. SQLite/Turso FK 컬럼 `DROP COLUMN` 제약 때문에 3c는 additive migration만 수행하고, legacy FK/컬럼 제거는 Slice 4 table rebuild 전략으로 넘긴다.
  - [x] Slice 3c-1 구현 — `company-home/summary.ts`를 `source_batch` 기준 read switch로 전환(PR #103). `INTERNAL_SOURCE_BATCH_READ_KINDS = ['staff_direct', 'sample_data']`로 first-run 샘플 회귀 방지. migration 없음.
  - [x] Slice 3c-2 구현 — `request_item_validation`·`upload_item_declaration`에 nullable `source_batch_id` 추가(migration 0062), `source_batch.legacy_upload_session_id` 기준 backfill, 신규 validation/default criteria/session-eval/first-run sample dual-write. dev/prod DB 0062 적용 및 `foreign_key_check` 0 확인.
  - [x] Slice 3c-3 구현 — 기장 source output(`bookkeeping_material_attribution`, `bookkeeping_ledger_material_link`, `bookkeeping_classification_run`, `bookkeeping_transaction_classification`, `bookkeeping_journal_entry_run/row/voucher`)에 nullable `source_batch_id` 추가(migration 0063), deterministic dual-write. dev/prod DB 0063 적용 및 `foreign_key_check` 0 확인. `upload_session_id`는 Slice 4 전까지 유지.
  - [x] Slice 3c-4 감사/결정 — 급여 lineage 범위를 고정. `payroll_extraction_batch`·`payroll_extraction_row`·`payroll_rule_profile_application`·`payroll_excel_draft`는 다음 구현 slice(3c-4a)에서 nullable 범용 `source_batch_id -> source_batch.id` 추가 대상. 기존 `payroll_employee_line.source_batch_id`는 `payroll_extraction_batch.id`를 가리키는 급여 전용 FK라 범용 lineage로 재사용하지 않는다.
  - [x] Slice 3c-4a 구현 — `payroll_rule_profile_application`·`payroll_extraction_batch`·`payroll_extraction_row`·`payroll_excel_draft`에 nullable 범용 `source_batch_id` 추가(migration 0064), `source_batch.legacy_upload_session_id` 기준 backfill, 급여 추출/규칙 적용/엑셀 초안/first-run sample dual-write. `payroll_employee_line.source_batch_id`는 미변경. dev/prod DB 0064는 **머지 전** 적용·검증 완료(PR #107, main `e3df193`).
  - [x] Slice 3c-5 감사/결정 — `adaptive_structure_model.source_upload_session_id`·`adaptive_structure_model_run.upload_session_id`는 모델 provenance/적용 audit 성격으로 범용 source lineage FK 이관 대상이 아님. **Slice 4 allowlist**로 분류, additive migration 없음.
  - [x] Slice 4-0 allowlist 감사 — [Allowlist](../03_Technical_Specs/25_SLICE4_SCHEMA_RETIREMENT_ALLOWLIST.md).
  - [x] Slice 4-1 구현 — `createSessionAndSend`·`missing-request`·`period-gap-missing-request`·`missing-request-targets` 모듈과 `lib/validations/session.ts` 삭제. `session-service.ts`는 `createDirectUploadSession`만 유지. DB migration 없음.
  - [x] Slice 4-2-0 준비 — [Brief 26](../03_Technical_Specs/26_UPLOAD_SESSION_COLUMN_RETIREMENT_PRE_CODE_BRIEF.md): 컬럼별 retirement 분류·table rebuild gate.
  - [x] Slice 4-2a 구현 — `sessions/new`·`SessionCreateForm`·`extract-criteria` API·`direct-send` 삭제. redirect-blocked schedule/template form에서 extract-criteria UI 제거. `request_email_*` live path는 Brief §2.3에 문서화, 4-2b로 이관 검토.
  - [x] Slice 4-2b 감사/결정 — [Brief 26 §2.4](../03_Technical_Specs/26_UPLOAD_SESSION_COLUMN_RETIREMENT_PRE_CODE_BRIEF.md): 필드별 `rg` live path, compatibility retain vs 4-2c DROP 후보 확정. docs-only, 스키마/코드 변경 없음.
  - [x] Slice 4-2c micro — `request_email_cc` table rebuild(migration 0065). dev(`semuagent-dev`)·prod(`semuagent`) 적용·검증 완료(2026-07-06): 26 cols, 2 rows, `foreign_key_check` 0.
  - [x] **의도적 보류(2026-07-06)** — 에픽 미완료·backlog `todo` 유지. Slice 4-2c micro를 안전한 소강점으로 확정. 재개 경로: optional 4-2b-impl 또는 Slice 4-3+ ([Completion Contract §3 Paused](../03_Technical_Specs/22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)).
- Acceptance Criteria:
  - [x] 레거시 서브시스템이 단계적으로 제거되며 각 단계에서 tsc/lint/test가 통과한다 (Slice 1c: 207파일 1375건 통과, tsc/eslint/build 클린; Slice 2a: 레거시 요청메일 쓰기 API 12개 410 차단, 회귀 테스트 추가; Slice 2b-1: missing_request runtime side effect 제거, 회귀 테스트 추가; Slice 2b-2: transaction-purpose send 410 차단, 회귀 테스트 추가; Slice 2b-3a: hidden reviews 보충요청 메일 read panel 제거; Slice 2b-3b: hidden emails mail-console read surface 제거; Slice 2b-3c: calendar/client outbound_email read 제거; Slice 2b-3d: dead payroll event loader outbound_email read 제거; Slice 2b-3e: redirect-blocked client event detail/new outbound_email read/UI 제거; Slice 2b-4: stale missing_request draft cleanup side-effect 제거; Slice 2b-5: transaction-purpose send dead-code 제거; Slice 2c: `sent_email_id` FK 제거, purpose draft API 410, dead service/UI 삭제, classification answer/apply 유지; Slice 3b: read model 4개 전환, 206파일 1362건 통과)
  - [x] v1 현행 기능(자료수집·기장·부가세·급여·신고지원·직원명부·리마인드·신고준비)에 영향이 없다 (verifyToken·upload 관련 타깃 15건 + 전체 회귀 통과, 공유 API 미변경; Slice 2a에서 direct-upload·work-email·internal reminder 미변경; Slice 3b에서 direct-upload/source-collection 31건 재확인)
  - [ ] `clients`(사업장)·`billing`·jaryo-admin 등 유지 대상은 보존된다 (Slice 3~4에서 최종 확인)
- Document Sync Check: JC-031 **paused at 4-2c micro**(2026-07-06). 에픽 `todo` 유지, 완료 아님. 제품 backlog 우선 가능.

### JC-032 · 사업자 유형 전용 필드 — 신고 준비 dimming 실데이터 연결 (우선순위 높음 · 저위험)

- Related Concept: [Product Baseline — Target Tax Coverage](../01_Concept_Design/01_PRODUCT_BASELINE.md) — 개인/법인/면세별 세목 커버리지
- Related UI Docs: [08_filing_preparation.html](../02_UI_Screens/previews/08_filing_preparation.html) — 사업자 유형별 흐림 규칙 · 회사 설정 화면(기존)
- Related Technical Docs: [Filing Preparation Hub Pre-Code Brief §4](../03_Technical_Specs/15_FILING_PREPARATION_PRE_CODE_BRIEF.md) — 사업자 유형↔세목 흐림 매핑
- Related QA Docs: N/A - dimming 순수 함수(isTrackApplicable·buildTracks)는 filing-preparation 단위 테스트에서 검증
- Prototype Review / 승인: JC-029 화면 승인(2026-07-04) 재사용. 설정 화면에 select 1개 추가(별도 UI 승인 불요).
- Implementation Preconditions:
  - [x] 저장 위치 결정 — `client`(사업장) 테이블 (테넌트당 사업장 1개, 신고 준비 허브가 client 기준)
  - [x] 설정 위치 결정 — 회사 설정 화면(`/dashboard/settings` 회사 정보 카드)
  - [x] enum 확정 — individual/corporation/tax_exempt, nullable(미지정→흐림 없음)
- Acceptance Criteria:
  - [x] `client.tax_entity_type` 컬럼 추가 + migration 0059
  - [x] 회사 설정 화면에서 사업자 유형을 선택·저장한다(TENANT_ADMIN, 빈 값→null)
  - [x] 신고 준비 read model이 `client.taxEntityType`를 직접 사용하고 billing-profile 휴리스틱을 제거한다
  - [x] 미지정(null)이면 어떤 트랙도 흐림 처리하지 않는다
  - [x] 면세로 지정하면 부가세 트랙이 흐림+"해당 없음"으로 링크 없이 표시된다(기존 dimming 로직 재사용)
- Component & Library Plan:
  - shadcn/ui components: 기존 Select 재사용(회사 설정 카드). 신규 없음
  - New libraries: 없음
  - shadcn preset action: N/A
- Document Sync Check: 구현 완료(2026-07-04). 구현 파일: `lib/db/schema.ts`(client.taxEntityType), `drizzle/0059_add_client_tax_entity_type.sql`, `lib/validations/business-entity.ts`, `app/api/settings/business-entity/route.ts`, `app/(dashboard)/dashboard/settings/page.tsx`·`_components/settings-panel.tsx`, `lib/filing-preparation/summary.ts`(taxEntityType 직접 사용, classifyBusinessType 제거). 배포 시 migration 0059는 db:push로 적용(journal 미추적 규약).

> 현재 기존 여섯 워크스페이스는 **UI-First Gate 통과 및 구현 완료**. JC-005는 데이터 모델 델타를 확정했다(`done`) — client→business_entity 재정의(물리명 `client` 유지·rename 지연), 기간 표현 도메인별 canonical, 신규 도메인 migration 0053~0057. JC-011에서 부가세 물리 Drizzle migration과 read model/UI 구현이 완료됐다. JC-006은 회사 홈 구현·머지 완료. JC-009는 자료수집 read model·UI 구현·머지 완료(PR #4·#5, Preview 정합 포함). JC-010은 기장검토 read model·UI 구현과 QA Result 반영 완료. JC-012는 급여 read model·UI·고지액 수동 입력/match·문서 생성·마감 guard 구현을 완료했다. JC-013은 신고지원 read model·UI·접수증 보관·체크리스트 구현과 QA Result 반영을 완료했다. JC-015는 UI Preview·화면 승인(2026-07-02)에 이어 read model·`/dashboard/employees`·추가/수정 API·`0056` migration 구현을 완료했다(급여 line은 읽기 전용 매칭, 개인정보 최소 저장). JC-016~018은 내부 리마인드 화면·cron 자동 발송·급여 도메인 직원 수신자 연동까지 완료했다. JC-024·027·029·032로 신고 준비 허브의 지급명세서/연말정산·지방소득세·사업자 유형 dimming도 live 상태다. JC-004는 노출 표면 정리(설정 GIWA CC 탭·사무소 문구 제거), dead GIWA 컴포넌트 삭제, 레거시 GIWA 라우트 10종 redirect 차단, 링크 정리, clients 용어 사업장화, 설정 업무메일 탭 정리, 사업장 상세 GIWA 탭 제거를 완료(`done`, PR #21~#25). `clients`(사업장 등록·관리)·`billing`(요금제)은 v1 필수 기능으로 유지하고, jaryo-admin은 operator allowlist로 격리된 플랫폼 콘솔이라 조치 불필요로 감사 종료했다. JC-014 실제 업로드→Blob 저장→AI 파싱→정규화 E2E 검증을 완료했다(`done`, 2026-07-03) — Gemini·Claude high confidence 합의로 파이프라인 정상 동작 확인. 유일한 인프라 후속은 OPENAI_API_KEY 429(quota) 결제 충전으로 3-provider 합의를 완전 복구하는 것(현재 2/3 graceful 동작). 2026-07-03 프로덕션 first-run E2E에서 발견된 신규 사용자 경험 후속 JC-019~022도 모두 구현 완료됐다.

## Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 MVP 범위
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) · [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 화면 흐름·컴포넌트(Context Lock 참조 대상)
- **UI_Screens**: [HTML Preview 폴더](../02_UI_Screens/previews/) - 승인된 화면 프로토타입(6개 워크스페이스 + 직원 명부 + 리마인드)
- **Technical_Specs**: [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md) · [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md) · [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md) · [Employee Directory Pre-Code Brief](../03_Technical_Specs/10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) · [Internal Reminder Mail Pre-Code Brief](../03_Technical_Specs/11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) - 스택 및 컴포넌트/급여·신고지원·직원 명부·내부 리마인드 구현 계약
- **QA_Validation**: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md) · [Payroll Test Scenarios](../05_QA_Validation/06_PAYROLL_TEST_SCENARIOS.md) · [Filing Support Test Scenarios](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md) · [Employee Directory Test Scenarios](../05_QA_Validation/08_EMPLOYEE_DIRECTORY_TEST_SCENARIOS.md) · [Internal Reminder Mail Test Scenarios](../05_QA_Validation/09_INTERNAL_REMINDER_MAIL_TEST_SCENARIOS.md) - 검증 기준(Acceptance 연계)
