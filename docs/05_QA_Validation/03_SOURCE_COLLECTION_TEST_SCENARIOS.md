# Test Scenarios: Source Collection
> Created: 2026-07-01 23:55
> Last Updated: 2026-07-17 (CUI-3d shared upload path regression)

자료수집(JC-009) Layer 5 QA 시나리오. [Source Collection Pre-Code Brief](../03_Technical_Specs/05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md)의
Data Contract·Derivation Rules·Mutation·Acceptance Criteria를 검증 가능한 케이스로 옮긴다.

회사 홈(JC-006)과 달리 **업로드·파싱 mutation**이 핵심이므로, read model 정확성과
mutation 경계·외부 포털 미노출·tenant 격리를 함께 검증한다.

## 1. Rubric Validation (Mandatory)

| Criterion | Status (Pass/Fail) | Evidence |
|:---|:---:|:---|
| Functionality | Pending | 구현 후 `tsc` / `npm test` / `npm run build` |
| Potential Impact | Pending | 회사 홈 다음 워크스페이스, 첫 mutation 도입 |
| Novelty | Pending | 회계사무소 포털이 아닌 회사 내부 업로드 흐름 |
| UX | Pending | Preview 4.2 구조, loading/empty/error, 재시도 CTA |
| Open-source | Pending | `lib/source-collection/summary.ts` 순수 함수 분리 예정 |
| Business Plan | Pending | 수집 완결성·미수집 노출로 신고 준비 리텐션 |

## 2. Test Scenarios & Results

표기: Given / When / Then. Result 범례 — `PASS·단위`: `lib/source-collection/summary.test.ts`
자동 단위 테스트. `PASS·구현`: tsc/eslint/build 및 수동 확인. `Pending`: 구현 전.

### 2.1 기본 렌더 및 구조
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-01 | 인증 tenant + 사업장 1개 | `/dashboard/direct-upload` 진입 | Completeness → Dropzone → Source Type Tiles → Import Table → Missing Checklist 순서 | Pending |
| S-02 | 회사 홈 사이드바 | "자료수집" 클릭 | 동일 화면 진입 | Pending |
| S-03 | 회사 홈 actionItem | "자료수집 열기" 클릭 | `/dashboard/direct-upload` 이동 | Pending |

### 2.2 기간·사업장 컨텍스트
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-10 | `?period=2026-H1` | 진입 | 2026-01~2026-06 범위 세션·파일만 집계 | Pending |
| S-11 | period 미지정 | 진입 | 회사 홈과 동일 기본 기간 적용 | Pending |
| S-12 | 사업장 없음 | 진입 | 사업장 등록 안내 빈 상태(회계법인 문구 없음) | Pending |

### 2.3 수집 완결성(Completeness)
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-20 | required 24, missing 1 | Header 렌더 | progressPercent 파생, 미수집 1건 강조 | Pending |
| S-21 | missing 0 | Header 렌더 | 완결 또는 100%에 가까운 진행률 | Pending |
| S-22 | `customer_upload` 소스 세션 존재 | 로더 | 집계에서 제외, `staff_direct`만 포함 | Pending |

### 2.4 자료유형 타일
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-30 | 세금계산서 item_group 충족 | 타일 렌더 | ok 톤, 건수 일치 | Pending |
| S-31 | 카드 매입 미수집 | 타일 렌더 | warn 톤, 미수집 상태 | Pending |
| S-32 | 유형 미매핑 파일 | 타일 렌더 | unknown/기타 합산, 오류 없음 | Pending |

### 2.5 수집(가져오기) 상태 표
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-40 | 정규화 완료 파일 | 표 행 | progress 100%, ok 상태칩 | Pending |
| S-41 | analyzing 파일 | 표 행 | 진행 중 상태·progress < 100% | Pending |
| S-42 | failed 파일 | 표 행 | danger 상태 + "다시 시도" CTA | Pending |
| S-43 | 모든 import 행 | 렌더 | storage key·blob URL·이메일 미표시, safeTitle만 | Pending |

### 2.6 미수집·확인 필요
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-50 | validation missing 1건 | Missing 목록 | 항목 제목·설명·"다시 업로드" CTA | Pending |
| S-51 | needs_review 정규화 3건 | Missing 목록 | "정규화 확인" CTA, 기장검토 연계 href | Pending |

### 2.7 업로드·파싱 mutation
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-60 | 허용 형식 PDF ≤50MB | 드롭존 업로드 | `upload_file` 저장 + status uploaded→analyzing | PASS·Preview E2E(CUI-3d 공용 업로드 경로, PDF/XLSX callback·DB 상태 확인) |
| S-61 | 미지원 형식(CSV·ZIP 포함) | 업로드 시도 | 거부·사용자 오류 메시지, DB 저장 없음(서버 MIME 정본) | PASS·단위(공용 MIME 정본·client 조기 거부) |
| S-62 | 파싱 실패 파일 | "다시 시도" | analyze 재호출, 상태 갱신 | PASS·통합(`retry/route.test.ts`) |
| S-63 | 암호 보호 Excel | 비밀번호 입력 | password flow 후 분석 재개 | PASS·단위(`file-password.test.ts`, 비밀번호 비저장 포함) |
| S-64 | 세션 생성 | 첫 업로드 전 | `source='staff_direct'`, tenant·client scope | PASS·Preview+통합(`staff_direct`·`source_batch` 실측, A/B tenant fixture) |

### 2.8 JC-004·책임 경계
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-70 | 자료수집 화면 전체 | DOM/링크 검사 | `/upload/[token]`·외부 포털·메일 요청 링크 없음 | Pending |
| S-71 | 화면 문구 | 렌더 | "고객사·세무사·회계법인·고객 요청 메일" 문구 없음 | Pending |
| S-72 | read model | 정적 분석 | `outbound_email`·`inbound_email`·`staff_mailbox`·`request_template` 미참조 | Pending |

### 2.9 범위 격리·보안
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-80 | tenant A/B 데이터 | tenant A 로더 | B 데이터 미노출 | Pending |
| S-81 | businessEntity A/B | A 사업장 컨텍스트 | B `clientId` 세션·파일 미집계 | Pending |
| S-82 | 기간 외 세션 | H1 필터 | H1 밖 accountingPeriod 제외 | Pending |

### 2.10 상태(State) 커버리지
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-90 | 데이터 페치 지연 | 진입 | Completeness·Table 스켈레톤 | Pending |
| S-91 | 업로드 0건 | 진입 | "첫 자료 업로드" 빈 상태 | Pending |
| S-92 | 로드 실패 | 진입 | "파일을 처리하지 못했습니다" + 다시 시도 | Pending |

### 2.11 권한·인증
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-100 | 미인증 | `/dashboard/direct-upload` | `/sign-in` redirect | Pending |
| S-101 | tenant 없음 | 진입 | 회사용 접근 안내 | Pending |

## 3. 자동화 현황 및 후속

- **구현 전(게이트)**: Pre-Code Brief·본 시나리오 문서 작성 완료. Result는 구현 후 채움.
- **자동 단위 예정** (`lib/source-collection/summary.test.ts`): S-20~22, S-30~32, S-40 파생, S-72, 기간 필터 S-10·S-82.
- **구현·수동/E2E 예정**: 구조(S-01~03), JC-004(S-70~71), 상태(S-90~92), 권한(S-100~101).
- **CUI-3d 공용 경로 검증 완료**: 업로드 mutation(S-60~64), 재시도(S-62), MIME 거부(S-61), password flow(S-63), tenant scope(S-64).
- **후속**: 멀티테넌트 전용(S-80~81), 컴포넌트 E2E.

## 4. Implementation Verification

- 구현 예정 파일: `lib/source-collection/summary.ts`, `app/(dashboard)/dashboard/direct-upload/page.tsx`, `app/(dashboard)/dashboard/direct-upload/_components/source-collection.tsx`, `loading.tsx`, `error.tsx`.
- 재사용: `POST /api/staff-direct-upload`, `lib/ai/process.ts`, `lib/upload/file-display.ts`, `lib/company-home/summary.ts`(기간).
- 축소/후속: `client_request_event` 브리지 유지·UI 미노출, 다사업장 선택, API 경로 rename.

## 5. Related Documents
- **UI_Screens**: [Source Collection Prototype Review](../02_UI_Screens/03_SOURCE_COLLECTION_PROTOTYPE_REVIEW.md)
- **UI_Screens**: [HTML Preview](../02_UI_Screens/previews/01_source_collection.html)
- **Technical_Specs**: [Source Collection Pre-Code Brief](../03_Technical_Specs/05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md)
- **Technical_Specs**: [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-009 Context Lock
- **QA_Validation**: [Company Home Test Scenarios](./02_COMPANY_HOME_TEST_SCENARIOS.md) - 기간·tenant 패턴 참조
- **QA_Validation**: [MVP QA Baseline](./01_MVP_QA_BASELINE.md)
