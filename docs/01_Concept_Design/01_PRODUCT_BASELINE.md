# SemuAgent Product Baseline
> Created: 2026-07-01 17:55
> Last Updated: 2026-07-18 19:34 KST

## Purpose

SemuAgent helps a small company use AI-assisted workflows to prepare tax filing
materials, then complete filing through **Path 1 first**:

`source collection -> classification/bookkeeping -> VAT calculation -> payroll -> review/approval -> filing-material package -> Path 1`

SemuAgent is not automatic tax filing and is not a tax-representative marketplace.
Final **Hometax/Wetax** submission and payment remain outside SemuAgent unless a
separately approved JC-023 flow exists.

### 제품 목적 (확정 정의 · 2026-07-14 프로젝트 오너 승인)

사업자가 **통장·카드·세금계산서·현금영수증·급여 자료**를 올리면, 이를 **대조·정리**하여
각 세금 신고에 필요한 값과 수정할 항목을 보여주고, 사용자가 **홈택스·위택스에서 직접
신고**할 수 있도록 돕는다. 핵심은 세무대리나 자동 신고가 아니라 다음 다섯 가지다:

1. 자료 **누락·중복·불일치** 확인
2. **공제 가능성 등 절세 항목 발견**
3. 신고에 사용할 **확정값 정리**
4. 홈택스에서 **그대로 둘 것과 수정할 것** 안내
5. 공식 양식이 있으면 **양식 작성 지원(1a)**, 없으면 **직접 입력할 값 제공(1b)**

즉, 흩어진 사업 자료를 신고 가능한 상태로 정리하는 **자가신고 보조 에이전트**다.
**최종 확인과 제출은 사용자가 직접** 한다. 홈택스(국세)와 위택스(지방세)는 동급 신고
대상으로 다룬다.

### 대화형 작업공간 방향

향후 첫 화면은 사용자가 대화로 자료를 올리고 작업을 요청하며 결과를 설명받는 **대화 중심
작업공간**으로 발전시킨다. 다만 채팅은 의도 접수·설명·라우팅 계층이고, 실제 원본 대조와
수정·확정은 구조화된 기존 워크스페이스에서 수행한다.

제품 원칙은 **대화로 시키고 이해하며, 표에서 검토하고 확정한다**이다. 현재 runtime 회사 홈은
변경하지 않으며, [Conversational Tax Workspace Direction](./04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md)의
질의응답과 HTML UI Preview 오너 승인 후에만 구현을 시작한다.
세비서의 업무 식별·상태 전이·차단 요인·Ready·확인·복구 계약은
[Sebiseo Operating Model](./05_SEBISEO_OPERATING_MODEL.md)을 따른다.

## Filing Path Priority (신고 완료 경로 우선순위)

공통 **데이터 준비**(자료수집·기장·부가세·급여·신고 준비) 이후, 베타에서는 **Path 1만** 제공한다.
Path 1은 세목마다 **1a(양식 업로드)** 를 우선하고, 홈택스가 직접 수용하는 공식 비암호화
양식이 없으면 **1b(직접입력 정리)** 로 내려가 계속 제공한다. **양식이 없다는 이유로 세목을
`blocked`로 두지 않는다.** Path 2는 Path 1 베타 테스트 이후 검토한다. Path 3 인증·암호화
파일은 현재 제품 범위에서 제외한다.

| Path | 이름 | SemuAgent 역할 | 제출 주체 | 백로그 | 시점 |
|---|---|---|---|---|---|
| **1a** | 공식 비암호화 양식 파일 + 홈택스 업로드 안내 | 홈택스가 직접 수용하는 공식 양식에 값 입력·검증 + 홈택스 업로드 단계 안내 | 사업자 | JC-013, JC-030 Path 1 | **현재·베타 범위 (양식 있는 세목)** |
| **1b** | 직접입력용 값 정리 | 확정 데이터를 `항목 = 값`으로 화면에 정리해, 사용자가 홈택스 신고 화면에 직접 입력 | 사업자 | JC-013, JC-030 Path 1 | **현재·베타 범위 (양식 없는 세목)** |
| **2** | 세무회계사무소 연결 (자료기와) | JARYO 사업자 화면으로 구조화 자료·원본 직접 전달, ZIP은 fallback | 수임 사무소 (검정 SW) | JC-044, JC-034 fallback | **Path 1 베타 이후** |
| **3** | 인증·암호화 파일 업로드 | fcrypt·적합성 검정 기반 암호화 파일 | 사업자 | 과거 조사만 보존 | **현재 제품 범위 밖** |

### Path 1 — 양식 업로드(1a) 우선, 없으면 직접입력 정리(1b)

세목마다 다음 순서로 신고 완료를 돕는다. 두 방식 모두 사용자가 홈택스에서 **직접**
업로드·입력·제출하며, SemuAgent는 확정 데이터 준비까지 담당한다.

> **구현 현황(2026-07-13):** 근로소득 간이지급명세서와 원천세는 **Path 1b 직접입력
> 정리 화면 구현 완료**다. 간이지급명세서의 과거 고정길이 비암호화 후보 생성기는
> 공식 직접 수용을 확인하지 못해 활성 사용자 경로에서 제거했다. 부가세 등 나머지
> 1b 세목은 구현 대기다.
> 세목별 실제 진행 상태는 [Backlog JC-030](../04_Logic_Progress/00_BACKLOG.md)를 따른다.

- **1a 양식 업로드**: 홈택스·국세청이 제공하고 홈택스가 직접 수용하는 **공식 비암호화
  업로드 양식**이 있으면, SemuAgent가 확정 데이터로 파일을 만들어 주고 사용자가
  홈택스에서 직접 업로드·제출한다.
- **1b 직접입력 정리**: 공식 업로드 양식이 없거나 암호화·인증만 요구되면, SemuAgent가
  확정 데이터를 **`항목 = 값`으로 화면에 정리**해 사용자가 홈택스 신고 화면에 직접
  입력하게 한다. 사용자가 그대로 옮길 수 있도록 **신고 메뉴 경로·화면명·행/칸 위치·값**을
  함께 표시한다. 화면 캡처를 따라가는 클릭별 튜토리얼과 자동 입력은 범위 밖이다.
- **`blocked` 없음**: 공식 양식이 없다는 이유로 세목을 막지 않는다. 1a가 안 되면 1b로
  내려가 최소한 직접입력 정리는 제공한다. 암호화·인증 파일 제출은 Path 3(현재 범위 밖)이며
  1b로 대체하지 않는다.
- JC-013: 단계별 준비값 확인·접수증 보관
- JC-030 Path 1: 세목별 1a 파일 생성 또는 1b 값 정리·사전검증·업로드/입력 안내
- Path 1은 **고급 옵션이 아니다**. 수임 사무소가 없거나 직접 신고를 선택하는 정식 경로다.

### Path 2 — 세무회계사무소 연결 (JARYO-GIWA / 자료기와)

사업자가 SemuAgent에서 자료를 정리·검토하고 연결된 세무·회계 사무소로 전송하면,
구조화 자료와 원본이 **자료기와(JARYO-GIWA)의 해당 사업자 화면에 직접 등록**된다.
최초 상태는 **SemuAgent 수신 · 검토 대기**이며, 담당자가 원본과 정리자료를 대조해 수신
승인한 뒤 사무소 업무자료로 승격한다. 이후 검정 SW로 홈택스에 대리 제출한다.

- JC-044: 직접 A2A 전달·JARYO 검토 대기 등록의 주 경로 (질의응답·기술 계약 대기).
- JC-034: ZIP Export (manifest + Excel/CSV)은 비연동·장애 상황의 수동 fallback.
- 세무대리인 **알선·마켓플레이스·기장료 중개 없음**.
- Agent-to-Agent 연결 방향과 파트너 파일럿 질의응답은 [A2A Master Plan](./03_AGENT_TO_AGENT_TAX_COLLABORATION_MASTER_PLAN.md)에 Proposed 상태로 관리한다. 직접 연동과 fallback 모두 아직 구현 착수 전이다.

### Path 3 — 현재 제품 범위 밖

국세청 적합성 검정, NTS fcrypt, 전자신고 암호와 암호화 파일 생성은 현재
SemuAgent의 제품 경로가 아니다. 별도 제품 범위 재승인 전에는 구현하지 않는다.

### 공통 검증 레이어 (JC-030 Validation)

Path 1 파일 다운로드와 Path 2 직접 전송·ZIP fallback **모두** 전에, 확정 데이터를 공식 레이아웃
기준으로 **검증**한다 (`lib/efiling-simplified-wage` 등). 이 레이어는 Path 1과 향후 Path 2가
공유하는 품질 관문이다.

## Public SEO Positioning

- Primary title: `SemuAgent - 작은 회사를 위한 AI 세무 에이전트`
- One-line description: 작은 회사가 AI로 증빙·기장·부가세·급여를 정리하고, 먼저 홈택스 업로드용 양식 파일을 만든다.
- Core search intents: `AI 세무`, `세무신고 준비`, `홈택스 신고 보조`, `전자신고 파일`, `신고자료 정리`, `자가 기장`, `세무사무소 자료 전달`.
- Public positioning: SemuAgent is an AI-assisted tax-preparation workflow for small companies, not an accounting-firm client-management product, not a tax-agent marketplace, and not an automatic Hometax submission agent.
- Canonical URL source: public metadata, robots, and sitemap use `NEXT_PUBLIC_SITE_URL`; the local fallback is `https://semuagent.app` until the production domain is finalized.

## Primary Users

**타깃 세그먼트: 개인사업자 및 직원 10인 이하 소규모 법인.** SemuAgent는 이 규모 사업자의
**신고 준비 데이터**를 한 제품에서 정리·검토한 뒤, 베타에서는 **Path 1(홈택스 업로드용 양식·파일)**
로 이어준다. Path 2는 Path 1 베타 이후이며, 암호화 Path 3은 현재 범위 밖이다.

- CEO or owner-manager who wants direct visibility into accounting status
- Finance/accounting staff who prepare materials before the filing deadline
- Operations staff handling receipts, payroll, and tax materials
- Users who file directly via Hometax (Path 1)
- Users who may later hand prepared data to an existing external tax accountant or accounting firm (Path 2 via JARYO-GIWA, post-beta)

## Target Tax Coverage — 개인사업자 · 소규모 법인(≤10인)

타깃 사업자가 직접 해야 하는 세무 전체를 커버하는 것을 목표로 한다. **기장(장부)**은 모든
소득세 신고의 공통 토대다. 상태: ✅ 구현 · 📋 로드맵(백로그).

**개인사업자**

| 세목 | 주기 | 상태 |
|---|---|---|
| 부가가치세 | 일반: 반기 확정(1·7월)+예정고지 / 간이: 연1회(1월) | ✅ |
| 원천세 | 매월 10일(또는 반기납부 특례) | ✅ |
| 지방소득세 특별징수(원천세 부속) | 원천세와 동일 주기 | 📋 JC-027 |
| 지급명세서·간이지급명세서 | 월/반기/연 | 📋 JC-024 |
| 연말정산(직원분) | 2월 (원천징수의무자) | 📋 JC-024 |
| 종합소득세(+지방소득세) | 5월 (성실신고 6월) | 📋 JC-025 |
| 4대보험 | 매월 | ✅ |
| 사업장현황신고(면세사업자) | 2월 10일 | 📋 JC-028 |

**소규모 법인(직원 10인 이하)**

| 세목 | 주기 | 상태 |
|---|---|---|
| 부가가치세 | 분기 4회(예정+확정) | ✅ |
| 원천세 | 매월(또는 반기) | ✅ |
| 지방소득세 특별징수(원천세 부속) | 원천세와 동일 주기 | 📋 JC-027 |
| 지급명세서·간이지급명세서 | 월/반기/연 | 📋 JC-024 |
| 연말정산(직원분) | 2월 | 📋 JC-024 |
| 법인세(+지방소득세) | 사업연도 종료 후 3개월 | 📋 JC-026 |
| 4대보험 | 매월 | ✅ |

- **지방소득세**: 원천세 특별징수분은 JC-027(급여 `localIncomeTaxKrw` 실제값 집계). 종합소득세·법인세분 지방소득세는 각각 JC-025·JC-026 완료 이후 별도 연동.
- 자동 제출은 아래 Strategic Direction 및 [JC-023](../03_Technical_Specs/13_JC023_HOMETAX_AUTOSUBMIT_RESEARCH.md) 원칙(사용자 최종 승인·자격증명 원문 미저장)을 따른다.
- ※ 세무 주기·특례(반기납부·성실신고·간이/일반과세)는 상황·개정에 따라 다르며, 실제 적용은 국세청 안내/세무 전문가 확인 대상이다.

## MVP Scope

- Upload or import source documents: tax invoices, bank statements, card
  statements, receipts, payroll files, Hometax exports.
- Classify transactions and generate reviewable bookkeeping entries.
- Prepare VAT-period summaries and supporting schedules.
- Assist VAT tax treatment review with official-rule, prior-pattern, and conditional AI evidence; keep deductible/non-deductible, proration, taxable/zero-rated/exempt decisions under explicit user confirmation.
- **Detect tax-saving opportunities** (절세 항목) such as misclassified input-VAT deduction candidates, and surface them for user review. Candidates are shown broadly; canonical values change only through a strict user-confirmed gate — never auto-applied (JC-041).
- Calculate payroll from structured company payroll inputs.
- Generate filing-material output for **Path 1**: an official non-encrypted upload file where a form exists (1a), otherwise an on-screen `field = value` summary for manual Hometax entry (1b).
- Provide **Hometax/Wetax** upload/entry guidance and e-filing file validation (JC-030 Path 1), including what to leave as-is and what to correct on the filing screen.
- Store submission receipts, payment notices, and audit trail.
- Use AI-assisted automation for source classification, missing-item checks,
  reminders, and filing-preparation updates.

## MVP Non-Scope

- Automatic Hometax submission. (MVP 제외이며 영구 제외가 아님 — 사용자 승인 기반
  자동제출은 아래 Strategic Direction 및 Backlog JC-023의 로드맵 방향이다.)
- Server-side storage of Hometax, bank, card, certificate, or password
  credentials.
- Licensed tax-representative service positioning or in-app tax-agent marketplace/lead gen.
- Encrypted Hometax file generation, NTS fcrypt, or file-conversion certification tooling.
- Direct financial transactions or tax payments without a separate reviewed integration design.

## Strategic Direction (Post-MVP)

Path 1 베타 이후에 Path 2를 검토한다. 암호화 Path 3은 현재 제품 범위에서 제외한다.
자동제출(JC-023)은 Path 1/3의 **추가 로드맵**이며 MVP 밖이다.

| Path | 현재 실행 우선순위 | 다음 마일스톤 |
|---|---|---|
| 1 | **최우선** — 세목별 1a(양식 업로드) 우선, 없으면 1b(직접입력 정리) | 세목 확대: 양식 확인되면 1a, 아니면 1b 대상으로 순차 전환. 원천세 1b 값 정리 화면 구현 완료(2026-07-12), 부가세는 구현 대기 ([Path 1 Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md)) |
| 2 | **후순위** — Path 1 베타 안정 후 | JC-044 직접 A2A 계약 확정, JC-034 ZIP fallback (모두 **구현 착수 보류**) |
| 3 | **범위 밖** | 별도 제품 범위 재승인 전 구현 없음 |

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

SemuAgent and JARYO-GIWA are **separate products**. Path 2 links them via handoff:

| Side | Operator | Role |
|---|---|---|
| SemuAgent | Company (business tenant) | Prepare, review, approve, and transmit the handoff data |
| JARYO-GIWA | Accounting firm (office tenant) | Receive, review, file via certified SW |

Bridge rules (JC-044 primary / JC-034 fallback):

- **구현 우선순위:** Path 1 세목 확대(홈택스 양식 기입)가 JC-034 ZIP보다 **선행**한다.
- **주 경로(JC-044):** 연결된 사업자의 구조화 자료·원본을 versioned API로 JARYO에 직접 전달하고 검토 대기로 등록한다.
- **fallback(JC-034):** direct A2A를 사용할 수 없을 때만 manual ZIP export를 사용한다.
- No in-app tax-agent discovery, referral fees, or first-month bookkeeping promotions.
- No shared tenant DB; link only with explicit business consent (v2: invitation code).
- No Hometax passwords or certificates stored on either side.

Revenue model (product-level): GIWA subscription from firms; SemuAgent subscription from
companies. Bookkeeping fees between firm and client are **not** SemuAgent revenue.

Every reused flow must be checked for operator mismatch:

- `client` in JARYO-GIWA often means an accounting-firm customer company.
- In SemuAgent, the company is the tenant/operator.
- Email request and accountant approval flows usually become internal company
  review/approval flows.

## Related Documents
- **Concept_Design**: [Agent-to-Agent Tax Collaboration Master Plan](./03_AGENT_TO_AGENT_TAX_COLLABORATION_MASTER_PLAN.md) - SemuAgent와 JARYO-GIWA 공통 장기 방향·질의응답 정본
- **Concept_Design**: [Conversational Tax Workspace Product Direction](./04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md) - 대화 중심 첫 화면과 구조화 확정의 역할 분리
- **Concept_Design**: [Sebiseo Operating Model](./05_SEBISEO_OPERATING_MODEL.md) - 세비서의 업무 식별·상태 전이·Ready·확인·복구 운영 계약
- **Concept_Design**: [Filing Preparation Pipeline](./02_FILING_PREPARATION_PIPELINE.md) - 신고 준비 파이프라인 방향
- **UI_Screens**: [MVP UX Baseline](../02_UI_Screens/01_MVP_UX_BASELINE.md) - 6개 워크스페이스 UX 기준선
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 화면 흐름 및 데이터 입출력
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **Technical_Specs**: [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) - 런타임·스택·재사용 기반
- **Technical_Specs**: [Path 1 Form Fill Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md) - 홈택스 양식 기입·세목 확대 순서
- **Technical_Specs**: [JC-034 GIWA Handoff Scope Gate](../03_Technical_Specs/34_JC034_GIWA_HANDOFF_PACKAGE_SCOPE_GATE.md) - 직접 연동 장애·미연동 시 사용하는 수동 ZIP fallback 범위 (구현 보류)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - MVP 실행 항목 및 Context Lock
- **QA_Validation**: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md) - 품질 기준선
