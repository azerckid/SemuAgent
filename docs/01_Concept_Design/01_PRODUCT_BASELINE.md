# SemuAgent Product Baseline
> Created: 2026-07-01 17:55
> Last Updated: 2026-07-07 04:20 KST

## Purpose

SemuAgent helps a small company use AI-assisted workflows to prepare tax filing
materials, then complete filing through one of **three product paths**:

`source collection -> classification/bookkeeping -> VAT calculation -> payroll -> review/approval -> filing-material package -> (Path 1 | 2 | 3)`

SemuAgent is not automatic tax filing and is not a tax-representative marketplace.
Final Hometax submission and payment remain outside SemuAgent unless a separately
approved JC-023 flow exists.

## 3 Filing Paths (신고 3경로)

공통 **데이터 준비**(자료수집·기장·부가세·급여·신고 준비) 이후, 사용자는 아래 세 경로
중 하나(또는 병행)로 신고를 마친다. 세 경로는 **동등한 제품 방향**이며 시점만 다르다.

| Path | 이름 | SemuAgent 역할 | 제출 주체 | 백로그 | 시점 |
|---|---|---|---|---|---|
| **1** | 양식 파일 + 홈택스 업로드 안내 | 국세청 전자신고 **양식 파일 생성**(평문)·검증 + 홈택스 **작성·업로드 단계 안내** | 사업자 | JC-013, JC-030 Path 1 | **현재** |
| **2** | 세무회계사무소 연결 (자료기와) | **handoff ZIP 패키지** Export → JARYO-GIWA에서 검토 | 수임 사무소 (검정 SW) | JC-034 | **현재** (v1 ZIP) |
| **3** | 인증 후 암호화 파일 업로드 | **적합성 검정**·NTS fcrypt 등으로 홈택스 업로드 가능 **암호화 파일** 생성 | 사업자 | JC-030 Path 3 | **미래** |

### Path 1 — 양식 다운로드·작성·업로드 안내 (파일은 SemuAgent가 생성)

홈택스·국세청에 **전자신고 양식(전산매체 규격)** 이 있으므로, SemuAgent가 확정 데이터로
**파일을 만들어 준다**. 사용자는 홈택스 파일변환신고 등 메뉴에서 **직접 업로드·제출**한다.

- JC-013: 단계별 준비값 확인·접수증 보관
- JC-030 Path 1: plain 전자신고 파일 생성·사전검증·홈택스 변환제출 안내 (main에 구현됨)
- Path 1은 **고급 옵션이 아니다**. 수임 사무소가 없거나 직접 신고를 선택하는 정식 경로다.
- Path 1 평문 파일이 홈택스에서 거절될 수 있는 경우는 Path 3 완성 전까지 UI에서 명시한다.

### Path 2 — 세무회계사무소 연결 (JARYO-GIWA / 자료기와)

사업자가 SemuAgent에서 자료를 정리·검토한 뒤, **기존 수임 관계**의 세무·회계 사무소에
패키지를 넘긴다. 사무소는 **자료기와(JARYO-GIWA)** 에서 검토하고 위하고·세무사랑 등
**검정 SW**로 홈택스에 **대리 제출**한다.

- JC-034 v1: ZIP Export (manifest + Excel/CSV). API·실시간 연동 없음.
- 세무대리인 **알선·마켓플레이스·기장료 중개 없음**.

### Path 3 — 미래: 인증 후 암호화 파일 업로드

Path 1의 **완성형**. 국세청 **전자신고 파일변환 적합성 검정** 및 NTS fcrypt 등을 거쳐
홈택스에 올릴 수 있는 **암호화 전자신고 파일**을 SemuAgent가 생성한다.

- JC-030 Path 3: Slice 2b (fcrypt·윈도우 microservice 등). 인증·규격 확보 **후** 착수.
- Path 3 전까지 Path 1 사용자는 plain 파일 + 홈택스 안내로 운영한다.

### 공통 검증 레이어 (JC-030 Validation)

Path 1 파일 다운로드와 Path 2 ZIP Export **모두** 전에, 확정 데이터를 공식 레이아웃 기준으로
**검증**한다 (`lib/efiling-simplified-wage` 등). 이 레이어는 세 경로가 공유하는 품질 관문이다.

## Public SEO Positioning

- Primary title: `SemuAgent - 작은 회사를 위한 AI 세무 에이전트`
- One-line description: 작은 회사가 AI로 증빙·기장·부가세·급여를 정리하고, 홈택스 양식 파일을 만들거나 수임 세무사무소(자료기와)에 넘긴다.
- Core search intents: `AI 세무`, `세무신고 준비`, `홈택스 신고 보조`, `전자신고 파일`, `신고자료 정리`, `자가 기장`, `세무사무소 자료 전달`.
- Public positioning: SemuAgent is an AI-assisted tax-preparation workflow for small companies, not an accounting-firm client-management product, not a tax-agent marketplace, and not an automatic Hometax submission agent.
- Canonical URL source: public metadata, robots, and sitemap use `NEXT_PUBLIC_SITE_URL`; the local fallback is `https://semuagent.app` until the production domain is finalized.

## Primary Users

**타깃 세그먼트: 개인사업자 및 직원 10인 이하 소규모 법인.** SemuAgent는 이 규모 사업자의
**신고 준비 데이터**를 한 제품에서 정리·검토한 뒤, **Path 1(직접 신고)** 또는 **Path 2(수임 사무소)**
로 이어준다. Path 3은 동일 제품의 미래 확장이다.

- CEO or owner-manager who wants direct visibility into accounting status
- Finance/accounting staff who prepare materials before the filing deadline
- Operations staff handling receipts, payroll, and tax materials
- Users who file directly via Hometax (Path 1)
- Users with an existing external tax accountant or accounting firm (Path 2 via JARYO-GIWA, not in-app marketplace)

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
| 지급명세서·연말정산 | 월/2월/3월 | 📋 JC-024 |
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
- Calculate payroll from structured company payroll inputs.
- Generate filing-material packages for **Path 1** (e-filing files + Hometax guide) and **Path 2** (GIWA handoff ZIP, JC-034).
- Provide Hometax entry guidance and e-filing file validation (JC-030 Path 1).
- Store submission receipts, payment notices, and audit trail.
- Use AI-assisted automation for source classification, missing-item checks,
  reminders, and filing-preparation updates.

## MVP Non-Scope

- Automatic Hometax submission. (MVP 제외이며 영구 제외가 아님 — 사용자 승인 기반
  자동제출은 아래 Strategic Direction 및 Backlog JC-023의 로드맵 방향이다.)
- Server-side storage of Hometax, bank, card, certificate, or password
  credentials.
- Licensed tax-representative service positioning or in-app tax-agent marketplace/lead gen.
- SemuAgent obtaining NTS file-conversion certification (**Path 3 only**; not required for Path 1 plain files or Path 2 handoff).
- Direct financial transactions or tax payments without a separate reviewed integration design.

## Strategic Direction (Post-MVP)

MVP 이후에도 신고 완료는 위 **3 Filing Paths** 로 고정한다. 자동제출(JC-023)은 Path 1/3의
**추가 로드맵**이며 MVP 밖이다.

| Path | 현재 실행 우선순위 | 다음 마일스톤 |
|---|---|---|
| 1 | **최우선** — 홈택스 양식 입수·기입·신고 보조 | 세목 확대: **원천세** → 부가세 ([Path 1 Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md)) |
| 2 | **후순위** — Path 1 Validation 안정 후 | JC-034 ZIP (문서 완료, **구현 착수 보류**) |
| 3 | 보류 (인증·fcrypt) | 적합성 검정·NTS round-trip 후 Slice 2b |

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
| SemuAgent | Company (business tenant) | Prepare, review, export handoff package |
| JARYO-GIWA | Accounting firm (office tenant) | Receive, review, file via certified SW |

Bridge rules (JC-034):

- **구현 우선순위:** Path 1 세목 확대(홈택스 양식 기입)가 JC-034 ZIP보다 **선행**한다.
- v1: manual ZIP export from SemuAgent; firm imports via existing GIWA upload/review surfaces.
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
- **Concept_Design**: [Filing Preparation Pipeline](./02_FILING_PREPARATION_PIPELINE.md) - 신고 준비 파이프라인 방향
- **UI_Screens**: [MVP UX Baseline](../02_UI_Screens/01_MVP_UX_BASELINE.md) - 6개 워크스페이스 UX 기준선
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 화면 흐름 및 데이터 입출력
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **Technical_Specs**: [Development Setup](../03_Technical_Specs/01_DEVELOPMENT_SETUP.md) - 런타임·스택·재사용 기반
- **Technical_Specs**: [Path 1 Form Fill Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md) - 홈택스 양식 기입·세목 확대 순서
- **Technical_Specs**: [JC-034 GIWA Handoff Scope Gate](../03_Technical_Specs/34_JC034_GIWA_HANDOFF_PACKAGE_SCOPE_GATE.md) - 사무소 전달 패키지 v1 범위 (구현 보류)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - MVP 실행 항목 및 Context Lock
- **QA_Validation**: [MVP QA Baseline](../05_QA_Validation/01_MVP_QA_BASELINE.md) - 품질 기준선
