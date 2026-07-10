# Test Scenarios: Bookkeeping Review
> Created: 2026-07-02 09:10
> Last Updated: 2026-07-10 09:02 KST

기장검토(JC-010) Layer 5 QA 시나리오. [Bookkeeping Review Pre-Code Brief](../03_Technical_Specs/06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md)와 [Reconciliation Ledger Phase 2 Brief](../03_Technical_Specs/41_RECONCILIATION_LEDGER_V2_PRE_CODE_BRIEF.md)의 Data Contract·Derivation·Mutation·Acceptance를 검증 케이스로 옮긴다.

핵심: **Preview UI 계약 준수**(GIWA reviews 워크스페이스 미노출), 분류 큐 집계 정확성,
신뢰도 낮음 계정지정 강제, 기존 세션 API 재사용 승인, tenant/사업장 범위 격리.

표기: Result 범례 — `PASS·단위`(`lib/bookkeeping-review/summary.test.ts`) / `PASS·구현`(tsc/eslint/build·수동) / `Pending`(구현 전).

## 1. Rubric Validation (Mandatory)

| Criterion | Status | Evidence |
|:---|:---:|:---|
| Functionality | PASS·구현 | `tsc --noEmit`, `npm run test`, `npm run build` 통과 |
| Potential Impact | PASS·구현 | 회사 자가 기장검토, 6워크스페이스 중 3째 |
| Novelty | PASS·구현 | 사무소 세션 뷰가 아닌 회사 분류 큐(`/dashboard/bookkeeping`) |
| UX | PASS·구현 | Preview 4.3 구조, loading/empty/error, 승인 피드백 구현 |
| Open-source | PASS·구현 | `summary.ts` 순수 함수 분리, 기존 세션 API 재사용 |
| Business Plan | PASS·구현 | 분류 확정→신고 준비 연결 |

## 2. Test Scenarios & Results

### 2.1 기본 렌더 및 구조
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-01 | 인증 tenant + 사업장 + 당기 분류 거래 | `/dashboard/bookkeeping` 진입 | 분류 현황 → 탭 → 큐 표 → 선택 거래 상세 순서 | PASS·구현 |
| S-02 | 회사 홈 "기장검토 열기"/사이드바 | 클릭 | `/dashboard/bookkeeping` 이동 | PASS·구현 |

### 2.2 기간·사업장 컨텍스트
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-10 | `?period=2026-H1` | 진입 | 2026-01~06 세션 거래만 집계 | PASS·단위 |
| S-11 | 사업장 없음 | 진입 | 사업장 등록 안내 빈 상태(회계법인 문구 없음) | PASS·구현 |
| S-12 | 거래 0건 | 진입 | "검토할 거래가 없습니다" 빈 상태 | PASS·구현 |

### 2.3 분류 큐·탭 집계
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-20 | status suggested/needs_decision N건 | 탭 렌더 | 검토 대기 카운트=N | PASS·단위 |
| S-21 | confidence=low & 미확정 M건 | 탭 렌더 | 신뢰도 낮음 카운트=M | PASS·단위 |
| S-22 | confirmed K건 | 탭 렌더 | 확정 카운트=K, 전체=합계 | PASS·단위 |
| S-23 | 세션에 오래된 run + 최신 run | 로더 | 최신 classification_run 행만 집계 | PASS·단위 |

### 2.4 신뢰도·계정 지정 강제
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-30 | confidence high/medium/low | 행 렌더 | 신뢰도 톤 ok/warn/danger 매핑 | PASS·단위 |
| S-31 | confidence=low & status!=confirmed | 행 렌더 | `requiresManualAccount=true`, "계정 지정" 강제 | PASS·단위 |
| S-32 | confidence=low & status=confirmed | 행 렌더 | `requiresManualAccount=false`(이미 확정) | PASS·단위 |

### 2.5 분개 미리보기
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-40 | 선택 거래에 전표 존재 | 상세 렌더 | 차/대변 라인 + 균형 여부 표시 | PASS·구현 |
| S-41 | 전표 미생성 거래 | 상세 렌더 | "분류 확정 후 전표 생성 단계" 잠금 표시 | PASS·구현 |
| S-42 | 차변 합 ≠ 대변 합 | 상세 렌더 | balanced=false로 파생(하드코딩 아님) | PASS·단위 |

### 2.6 승인·수정 mutation (기존 API 재사용)
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-50 | 큐 행 "승인" | 클릭 | `PATCH .../rows/[rowId]` {status:'confirmed'} 호출, 확정 탭 이동 | PASS·구현 |
| S-51 | 여러 세션 행 다중 선택 "일괄 승인" | 클릭 | `uploadSessionId`별 그룹핑 후 세션별 `bulk-confirm` 각각 호출, 결과 합산 | PASS·구현 |
| S-51b | 일괄 승인 중 일부 세션 실패 | 응답 | 성공 건수·실패 세션 구분해 토스트 표시(전체 실패로 처리하지 않음) | PASS·구현 |
| S-52 | low 신뢰도 행 "계정 지정" | finalAccount 지정→확정 | PATCH finalAccount + status confirmed | PASS·구현 |
| S-53 | 각 행 mutation | 호출 | 행의 `uploadSessionId`로 올바른 세션 API 경로 사용 | PASS·구현 |

### 2.7 Preview 계약·책임 경계 (정적)
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-60 | 회사 기장검토 컴포넌트 | 정적 분석 | `/dashboard/reviews`의 ReviewWorkspace 등 GIWA 워크스페이스 컴포넌트를 import하지 않는다 | PASS·구현 |
| S-61 | read model | 정적 분석 | `request_template`·`outbound_email`·`inbound_email`·`staff_mailbox` 미참조 | PASS·단위 |
| S-62 | 화면 문구 | 렌더 | "고객사·세무사·회계법인" 문구 없음 | PASS·구현 |

### 2.8 범위 격리·보안
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-70 | tenant A/B 거래 | tenant A 로더 | B 거래 미노출 | PASS·단위 |
| S-71 | businessEntity A/B | A 컨텍스트 | B `clientId` 세션 거래 미집계 | PASS·단위 |
| S-72 | 큐 행 표시 | 렌더 | 파일명·storage key 미노출(거래 내용만) | PASS·구현 |

### 2.9 상태(State) 커버리지
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-80 | 페치 지연 | 진입 | 스켈레톤(loading) | PASS·구현 |
| S-81 | 로드 실패 | 진입 | "분류 큐를 불러오지 못했습니다" + 다시 시도 | PASS·구현 |
| S-82 | 검토 대기 0건 | 진입 | "검토할 거래가 없습니다 / 분류 확정 완료" 안내(전표 문구 금지) | PASS·구현 |

### 2.10 권한·인증
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-90 | 미인증 | 접근 | `/sign-in` redirect | PASS·구현 |
| S-91 | tenant 없음 | 진입 | 회사용 접근 안내 | PASS·구현 |

### 2.11 자료대조원장 Phase 2

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-100 | live 회사 데이터 | `/dashboard/bookkeeping/reconciliation-ledger` 진입 | fixture가 아닌 tenant/기간 scoped 원장 행이 기본 렌더 | PASS·구현 |
| S-101 | 통장 행과 동일 금액의 세금계산서/현금영수증/카드 행 | 증빙 상태 파생 | 실제 증빙 행을 찾고 `증빙있음` + `증빙 확인` 표시 | PASS·단위 |
| S-102 | `증빙있음` 통장 행 | `증빙 확인` → `찾은 증빙` 한 줄 클릭 | 해당 출처 목록이 열리고 실제 증빙 행이 강조 | PASS·구현 |
| S-103 | 거래처/일자가 유사하나 금액이 다른 행 | 증빙 찾기 | `금액 차이` 표시, `증빙 필요` 유지, 연결 저장 차단 | PASS·단위 |
| S-104 | 사용자가 구체 증빙 행 선택 | 연결 저장 후 reload | `linked_evidence_row_id` 기반으로 동일 행이 다시 `증빙있음` | PASS·구현 |
| S-105 | 저장된 exact 1:1 증빙 링크 | 해제 또는 다른 증빙 선택 | 링크가 null/교체되고 최신 액션 undo 가능 | PASS·구현 |
| S-106 | 개인/업무무관 의심 행 | 소명 입력 | `staffMemo` 저장 후 소명 완료 상태로 전환 | PASS·구현 |
| S-107 | 제외 대상 행 | 사유 입력 후 제외 | `status='excluded'` + 사유 memo 저장, 감사 가능한 제외 행 유지 | PASS·구현 |
| S-108 | 내부이체/대출/세금납부 등 | 증빙 예외 저장 | `증빙 예외: ...` memo 저장, 증빙 링크 clear, 예외 상태 표시 | PASS·구현 |
| S-109 | 미확정 계정 행 | 계정 selector에서 확정 | 실제 account key로 저장되고 카운트 즉시 갱신 | PASS·구현 |
| S-110 | 같은 거래처/방향의 과거 확정 계정 | 다음 기간 행 렌더 | 반복 패턴 근거 표시, 적용/무시 가능, 자동 확정 없음 | PASS·단위 |
| S-111 | 과거 증빙/제외 패턴 | 다음 기간 행 렌더 | 단건 확인 진입점만 표시, 자동 연결/제외 없음 | PASS·단위 |
| S-112 | 동일 거래처·근거·추천 계정의 안전 그룹 | 계정 일괄 수락 | 대상 행 확인 후에만 저장, mixed group은 미노출 | PASS·단위 |
| S-113 | 증빙/제외 패턴 그룹 | 화면 렌더 | v1 일괄 수락 없음, 단건 확인만 유지 | PASS·구현 |
| S-114 | 원장 table-first 화면 | 첫 화면 렌더 | 기간/행동 필터와 원장 표가 먼저 보이고 제거된 hero/source-summary/다음 할 일 카드가 재등장하지 않음 | PASS·구현 |

### 2.12 Slice 2d Path 1 Gate (Pending)

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-120 | tenant A/B와 같은 period key | shared gate load for tenant A | tenant B 행은 blocker/count에 포함되지 않음 | PASS·단위 |
| S-121 | 증빙·소명·계정·제외 blocker가 섞인 동일 기간 | gate derivation | `closingChecklist`와 gate count/reason이 일치 | PASS·단위 |
| S-122 | 신고 준비 허브 | common bookkeeping readiness render | 별도 규칙 복사 없이 shared gate count와 자료대조원장 route 사용 | PASS·구현 |
| S-123 | source collection 또는 reconciliation 미완 | VAT package UI | 생성 버튼 disabled + 정확한 사유와 이동 경로 표시 | PASS·구현 |
| S-124 | source/reconciliation/VAT deduction 중 하나라도 미완 | VAT package POST | API가 conflict 응답으로 거부하고 reason/count/target route 반환 | PASS·단위/구현 |
| S-125 | 세 gate가 모두 ready이나 VAT snapshot provenance 미확인 | VAT package POST | 생성 거부; confirmed-ledger provenance 확인 전 잠금 유지 | PASS·단위/구현 |
| S-126 | 같은 tenant/period의 confirmed filing rows로 VAT 값 rebuild 완료 | VAT package POST | gate 통과 후에만 package status 전환 | Pending |
| S-127 | 원천세·간이지급명세서·지방소득세 payroll route | bookkeeping blocker 존재 | payroll 전용 validation만 적용되고 reconciliation gate로 차단되지 않음 | Pending |
| S-128 | shared gate load | 실행 | classification/VAT/filing DB에 write side effect 없음 | PASS·단위 |

## 3. 자동화 현황 및 후속
- **자동 단위 완료**(`lib/bookkeeping-review/summary.test.ts`): 탭 집계(S-20~23), 신뢰도·계정지정(S-30~32), 분개 균형(S-42), 제외 테이블(S-61), 기간 필터(S-10).
- **정적 검증 완료**(`bookkeeping-review.test.ts`): Preview 구조(S-01), GIWA 워크스페이스 미import(S-60), 문구(S-62), 라우트(S-02).
- **구현 검증 완료**: `tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`.
- **자료대조원장 완료 범위**: Slice 2a/2b의 live read, row mutation, exact 1:1 evidence lifecycle, pattern display/account batch acceptance는 unit + browser E2E로 검증됐다.
- **Slice 2d-1 완료**: S-120~S-122/S-128. dev DB `2026-H1`에서 gate total 698과 신고 준비 분해값(증빙 6 + 소명 5 + 계정 687 + 제외 0)이 일치했다.
- **후속**: Slice 2d-3은 S-126을 자동화하며 confirmed-ledger provenance 또는 deterministic rebuild를 연결한다. S-127 payroll 비차단 경계와 공식 Hometax 파일 assembly 검증은 각각 기존 payroll 계약과 JC-030 범위에서 유지한다.

## 4. Related Documents
- **UI_Screens**: [Bookkeeping Review Prototype Review](../02_UI_Screens/04_BOOKKEEPING_REVIEW_PROTOTYPE_REVIEW.md) · [Bookkeeping HTML Preview](../02_UI_Screens/previews/02_bookkeeping_review.html) · [Reconciliation Prototype Review](../02_UI_Screens/12_RECONCILIATION_LEDGER_PROTOTYPE_REVIEW.md) · [Reconciliation HTML Preview](../02_UI_Screens/previews/12_reconciliation_ledger.html)
- **Technical_Specs**: [Bookkeeping Review Pre-Code Brief](../03_Technical_Specs/06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md) · [Reconciliation Ledger Phase 2 Brief](../03_Technical_Specs/41_RECONCILIATION_LEDGER_V2_PRE_CODE_BRIEF.md) · [Path 1 Readiness Audit](../03_Technical_Specs/40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md) · [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-010 Context Lock
- **QA_Validation**: [Source Collection Test Scenarios](./03_SOURCE_COLLECTION_TEST_SCENARIOS.md) - 동일 패턴 참조
