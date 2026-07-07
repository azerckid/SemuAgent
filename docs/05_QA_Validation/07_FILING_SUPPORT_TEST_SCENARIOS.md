# Test Scenarios: Filing Support
> Created: 2026-07-02 20:23
> Last Updated: 2026-07-03 20:24

신고지원(JC-013) Layer 5 QA 시나리오. [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md)의
Data Contract·Derivation·Mutation·Acceptance를 검증 케이스로 옮긴다.

핵심: **Preview UI 계약 준수**, 부가세·급여 산출물 연동, 신고 준비값 확인, 접수증 보관,
사후 체크리스트, 자동 제출/납부 비범위, tenant/사업장 범위 격리.

표기: Result 범례 - `PASS·단위` / `PASS·구현` / `Pending`(도메인별 후속 E2E).

## 1. Rubric Validation (Mandatory)

| Criterion | Status | Evidence |
|:---|:---:|:---|
| Functionality | PASS·구현 | 신고 항목 read model, 접수증 보관 기록, 체크리스트 mutation 구현 |
| Potential Impact | PASS·구현 | 회사 직접 신고 보조의 마지막 워크스페이스 |
| Novelty | PASS·구현 | 자동 제출 대신 책임 경계와 패키지·가이드·보관을 결합 |
| UX | PASS·구현 | 승인 Preview 4.6 섹션 순서와 주요 문구를 정적 테스트로 고정. 화면 구현 후 브라우저 렌더 검증 완료 |
| Open-source | PASS·구현 | VAT/payroll read model 재사용 + filing 전용 테이블 최소 추가 |
| Business Plan | PASS·구현 | 신고지원 패키지와 접수증 보관은 유료 가치의 핵심 사용 증거 |

## 2. Test Scenarios & Results

### 2.1 기본 렌더 및 구조

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-01 | 인증 tenant + 사업장 + VAT/payroll 산출물 | `/dashboard/filing-support` 진입 | 책임 경계 배너 -> 신고 항목 -> 준비값 확인/접수증 -> 체크리스트 순서 | PASS·구현 |
| S-02 | 사이드바 "신고지원" | 클릭 | `/dashboard/filing-support` 이동 | PASS·구현 |
| S-03 | 승인 Preview 기준 데이터 | 렌더 | 부가세 패키지 대기, 원천세 패키지 준비됨, 4대보험 확인 필요 흐름 재현 | PASS·단위 |
| S-04 | 하단 안내 | 렌더 | 자동 제출/납부가 아니라 패키지·준비값 확인·접수증 보관까지임을 표시 | PASS·구현 |

### 2.2 기간·사업장 컨텍스트

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-10 | `?period=2026-H1` | 진입 | 2026년 1기 부가세 + 2026년 6월 귀속 급여 기준으로 집계 | PASS·단위 |
| S-11 | query 없음 | 진입 | 최신 신고 대상 기간으로 기본 선택 | PASS·구현 |
| S-12 | 사업장 없음 | 진입 | "부가세·급여 먼저 확정" 또는 사업장 등록 안내 빈 상태 | PASS·구현 |
| S-13 | tenant A/B 데이터 | tenant A 로더 | B filing item/receipt/checklist 미노출 | PASS·단위 |
| S-14 | businessEntity A/B | A 컨텍스트 | B VAT/payroll/filing 데이터 미집계 | PASS·단위 |

### 2.3 신고 항목·패키지 상태

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-20 | VAT pendingDeductionCount=3 | 렌더 | 부가세 항목 "패키지 대기", 버튼 disabled + locknote | PASS·단위 |
| S-21 | VAT pendingDeductionCount=0, packageStatus=ready | 렌더 | 부가세 패키지 생성/열기 가능 | PASS·단위 |
| S-22 | payroll withholdingStatementStatus=generated, closeStatus=closed | 렌더 | 원천세 항목 "패키지 준비됨" | PASS·단위 |
| S-23 | payroll insuranceStatementStatus 미생성 또는 noticeImportStatus!=matched | 렌더 | 4대보험 항목 "확인 필요" | PASS·단위 |
| S-24 | 선행 산출물 없음 | 렌더 | 해당 항목은 locked/needs_review로 표시하고 선행 화면 CTA 제공 | PASS·구현 |

### 2.4 신고 준비값 확인

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-30 | payroll employeeCount=12 | 원천세 가이드 렌더 | 인원 12명 표시 | PASS·단위 |
| S-31 | payroll grossPayKrw=42,600,000 | 원천세 가이드 렌더 | 총지급액 42,600,000원 표시 | PASS·단위 |
| S-32 | payroll withholdingTaxKrw=2,100,000 | 원천세 가이드 렌더 | 소득세/지방소득세 합계 또는 세부 값 표시 | PASS·단위 |
| S-33 | "준비값 복사" | 클릭 | clipboard 복사만 수행, DB mutation 없음 | PASS·구현 |
| S-34 | 홈택스 가이드 영역 | 렌더 | "자동 제출 아님" 문구 표시 | PASS·구현 |

### 2.5 접수증 보관

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-40 | 원천세 접수증 파일 | 업로드 | `filing_receipt` 생성, private storage key 저장 | PASS·구현 |
| S-41 | 저장된 접수증 | 렌더 | 파일명/제출일/보관 완료 표시 | PASS·단위 |
| S-42 | 부가세 접수증 없음 | 렌더 | "제출 후 업로드 대기" 빈 상태 표시 | PASS·단위 |
| S-43 | 다른 tenant receiptId | 보기/삭제 | 404/403, 데이터 미노출 | PASS·구현 |
| S-44 | storageKey 존재 | 렌더 | private storage key·Blob URL 미노출 | PASS·단위 |

### 2.6 사후 체크리스트

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-50 | checklist item incomplete | 체크 | completed=true, completedBy/At 기록 | PASS·구현 |
| S-51 | checklist item complete | 체크 해제 | completed=false, completedAt null 또는 갱신 | PASS·구현 |
| S-52 | 원천세 납부 완료 | 렌더 | 완료 항목은 muted/line-through 스타일 | PASS·구현 |
| S-53 | 다른 tenant checklistId | mutation | 404/403, 데이터 변경 없음 | PASS·구현 |

### 2.7 책임 경계·비범위

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-60 | 신고지원 화면 | 정적 분석 | 홈택스 제출 API, 납부 API, credential 저장 API 없음 | PASS·구현 |
| S-61 | 화면 문구 | 렌더 | "신고서 제출을 대행하지 않습니다" 표시 | PASS·구현 |
| S-62 | 버튼/CTA | 렌더 | "제출하기", "납부하기"처럼 시스템이 수행하는 오해 문구 없음 | PASS·구현 |
| S-63 | 코드 검색 | 정적 분석 | 홈택스/EDI 자동 로그인·스크래핑·공동인증서 저장 import 없음 | PASS·구현 |

### 2.8 Preview 계약·GIWA 경계

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-70 | 신고지원 컴포넌트 | 정적 분석 | GIWA 메일/요청/외부 고객 포털 컴포넌트 미import | PASS·구현 |
| S-71 | 화면 순서 | 정적 분석 | Preview 4.6의 4개 주요 섹션 순서 유지 | PASS·구현 |
| S-72 | disabled CTA | 렌더 | 잠금 버튼은 `disabled` + `aria-disabled=true` + visible locknote | PASS·구현 |
| S-73 | 사이드바 | 렌더 | 신고지원 route 활성 상태와 count 배지 표시 | PASS·구현 |

### 2.9 상태(State) 커버리지

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-80 | 페치 지연 | 진입 | 스켈레톤 loading | PASS·구현 |
| S-81 | 신고 항목 0건 | 진입 | "아직 신고할 항목이 없습니다 / 부가세·급여 먼저 확정" | PASS·구현 |
| S-82 | 로드 실패 | 진입 | "신고 항목을 불러오지 못했습니다" + 다시 시도 | PASS·구현 |
| S-83 | 미인증 | 접근 | `/sign-in` redirect | PASS·구현 |
| S-84 | tenant 없음 | 진입 | tenant-scoped 접근 차단 | PASS·구현 |

## 3. 자동화 계획

- **단위 테스트 완료** (`lib/filing-support/summary.test.ts`): S-03, S-10, S-13~14, S-20~23, S-30~32, S-41~44, S-50~52.
- **정적 검증 완료** (`filing-support-workspace.test.ts`): Preview 구조(S-01, S-70~73), route(S-02), 책임 경계 문구(S-61~62), 자동 제출/납부 미제공(S-60, S-63), mutation guard 배선(S-40~43, S-50~53).
- **API 구현 완료**: receipt metadata upload/delete, checklist toggle, tenant/staff guard(S-40~43, S-50~53). 실제 Blob 저장 환경은 JC-014에서 검증 완료.
- **브라우저 수동 검증 완료**: `/dashboard/filing-support?period=2026-H1` 로그인 렌더와 승인 Preview 구조를 확인.
- **후속 E2E**: JC-014에서 실제 Blob·AI 파싱·정규화 저장은 통과했다. 실제 홈택스/EDI 접수증 파일 포맷별 업로드는 별도 fixture 확보 후 검증한다.

## 4. Related Documents

- **UI_Screens**: [Filing Support Prototype Review](../02_UI_Screens/07_FILING_SUPPORT_PROTOTYPE_REVIEW.md) · [HTML Preview](../02_UI_Screens/previews/05_filing_support.html)
- **Technical_Specs**: [Filing Support Pre-Code Brief](../03_Technical_Specs/09_FILING_SUPPORT_PRE_CODE_BRIEF.md) · [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
- **Technical_Specs**: [VAT Pre-Code Brief](../03_Technical_Specs/07_VAT_PRE_CODE_BRIEF.md) · [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-013 Context Lock
- **QA_Validation**: [VAT Test Scenarios](./05_VAT_TEST_SCENARIOS.md) · [Payroll Test Scenarios](./06_PAYROLL_TEST_SCENARIOS.md) - 선행 화면 QA 패턴
