# SemuAgent Product Baseline
> Created: 2026-07-01 17:55
> Last Updated: 2026-07-04

## Purpose

SemuAgent helps a small company use AI-assisted workflows to prepare its own
tax filing materials:

`source collection -> classification/bookkeeping -> VAT calculation -> payroll -> review/approval -> filing-material package -> Hometax submission support -> receipt storage`

The product is designed for small-company users who want to prepare and review
their own tax filing workflow without routing every step through an accounting
or tax office. SemuAgent is not automatic tax filing; final Hometax submission
and payment remain user-confirmed actions.

## Public SEO Positioning

- Primary title: `SemuAgent - 작은 회사를 위한 AI 세무 에이전트`
- One-line description: 작은 회사가 직접 세무신고를 준비할 수 있도록 AI가 증빙, 기장, 부가세, 급여, 신고자료를 정리한다.
- Core search intents: `AI 세무`, `세무신고 준비`, `홈택스 신고 보조`, `자가 기장`, `부가세 계산`, `급여정산`, `증빙 수집`, `신고자료 생성`.
- Public positioning: SemuAgent is an AI-assisted tax-preparation workflow for small companies, not an accounting-firm client-management product and not an automatic Hometax submission agent.
- Canonical URL source: public metadata, robots, and sitemap use `NEXT_PUBLIC_SITE_URL`; the local fallback is `https://semuagent.app` until the production domain is finalized.

## Primary Users

- CEO or owner-manager who wants direct visibility into accounting status
- Finance/accounting staff
- Operations staff handling receipts, payroll, and tax materials
- Optional external tax accountant as reviewer or advisor

## MVP Scope

- Upload or import source documents: tax invoices, bank statements, card
  statements, receipts, payroll files, Hometax exports.
- Classify transactions and generate reviewable bookkeeping entries.
- Prepare VAT-period summaries and supporting schedules.
- Calculate payroll from structured company payroll inputs.
- Generate filing-material packages and Hometax entry guidance.
- Store submission receipts, payment notices, and audit trail.
- Use AI-assisted automation for source classification, missing-item checks,
  reminders, and filing-preparation updates.

## MVP Non-Scope

- Automatic Hometax submission. (MVP 제외이며 영구 제외가 아님 — 사용자 승인 기반
  자동제출은 아래 Strategic Direction 및 Backlog JC-023의 로드맵 방향이다.)
- Server-side storage of Hometax, bank, card, certificate, or password
  credentials.
- Licensed tax-representative service positioning.
- Direct financial transactions or tax payments without a separate reviewed
  integration design.

## Strategic Direction (Post-MVP)

MVP는 "홈택스 제출 보조(입력 가이드)"까지이고 자동제출은 하지 않는다. 다만
"가이드/신고지원"은 **중간 단계**이며, SemuAgent의 최종 목표는 **사용자 승인 기반
홈택스 자동제출**이다:

- 사용자가 신고 내용을 최종 확인하고 승인하면,
- SemuAgent가 **사용자 권한 범위 안에서** 홈택스 제출 절차를 자동으로 진행하고,
- **접수증까지 자동으로 회수·보관**한다.

즉 사용자 승인 기반 원클릭 홈택스 제출이 최종 제품 방향이다.

### 원칙 (자동제출 설계 시 필수)

- **사용자 최종 승인 필수** — 승인 없이는 어떤 제출도 진행하지 않는다.
- **자격증명 원문 저장 금지** — 홈택스/공동인증서/비밀번호를 서버에 원문 저장하지 않는다.
- **감사 로그 필수** — 모든 제출 시도·결과를 감사 로그로 남긴다.
- **접수증 자동 보관** — 제출 후 접수증을 자동 회수·보관한다.

### 조사 과제 (구현 전 선행)

- 홈택스 전자신고 파일 규격
- 파일변환신고 방식
- 사용자 인증 기반 제출 자동화 가능성
- 공식 API vs 비공개 연동 여부

실행 항목: Backlog **JC-023** (Strategic Direction: 사용자 승인 기반 홈택스 자동제출).

## JARYO-GIWA Relationship

JARYO-GIWA remains the accounting-firm workflow. Its code is the first reuse
source for data extraction, bookkeeping, payroll, AI analysis, auth, database,
and dashboard UI.

Every reused flow must be checked for operator mismatch:

- `client` in JARYO-GIWA often means an accounting-firm customer company.
- In SemuAgent, the company is the tenant/operator.
- Email request and accountant approval flows usually become internal company
  review/approval flows.

## Related Documents
- **UI_Screens**: [MVP UX Baseline](../02_UI_Screens/01_MVP_UX_BASELINE.md) - 6개 워크스페이스 UX 기준선
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 화면 흐름 및 데이터 입출력
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **Technical_Specs**: [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) - 런타임·스택·재사용 기반
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - MVP 실행 항목 및 Context Lock
- **QA_Validation**: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md) - 품질 기준선
