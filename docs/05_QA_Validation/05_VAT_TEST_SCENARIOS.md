# Test Scenarios: VAT
> Created: 2026-07-02 11:03
> Last Updated: 2026-07-11

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
| UX | PASS·구현 | 승인 Preview 4.4와 `/dashboard/vat?period=2026-H1` 브라우저 캡처 대조 완료 |
| Open-source | PASS·구현 | `lib/vat/summary.ts` 순수 함수와 기존 전표/tenant 기반 재사용 |
| Business Plan | PASS·구현 | 신고 패키지 생성 잠금/가이드 흐름으로 유료 가치 연결 |

## 2. Test Scenarios & Results

### 2.1 기본 렌더 및 구조

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-01 | 인증 tenant + 사업장 + VAT summary | `/dashboard/vat` 진입 | 세액 요약 -> 매출 구분 -> 공제 검토 -> 부속 명세 -> 패키지 순서 | PASS·단위 |
| S-02 | 회사 홈 "부가세 열기"/사이드바 | 클릭 | `/dashboard/vat` 이동 | PASS·단위 |
| S-03 | 승인 Preview 기준 데이터 | 렌더 | 32,000,000 - 18,000,000 = 14,000,000 흐름 재현 | PASS·단위 |

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
| S-21 | JC-011 기존 fixture의 inputTax 원천 18,000,000 중 pending 공제 검토 3건 | summary 파생 | pending은 예정 공제액에 포함하되 패키지 잠금 사유로 유지 | PASS·단위 |
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
| S-61 | JC-011 기존 fixture의 공제 검토 3건 pending | 렌더 | 공제받지 못할 매입세액 명세서 "검토 대기" | PASS·단위 |
| S-62 | source/reconciliation/deduction/provenance 중 하나 이상 미완 | 패키지 카드 렌더 | 버튼 disabled + `aria-disabled=true` + 사유별 count/이동 경로 | PASS·구현 |
| S-63 | composite package gate 미완 | 패키지 생성 API 호출 | 409, 패키지 미생성, 동일 reason/count/target route 반환 | PASS·단위/구현 |
| S-64 | source/reconciliation/deduction은 ready, provenance 미확인 | 패키지 생성 클릭 | 생성 거부, 확정 원장 출처 검증 전 잠금 유지 | PASS·단위/구현 |
| S-65 | source/reconciliation/deduction/provenance 모두 ready | 패키지 생성 클릭 | packageStatus 갱신 | PASS·단위/정적 · Slice 2d-3c |
| S-66 | stored snapshot은 있으나 exact VAT facts/fingerprint 없음 | 패키지 생성 | snapshot presence만으로 잠금 해제하지 않음 | PASS·감사 |
| S-67 | confirmed VAT facts에서 deterministic rebuild 완료 | package gate 검증 | current fingerprint가 일치할 때만 생성 허용 | PASS·단위 · Slice 2d-3c |
| S-68 | parser가 exact supply/tax/gross와 tax type을 읽음 | classification 저장 | 산술 일치 시 `derived` VAT fact + source row identity 저장 | PASS·단위 · Slice 2d-3b |
| S-69 | exact basis가 빠진 evidence row | classification 저장 | 금액 추정 없이 `needs_review` 저장 | PASS·단위 · Slice 2d-3b |
| S-70 | staff VAT fact가 산술 불일치 또는 원장 gross와 불일치 | row PATCH | 400 거부, 기존 fact 미변경 | PASS·단위 · Slice 2d-3b |
| S-71 | migration 0067 이후 summary provenance metadata가 null | package gate | 2d-3c rebuild 전 잠금 유지 | PASS·설계 · Slice 2d-3b |
| S-74 | 과세·영세율·면세 매출과 매입 exact VAT facts | deterministic rebuild | 공급가액·매출/매입세액·공제세액·납부세액을 exact 값으로 재현 | PASS·단위 · Slice 2d-3c |
| S-75 | suggested/미해결/inconsistent fact 또는 unlinked/out-of-scope/pending deduction review | rebuild | 409용 issue로 차단, summary 미변경 | PASS·단위 · Slice 2d-3c |
| S-76 | 같은 confirmed inputs가 다른 순서로 로드됨 | fingerprint 계산 | 같은 fingerprint 생성 | PASS·단위 · Slice 2d-3c |
| S-77 | rebuild 뒤 source fact 또는 공제 결정 변경 | package gate 검증 | stored fingerprint 불일치로 다시 잠금 | PASS·단위 · Slice 2d-3c |
| S-78 | 선행 gate는 ready이고 exact inputs는 유효하나 snapshot이 stale | VAT 패키지 카드 | `확정 원장 다시 계산`을 명시적으로 노출; 자동 재계산 없음 | PASS·단위/정적 · Slice 2d-3c |

### 2.8 Preview 계약·책임 경계

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-70 | VAT 화면 컴포넌트 | 정적 분석 | `/dashboard/reviews` 워크스페이스 컴포넌트 미import | PASS·단위 |
| S-71 | VAT 화면 문구 | 렌더 | "자동 제출", "자동 납부", "외부 세무사" 흐름 없음 | PASS·단위 |
| S-72 | package CTA | 렌더 | 홈택스 제출 버튼이 아니라 패키지 생성/준비값 확인 경계 | PASS·단위 |
| S-73 | 파일/패키지 표시 | 렌더 | private storage key·blob URL 미노출 | Pending |

### 2.9 상태(State) 커버리지

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-80 | 페치 지연 | 진입 | 스켈레톤 loading | PASS·구현 |
| S-81 | 확정 전표/VAT summary 없음 | 진입 | "집계할 매출·매입 자료가 없습니다 / 기장검토 먼저 확정" | Pending |
| S-82 | 로드 실패 | 진입 | "세액 집계를 불러오지 못했습니다" + 다시 시도 | PASS·구현 |
| S-83 | 미인증 | 접근 | `/sign-in` redirect | Pending |
| S-84 | tenant 없음 | 진입 | 회사용 접근 안내 | Pending |

### 2.10 JC-035 AI 부가세 판단

아래 시나리오는 [VAT AI Tax Treatment Completion Contract](../03_Technical_Specs/44_VAT_AI_TAX_TREATMENT_COMPLETION_CONTRACT.md),
[VAI-2 Rule Matrix](../03_Technical_Specs/45_VAT_AI_TAX_TREATMENT_RULE_MATRIX.md),
[VAI-2 Pre-Code Brief](../03_Technical_Specs/46_VAT_AI_TAX_TREATMENT_PRE_CODE_BRIEF.md)를 기준으로 구현한다.
결과는 구현 단계별로 `PASS`·`PARTIAL`·`Pending`을 구분한다.

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-90 | 사업 무관·비영업용 승용차·기업업무추진비처럼 공식 규칙에 명확히 해당 | 판단 파생 | LLM 없이 불공제 가능성·규칙 조항·근거 사실 표시, 자동확정 없음 | PASS·VAI-3a 단위 |
| S-91 | 같은 tenant·사업장에 같은 거래처/용도의 사용자 확정 이력 | 반복 거래 판단 | 이전 확정 건수·기간·결정을 패턴 근거로 표시, 다른 tenant 이력 미사용 | PASS·VAI-3a 단위/정적 |
| S-92 | 규칙·패턴으로 결정하기 어려운 거래 목적 | 단일 AI 판단 | 가능성·근거·부족한 정보·신뢰도 표시, 사용자 확정 전 저장값 미변경 | PASS·VAI-3b 단위/정적 |
| S-93 | 영세율/면세·고액·낮은 신뢰도 또는 1차 모델 불일치 | multi-provider 판단 | Gemini+OpenAI 결과를 비교하고 불일치 시 Claude 중재; 최종은 사용자 확인 필요 | Pending |
| S-94 | 영세율 가능 거래에 계약서·외화입금 등 필수 증빙 일부 누락 | 사용자 확정 시도 | 누락 증빙 표시, 영세율 확정과 downstream gate 해제 차단 | PASS·VAI-4a transaction/VAI-4b UI 정적 |
| S-95 | 면세 가능 거래가 명칭만 있고 인허가·실질 용역 정보 부족 | 판단 파생 | 면세 자동확정 금지, 내용 보완 또는 전문가 확인 상태 | PASS·VAI-3a 단위 |
| S-96 | 공통매입에 실지귀속 정보 존재 | 안분 판단 | 실지귀속을 우선 사용하고 단순 비율 안분을 자동 적용하지 않음 | PARTIAL·VAI-3a 안분 확인 표시, 실지귀속 소비 후속 |
| S-97 | provider timeout·quota·invalid schema·전체 실패 | VAT 화면 사용 | 무한 loading 없이 해당 행만 수동 확인, 표·검색·기존 mutation 계속 동작 | PASS·VAI-3b 단위/정적 |
| S-98 | AI 추천과 사용자 판단이 다름 | 사용자가 `다르게` 확정 | 사용자 최종 결정이 저장되고 추천·규칙 버전·확정자·시각을 별도로 감사 가능 | PARTIAL·VAI-4a transaction/VAI-4b UI·단위, 오너 브라우저 확인 대기 |
| S-99 | 미확정 AI 판단이 1건 이상 | rebuild/package gate | 추천만으로 gate 해제되지 않고, 사용자 확정된 VAT fact/decision만 소비 | Pending |
| S-100 | 법령 규칙 버전 변경 | 기존 확정 행 로드 | 기존 결정을 몰래 변경하지 않고 재검토 필요 여부와 새 규칙 버전을 표시 | Pending |
| S-101 | 실제 홈택스 조회자료를 가져오지 않음 | VAT 판단 표 렌더 | `홈택스 현재값`·실제 차액을 표시하지 않고 `자동채움 예상`과 확인·수정 행동만 표시 | PASS·VAI-3a 정적 |
| S-102 | 사업용 카드 매입의 SemuAgent 판단이 불공제 가능성 높음 | 행 렌더 | `공제·불공제 확인`을 표시하고 사용자 확정 전 기존 decision을 바꾸지 않음 | PASS·VAI-3a 단위 |
| S-103 | 계좌·핀테크 매출이 전자증빙 집계에서 누락될 가능성 | 행 렌더 | `금액 추가·수정 확인`과 누락 매출 근거를 표시, 홈택스 현재 누락으로 단정하지 않음 | Pending |
| S-104 | 사용자가 방금 적용·변경·보류·전문가 확인한 판단을 잘못 처리 | 최신 toast에서 `되돌리기` | 일회용 토큰이 일치하고 canonical 값이 다시 바뀌지 않은 경우에만 이전 canonical·감사 상태를 원자적으로 복원 | PASS·VAI-4b 단위/dev 서비스 E2E |

## 3. 자동화 계획

- **단위 테스트 완료** (`lib/vat/summary.test.ts`, `lib/vat/package-gate.test.ts`, `lib/vat/provenance.test.ts`, `lib/validations/vat.test.ts`): S-03, S-12~13, S-20~21, S-30~32, S-40~42, S-50~52, S-60~67, S-74~78.
- **정적 검증 완료** (`vat-workspace.test.ts`): Preview 구조(S-01), 라우트(S-02), reviews 미import(S-70), 책임 경계 문구(S-71~72), mutation tenant guard(S-53), composite package guard(S-63~65), explicit rebuild route/action(S-78).
- **브라우저 수동 검증 완료**: 승인 Preview와 실제 `/dashboard/vat?period=2026-H1` 캡처 비교. 숫자/상태/잠금 버튼/인라인 안분 UI 확인.
- **후속 E2E**: JC-014에서 실제 Blob·AI 파싱·정규화 저장은 통과했다. 실제 전표 생성부터 VAT summary 생성까지의 도메인 E2E는 별도 회계 시드 준비 후 검증한다.
- **JC-035 자동화 계획**: VAI-3a에서 Zod·deterministic 규칙·이전 확정 패턴·read model을, VAI-3b에서 provider mock·timeout/quota·invalid schema fallback·PII·batch/소비자 격리를 자동화했다. VAI-4a에서 tenant·stale fingerprint·필수 증빙·canonical/audit transaction rollback을, VAI-4b에서 사용자 액션 UI·API 응답 Zod·latest-only undo·dev 서비스 E2E를 자동화했다. VAI-5~6은 consensus·gate를 단계적으로 자동화한다.

## 4. Related Documents
- **UI_Screens**: [VAT Prototype Review](../02_UI_Screens/05_VAT_PROTOTYPE_REVIEW.md) · [HTML Preview](../02_UI_Screens/previews/03_vat.html)
- **Technical_Specs**: [VAT Pre-Code Brief](../03_Technical_Specs/07_VAT_PRE_CODE_BRIEF.md) · [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
- **Technical_Specs**: [VAT AI Tax Treatment Completion Contract](../03_Technical_Specs/44_VAT_AI_TAX_TREATMENT_COMPLETION_CONTRACT.md) · [VAI-2 Rule Matrix](../03_Technical_Specs/45_VAT_AI_TAX_TREATMENT_RULE_MATRIX.md) · [VAI-2 Pre-Code Brief](../03_Technical_Specs/46_VAT_AI_TAX_TREATMENT_PRE_CODE_BRIEF.md) - JC-035 VAI-0~6 완료선·규칙·저장 계약
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-011 Context Lock
- **QA_Validation**: [Bookkeeping Review Test Scenarios](./04_BOOKKEEPING_REVIEW_TEST_SCENARIOS.md) - 선행 전표 확정 흐름
