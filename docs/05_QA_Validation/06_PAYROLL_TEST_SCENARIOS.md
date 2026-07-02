# Test Scenarios: Payroll
> Created: 2026-07-02 14:21
> Last Updated: 2026-07-02 14:34

급여(JC-012) Layer 5 QA 시나리오. [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md)의
Data Contract·Derivation·Mutation·Acceptance를 검증 케이스로 옮긴다.

핵심: **Preview UI 계약 준수**, 급여 금액 산식 정합성, 건강보험 EDI/사회보험 고지액 우선 반영,
확인 필요 직원에 따른 마감 잠금, 개인정보 마스킹, tenant/사업장 범위 격리.

표기: Result 범례 - `PASS·단위` / `PASS·구현` / `Pending`(구현 전).

## 1. Rubric Validation (Mandatory)

| Criterion | Status | Evidence |
|:---|:---:|:---|
| Functionality | Pending | read model, 화면, 고지액 import/match, 문서 생성, 마감 API 구현 후 검증 |
| Potential Impact | Pending | 회사 직접 급여정산·신고지원의 핵심 워크스페이스 |
| Novelty | Pending | 계산 추정값과 공식 고지액을 분리해 실무 오차를 줄이는 흐름 |
| UX | Pending | 승인 Preview 4.5와 브라우저 캡처 비교 필요 |
| Open-source | Pending | 기존 `lib/payroll` 파이프라인과 순수 파생 함수 재사용 |
| Business Plan | Pending | 급여 마감·명세서·신고지원 산출물로 유료 가치 연결 |

## 2. Test Scenarios & Results

### 2.1 기본 렌더 및 구조

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-01 | 인증 tenant + 사업장 + 급여 월 summary | `/dashboard/payroll` 진입 | 급여 요약 -> 확인 필요 -> 급여대장 -> 공제 상세 -> 명세서·마감 순서 | Pending |
| S-02 | 사이드바 "급여" | 클릭 | `/dashboard/payroll` 이동 | Pending |
| S-03 | 승인 Preview 기준 데이터 | 렌더 | 42,600,000 - 5,840,000 = 36,760,000 흐름 재현 | Pending |

### 2.2 기간·사업장 컨텍스트

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-10 | `?period=2026-06` | 진입 | 2026년 6월 급여 기준으로 집계 | Pending |
| S-11 | 사업장 없음 | 진입 | 사업장 등록 안내 빈 상태(회계법인/고객사 문구 없음) | Pending |
| S-12 | tenant A/B 데이터 | tenant A 로더 | B 데이터 미노출 | Pending |
| S-13 | businessEntity A/B | A 컨텍스트 | B `clientId` payroll line/summary 미집계 | Pending |

### 2.3 급여 금액 산식

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-20 | baseSalary + allowance | line 파생 | 지급계가 두 값의 합과 일치 | Pending |
| S-21 | incomeTax + localIncomeTax | line 파생 | 원천세 합계가 두 값의 합과 일치 | Pending |
| S-22 | 국민연금+건강보험+장기요양+고용보험 | line 파생 | 4대보험 합계와 일치 | Pending |
| S-23 | 원천세 + 4대보험 + 기타공제 | line 파생 | 공제계와 일치 | Pending |
| S-24 | 지급계 - 공제계 | line 파생 | 실지급액과 일치 | Pending |
| S-25 | 여러 직원 line | summary 파생 | 각 summary 금액이 line 합계와 일치 | Pending |
| S-26 | Preview seed | summary 파생 | 지급 42,600,000 / 공제 5,840,000 / 실지급 36,760,000 | Pending |

### 2.4 4대보험 고지액 매칭

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-30 | 건강보험 EDI/사회보험 고지 line이 직원과 매칭 | summary 파생 | 건강보험·장기요양 등 고지액이 계산 추정값보다 우선 | Pending |
| S-31 | 고지액 없음 | 렌더 | 해당 직원은 `missing_notice` 또는 확인 필요로 표시 | Pending |
| S-32 | 동일 이름/코드 중복으로 매칭 모호 | 매칭 | `ambiguous`로 표시하고 마감 잠금 | Pending |
| S-33 | 고지액과 계산값 차이 존재 | 렌더 | 차이 사유 또는 확인 필요 표시 | Pending |
| S-34 | 주민등록번호가 포함된 고지 파일 | import | 원문 주민번호 저장 금지, matchKeyHash만 저장 | Pending |
| S-35 | 보수월액 변경·입퇴사 일할·소급분이 포함된 고지액 | summary 파생 | 계산 추정값을 덮어쓰지 않고 고지액 우선 + 차액/사유 표시 | Pending |
| S-36 | 건강보험 연말정산·감면·추징·환급이 포함된 고지액 | summary 파생 | 조정분을 0원 처리하지 않고 고지액 반영 근거로 유지 | Pending |
| S-37 | 전월 신고 반영 지연분이 다음 달 고지에 포함 | 렌더 | 해당 월 고지 source와 차이 설명이 표시되고 마감 전 확인 가능 | Pending |

### 2.5 확인 필요와 마감 잠금

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-40 | 확인 필요 직원 1명 | 렌더 | warn alert "확인 필요 직원 1명" 표시 | Pending |
| S-41 | issueCount > 0 | 마감 카드 렌더 | "급여 마감·확정" 버튼 disabled + `aria-disabled=true` + locknote | Pending |
| S-42 | issueCount > 0 | close API 호출 | 409, closeStatus 변경 없음 | Pending |
| S-43 | 모든 issue 해결 | close API 호출 | closeStatus=`closed`, closedBy/closedAt 기록 | Pending |
| S-44 | closeStatus=`closed` | line 수정 시도 | 수정 거부 또는 잠금 상태 표시 | Pending |

### 2.6 직원 line mutation

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-50 | 직원 line | 기본급/수당 수정 | line 금액과 summary가 재계산 | Pending |
| S-51 | 확인 필요 line | "처리 완료" | status=`ready`, issueCode/message 해소 | Pending |
| S-52 | 다른 tenant lineId | mutation | 404/403, 데이터 변경 없음 | Pending |
| S-53 | 잘못된 음수 금액 | mutation | zod 검증 실패, 데이터 변경 없음 | Pending |

### 2.7 급여대장·공제 상세

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-60 | 직원별 line | 급여대장 렌더 | 기본급·수당·지급계·원천세·4대보험·공제계·실지급 컬럼 표시 | Pending |
| S-61 | 확인 필요 line | 급여대장 렌더 | 행 강조 + "확인 필요" 플래그 표시 | Pending |
| S-62 | summary deduction values | 공제 상세 렌더 | 소득세·지방소득세·국민연금·건강보험·장기요양·고용보험 집계 표시 | Pending |
| S-63 | 고지액 source 사용 | 공제 상세 렌더 | 4대보험 항목 source가 `notice`로 표시 | Pending |

### 2.8 명세서·신고지원 연동

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-70 | ready payroll summary | 명세서 생성 | 급여명세서/지급명세서 상태가 generated 또는 failed로 기록 | Pending |
| S-71 | 원천징수 지급명세서 준비 | 신고지원 연동 | JC-013이 읽을 수 있는 내부 산출물 상태 제공 | Pending |
| S-72 | storage key 존재 | 화면 렌더 | private storage key·Blob URL 미노출 | Pending |

### 2.9 개인정보·책임 경계

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-80 | 비권한 사용자 | 렌더 | 직원명/급여 민감 정보 마스킹 또는 접근 차단 | Pending |
| S-81 | 직원 주민번호/전화/계좌 모양 값 | 렌더 | 화면과 QA seed에 원문 미노출 | Pending |
| S-82 | 고지내역 업로드 파일 | 저장 | 원본은 private storage, 화면에는 안전한 파일명/상태만 노출 | Pending |
| S-83 | 급여 화면 문구 | 정적 분석 | EDI 자동 로그인, 자동 제출, 공동인증서 저장 문구 없음 | Pending |
| S-84 | 급여 화면 컴포넌트 | 정적 분석 | GIWA 사업장 상세 급여 규칙 패널 미import | Pending |

### 2.10 상태(State) 커버리지

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-90 | 페치 지연 | 진입 | 스켈레톤 loading | Pending |
| S-91 | 급여 line 0건 | 진입 | "급여 자료 불러오기" 빈 상태 | Pending |
| S-92 | 로드 실패 | 진입 | "급여 계산을 불러오지 못했습니다" + 다시 시도 | Pending |
| S-93 | 미인증 | 접근 | `/sign-in` redirect | Pending |
| S-94 | tenant 없음 | 진입 | 회사용 접근 안내 | Pending |

## 3. 자동화 계획

- **단위 테스트 예정** (`lib/payroll-workspace/summary.test.ts`): S-03, S-12~13, S-20~34, S-40~44.
- **정적 검증 예정** (`payroll-workspace.test.ts`): Preview 구조(S-01), route(S-02), GIWA 급여 규칙 패널 미import(S-84), 책임 경계 문구(S-83), PII 미노출(S-80~82).
- **API 테스트 예정**: line patch/resolve, insurance notice import/match, documents, close guard(S-42~53, S-70).
- **브라우저 수동 검증 예정**: 승인 Preview와 실제 `/dashboard/payroll?period=2026-06` 캡처 비교. 숫자/색상/간격/마감 잠금 확인.
- **후속 E2E**: 실제 EDI/사회보험 고지내역 파일 포맷별 import는 JC-014 env/fixture 준비 후 검증.

## 4. Related Documents
- **UI_Screens**: [Payroll Prototype Review](../02_UI_Screens/06_PAYROLL_PROTOTYPE_REVIEW.md) · [HTML Preview](../02_UI_Screens/previews/04_payroll.html)
- **Technical_Specs**: [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md) · [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) · [Component & Library Plan](../03_Technical_Specs/02_COMPONENT_LIBRARY_PLAN.md)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-012 Context Lock
- **QA_Validation**: [VAT Test Scenarios](./05_VAT_TEST_SCENARIOS.md) - 선행 화면 QA 패턴
