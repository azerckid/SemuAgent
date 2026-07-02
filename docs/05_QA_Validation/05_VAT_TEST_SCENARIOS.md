# Test Scenarios: VAT
> Created: 2026-07-02 11:03
> Last Updated: 2026-07-02 12:05

부가세(JC-011) Layer 5 QA 시나리오. [VAT Pre-Code Brief](../03_Technical_Specs/07_VAT_PRE_CODE_BRIEF.md)의
Data Contract·Derivation·Mutation·Acceptance를 검증 케이스로 옮긴다.

핵심: **Preview UI 계약 준수**, 세액 산식 정합성, 공제 판정/안분 mutation, 패키지 생성 잠금,
자동 홈택스 제출 비범위, tenant/사업장 범위 격리.

표기: Result 범례 - `PASS·단위`(`lib/vat/summary.test.ts`) / `PASS·구현`(tsc/eslint/build·수동) / `Pending`(구현 전).

## 1. Rubric Validation (Mandatory)

| Criterion | Status | Evidence |
|:---|:---:|:---|
| Functionality | PASS·구현 | read model, 화면, 공제 판정 API, 패키지 guard API 구현 |
| Potential Impact | PASS·구현 | 회사 자가 신고 준비의 핵심 세액 확정 화면 |
| Novelty | PASS·구현 | 자동 제출이 아닌 회사 책임형 신고 보조 경계 유지 |
| UX | Pending | 승인 Preview 4.4와 브라우저 캡처 비교는 로컬 DB/env 준비 후 수행 |
| Open-source | PASS·구현 | `lib/vat/summary.ts` 순수 함수와 기존 전표/tenant 기반 재사용 |
| Business Plan | Pending | 신고 패키지 생성으로 유료 가치 연결 |

## 2. Test Scenarios & Results

### 2.1 기본 렌더 및 구조

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-01 | 인증 tenant + 사업장 + VAT summary | `/dashboard/vat` 진입 | 세액 요약 -> 매출 구분 -> 공제 검토 -> 부속 명세 -> 패키지 순서 | PASS·단위 |
| S-02 | 회사 홈 "부가세 열기"/사이드바 | 클릭 | `/dashboard/vat` 이동 | PASS·단위 |
| S-03 | 승인 Preview 기준 데이터 | 렌더 | 32,000,000 - 18,000,000 = 14,000,000 흐름 재현 | Pending |

### 2.2 기간·사업장 컨텍스트

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-10 | `?period=2026-H1` | 진입 | 2026-01~06 부가세 1기 확정 신고 기준으로 집계 | Pending |
| S-11 | 사업장 없음 | 진입 | 사업장 등록 안내 빈 상태(회계법인/고객사 문구 없음) | PASS·구현 |
| S-12 | tenant A/B 데이터 | tenant A 로더 | B 데이터 미노출 | PASS·단위 |
| S-13 | businessEntity A/B | A 컨텍스트 | B `clientId` VAT summary/review 미집계 | PASS·단위 |

### 2.3 세액 요약 산식

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-20 | outputTax=32,000,000, inputDeductible=18,000,000 | summary 파생 | payableTax=14,000,000 | PASS·단위 |
| S-21 | inputTax 원천 18,320,000 중 pending 320,000 | summary 파생 | 공제 확정분만 inputTaxDeductible에 반영, pending은 잠금 사유 | PASS·단위 |
| S-22 | `isFinal=false` | Hero 렌더 | "예정 세액" 및 검토 확정 전 안내 표시 | Pending |
| S-23 | 마감 2026-07-25, 오늘 2026-07-01 | Hero 렌더 | D-24 표시 | Pending |

### 2.4 매출 구분

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-30 | 과세 공급가액 320,000,000 | Sales card 렌더 | 매출세액 32,000,000 표시 | PASS·단위 |
| S-31 | 영세율 공급가액 40,000,000 | Sales card 렌더 | 매출세액 0 표시 | PASS·단위 |
| S-32 | 면세 공급가액 15,000,000 | Sales card 렌더 | 세액 "해당 없음" 표시 | PASS·단위 |
| S-33 | summary snapshot 없음 | 렌더 | 전표만으로 영세율/면세를 추정하지 않고 빈/대기 상태 | Pending |

### 2.5 매입세액 공제 검토

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-40 | kind=`non_deductible_candidate` | 표 렌더 | danger 칩 "불공제 후보", 불공제 확정/공제 액션 | PASS·단위 |
| S-41 | kind=`proration_required` | 표 렌더 | warn 칩 "안분 필요", 안분 계산 액션 | PASS·단위 |
| S-42 | decision=`deductible` | 표 렌더 | ok 칩 "공제 확정", 확정됨 상태 | PASS·단위 |
| S-43 | 접대비 계정/설명 | 후보 생성 | 불공제 후보로 분류 | Pending |
| S-44 | 공통매입 표시 | 후보 생성 | 안분 필요로 분류 | Pending |

### 2.6 공제 판정·안분 mutation

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-50 | 불공제 후보 행 | "불공제 확정" 클릭 | `PATCH /api/vat/deduction-reviews/[id]` decision=`non_deductible` | PASS·단위 |
| S-51 | 후보 행 | "공제" 클릭 | decision=`deductible`, summary 재계산 | PASS·단위 |
| S-52 | 안분 필요 행 | 안분율 입력 | decision=`prorated`, prorationRateBps 저장, 공제액 재계산 | PASS·단위 |
| S-53 | 다른 tenant reviewId | mutation | 404/403, 데이터 변경 없음 | PASS·단위 |

### 2.7 부속 명세와 패키지 잠금

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-60 | 매출/매입 합계표 준비 | 렌더 | "준비됨" 상태칩 | PASS·단위 |
| S-61 | 불공제 후보 3건 pending | 렌더 | 공제받지 못할 매입세액 명세서 "검토 대기" | PASS·단위 |
| S-62 | pendingDeductionCount=3 | 패키지 카드 렌더 | 버튼 disabled + `aria-disabled=true` + locknote | PASS·구현 |
| S-63 | pendingDeductionCount=3 | 패키지 생성 API 호출 | 409, 패키지 미생성 | PASS·단위 |
| S-64 | pendingDeductionCount=0 | 패키지 생성 클릭 | 생성 허용, packageStatus 갱신 | PASS·단위 |

### 2.8 Preview 계약·책임 경계

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-70 | VAT 화면 컴포넌트 | 정적 분석 | `/dashboard/reviews` 워크스페이스 컴포넌트 미import | PASS·단위 |
| S-71 | VAT 화면 문구 | 렌더 | "자동 제출", "자동 납부", "외부 세무사" 흐름 없음 | PASS·단위 |
| S-72 | package CTA | 렌더 | 홈택스 제출 버튼이 아니라 패키지 생성/입력 가이드 경계 | PASS·단위 |
| S-73 | 파일/패키지 표시 | 렌더 | private storage key·blob URL 미노출 | Pending |

### 2.9 상태(State) 커버리지

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-80 | 페치 지연 | 진입 | 스켈레톤 loading | PASS·구현 |
| S-81 | 확정 전표/VAT summary 없음 | 진입 | "집계할 매출·매입 자료가 없습니다 / 기장검토 먼저 확정" | Pending |
| S-82 | 로드 실패 | 진입 | "세액 집계를 불러오지 못했습니다" + 다시 시도 | PASS·구현 |
| S-83 | 미인증 | 접근 | `/sign-in` redirect | Pending |
| S-84 | tenant 없음 | 진입 | 회사용 접근 안내 | Pending |

## 3. 자동화 계획

- **단위 테스트 완료** (`lib/vat/summary.test.ts`, `lib/validations/vat.test.ts`): S-12~13, S-20~21, S-30~32, S-40~42, S-50~52, S-60~64.
- **정적 검증 완료** (`vat-workspace.test.ts`): Preview 구조(S-01), 라우트(S-02), reviews 미import(S-70), 책임 경계 문구(S-71~72), mutation tenant guard(S-53), package guard(S-63~64).
- **브라우저 수동 검증 예정**: 승인 Preview와 실제 `/dashboard/vat?period=2026-H1` 캡처 비교. 숫자/색상/간격/잠금 버튼 확인.
- **후속 E2E**: 실제 전표 생성부터 VAT summary 생성까지는 JC-014 env/seed 준비 후 검증.

## 4. Related Documents
- **UI_Screens**: [VAT Prototype Review](../02_UI_Screens/05_VAT_PROTOTYPE_REVIEW.md) · [HTML Preview](../02_UI_Screens/previews/03_vat.html)
- **Technical_Specs**: [VAT Pre-Code Brief](../03_Technical_Specs/07_VAT_PRE_CODE_BRIEF.md) · [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-011 Context Lock
- **QA_Validation**: [Bookkeeping Review Test Scenarios](./04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md) - 선행 전표 확정 흐름
