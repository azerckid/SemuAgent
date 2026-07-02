# Test Scenarios: Bookkeeping Review
> Created: 2026-07-02 09:10
> Last Updated: 2026-07-02 09:10

기장검토(JC-010) Layer 5 QA 시나리오. [Bookkeeping Review Pre-Code Brief](../03_Technical_Specs/06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md)의
Data Contract·Derivation·Mutation·Acceptance를 검증 케이스로 옮긴다.

핵심: **Preview UI 계약 준수**(GIWA reviews 워크스페이스 미노출), 분류 큐 집계 정확성,
신뢰도 낮음 계정지정 강제, 기존 세션 API 재사용 승인, tenant/사업장 범위 격리.

표기: Result 범례 — `PASS·단위`(`lib/bookkeeping-review/summary.test.ts`) / `PASS·구현`(tsc/eslint/build·수동) / `Pending`(구현 전).

## 1. Rubric Validation (Mandatory)

| Criterion | Status | Evidence |
|:---|:---:|:---|
| Functionality | Pending | 구현 후 tsc/test/build |
| Potential Impact | Pending | 회사 자가 기장검토, 6워크스페이스 중 3째 |
| Novelty | Pending | 사무소 세션 뷰가 아닌 회사 분류 큐 |
| UX | Pending | Preview 4.3 구조, loading/empty/error, 승인 피드백 |
| Open-source | Pending | `summary.ts` 순수 함수 분리, 기존 서비스 재사용 |
| Business Plan | Pending | 분류 확정→신고 준비 연결 |

## 2. Test Scenarios & Results

### 2.1 기본 렌더 및 구조
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-01 | 인증 tenant + 사업장 + 당기 분류 거래 | `/dashboard/bookkeeping` 진입 | 분류 현황 → 탭 → 큐 표 → 선택 거래 상세 순서 | Pending |
| S-02 | 회사 홈 "기장검토 열기"/사이드바 | 클릭 | `/dashboard/bookkeeping` 이동 | Pending |

### 2.2 기간·사업장 컨텍스트
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-10 | `?period=2026-H1` | 진입 | 2026-01~06 세션 거래만 집계 | Pending |
| S-11 | 사업장 없음 | 진입 | 사업장 등록 안내 빈 상태(회계법인 문구 없음) | Pending |
| S-12 | 거래 0건 | 진입 | "검토할 거래가 없습니다" 빈 상태 | Pending |

### 2.3 분류 큐·탭 집계
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-20 | status suggested/needs_decision N건 | 탭 렌더 | 검토 대기 카운트=N | Pending |
| S-21 | confidence=low & 미확정 M건 | 탭 렌더 | 신뢰도 낮음 카운트=M | Pending |
| S-22 | confirmed K건 | 탭 렌더 | 확정 카운트=K, 전체=합계 | Pending |
| S-23 | 세션에 오래된 run + 최신 run | 로더 | 최신 classification_run 행만 집계 | Pending |

### 2.4 신뢰도·계정 지정 강제
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-30 | confidence high/medium/low | 행 렌더 | 신뢰도 톤 ok/warn/danger 매핑 | Pending |
| S-31 | confidence=low & status!=confirmed | 행 렌더 | `requiresManualAccount=true`, "계정 지정" 강제 | Pending |
| S-32 | confidence=low & status=confirmed | 행 렌더 | `requiresManualAccount=false`(이미 확정) | Pending |

### 2.5 분개 미리보기
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-40 | 선택 거래에 전표 존재 | 상세 렌더 | 차/대변 라인 + 균형 여부 표시 | Pending |
| S-41 | 전표 미생성 거래 | 상세 렌더 | "기장 확정 후 생성" 잠금 표시 | Pending |
| S-42 | 차변 합 ≠ 대변 합 | 상세 렌더 | balanced=false로 파생(하드코딩 아님) | Pending |

### 2.6 승인·수정 mutation (기존 API 재사용)
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-50 | 큐 행 "승인" | 클릭 | `PATCH .../rows/[rowId]` {status:'confirmed'} 호출, 확정 탭 이동 | Pending |
| S-51 | 여러 세션 행 다중 선택 "일괄 승인" | 클릭 | `uploadSessionId`별 그룹핑 후 세션별 `bulk-confirm` 각각 호출, 결과 합산 | Pending |
| S-51b | 일괄 승인 중 일부 세션 실패 | 응답 | 성공 건수·실패 세션 구분해 토스트 표시(전체 실패로 처리하지 않음) | Pending |
| S-52 | low 신뢰도 행 "계정 지정" | finalAccount 지정→확정 | PATCH finalAccount + status confirmed | Pending |
| S-53 | 각 행 mutation | 호출 | 행의 `uploadSessionId`로 올바른 세션 API 경로 사용 | Pending |

### 2.7 Preview 계약·책임 경계 (정적)
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-60 | 회사 기장검토 컴포넌트 | 정적 분석 | `/dashboard/reviews`의 ReviewWorkspace 등 GIWA 워크스페이스 컴포넌트를 import하지 않는다 | Pending |
| S-61 | read model | 정적 분석 | `request_template`·`outbound_email`·`inbound_email`·`staff_mailbox` 미참조 | Pending |
| S-62 | 화면 문구 | 렌더 | "고객사·세무사·회계법인" 문구 없음 | Pending |

### 2.8 범위 격리·보안
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-70 | tenant A/B 거래 | tenant A 로더 | B 거래 미노출 | Pending |
| S-71 | businessEntity A/B | A 컨텍스트 | B `clientId` 세션 거래 미집계 | Pending |
| S-72 | 큐 행 표시 | 렌더 | 파일명·storage key 미노출(거래 내용만) | Pending |

### 2.9 상태(State) 커버리지
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-80 | 페치 지연 | 진입 | 스켈레톤(loading) | Pending |
| S-81 | 로드 실패 | 진입 | "분류 큐를 불러오지 못했습니다" + 다시 시도 | Pending |
| S-82 | 검토 대기 0건 | 진입 | "검토할 거래가 없습니다 / 분류 확정 완료" 안내(전표 문구 금지) | Pending |

### 2.10 권한·인증
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-90 | 미인증 | 접근 | `/sign-in` redirect | Pending |
| S-91 | tenant 없음 | 진입 | 회사용 접근 안내 | Pending |

## 3. 자동화 현황 및 후속
- **자동 단위 예정**(`lib/bookkeeping-review/summary.test.ts`): 탭 집계(S-20~23), 신뢰도·계정지정(S-30~32), 분개 균형(S-42), 제외 테이블(S-61), 기간 필터(S-10).
- **정적 검증 예정**(컴포넌트 테스트): GIWA 워크스페이스 미import(S-60), 문구(S-62).
- **구현·수동 예정**: 구조(S-01), mutation 배선(S-50~53), 상태(S-80~82), 권한(S-90~91).
- **후속**: 멀티테넌트 전용(S-70~71), 실제 AI 분류·전표 E2E(JC-014).

## 4. Related Documents
- **UI_Screens**: [Bookkeeping Review Prototype Review](../02_UI_Screens/04_BOOKKEEPING_REVIEW_PROTOTYPE_REVIEW.md) · [HTML Preview](../02_UI_Screens/previews/02_bookkeeping_review.html)
- **Technical_Specs**: [Bookkeeping Review Pre-Code Brief](../03_Technical_Specs/06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md) · [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-010 Context Lock
- **QA_Validation**: [Source Collection Test Scenarios](./03_SOURCE_COLLECTION_TEST_SCENARIOS.md) - 동일 패턴 참조
