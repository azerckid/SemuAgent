# Test Scenarios: Company Home
> Created: 2026-07-01 23:05
> Last Updated: 2026-07-01 23:35

회사 홈(JC-006) Layer 5 QA 시나리오와 구현 검증 기록. [Company Home Pre-Code Brief](../03_Technical_Specs/04_COMPANY_HOME_PRE_CODE_BRIEF.md)의
Data Contract·Derivation Rules·Acceptance Criteria를 검증 가능한 케이스로 옮긴다. 회사 홈은 **읽기 전용**이므로
DB mutation은 없고, 데이터 파생·범위 격리·상태·제외 테이블 미참조가 핵심 검증 대상이다.

## 1. Rubric Validation (Mandatory)

| Criterion | Status (Pass/Fail) | Evidence |
|:---|:---:|:---|
| Functionality | Pass | `/dashboard` 회사 홈 구현, `npx tsc --noEmit`, `npm test`, `npm run build` 통과 |
| Potential Impact | Pass | 6개 워크스페이스 진입점 집약, 회사 셀프운영 대시보드 |
| Novelty | Pass | 세무사무소용이 아닌 회사 자가운영 첫 화면(마케팅 아님) |
| UX | Pass | 읽기 전용 SSR, Hero/Action/Status/Recent/State 구조, loading/error 경계 구현 |
| Open-source | Pass | 순수 파생 함수 분리(`lib/company-home/summary.ts`), 재사용 가능 |
| Business Plan | Pass | 신고 마감·blocker 노출로 회사 세무운영 리텐션 기여 |

## 2. Test Scenarios & Results

표기: 각 시나리오는 Given / When / Then. Result 범례 — `PASS·단위`: `lib/company-home/summary.test.ts`
자동 단위 테스트로 검증(10건 통과, 2026-07-01). `PASS·구현`: 구현되어 tsc/eslint/build 및 수동 확인으로
검증했으나 전용 자동 테스트는 후속(§3 참조).

### 2.1 기본 렌더 및 구조
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-01 | 인증된 tenant + 사업장 1개, 당기 데이터 존재 | `/dashboard` 진입 | 회사 홈이 Hero → 다음 할 일 → 준비 현황 → 최근 제출·영수증 순서로 표시 | PASS·구현 |
| S-02 | 동일 | 첫 진입 | 마케팅 페이지가 아니라 대시보드가 보인다 | PASS·구현 |

### 2.2 기간 Hero 파생
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-10 | `period=2026-H1`, 오늘 2026-07-01, 마감 2026-07-25 | Hero 렌더 | dDay=24, filingDeadline=2026-07-25 표기 | PASS·단위 |
| S-11 | period 미지정 | 진입 | 현재 신고 관련 기간이 기본 선택된다 (조기 1월은 전년 2기) | PASS·단위 |
| S-12 | progressPercent 계산 입력 | Hero 렌더 | 진행률 바가 파생값과 일치(하드코딩 아님) · 현재 의미는 "기간 경과" | PASS·구현 |

### 2.3 다음 할 일(actionItems) 우선순위
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-20 | danger 1건·warn 2건 존재 | 목록 렌더 | 정렬이 danger → warn → ok 순 | PASS·단위 |
| S-21 | 미분류 거래 18건 | actionItem 계산 | 기장검토 항목 count=18, href=기장검토 | PASS·단위 |
| S-22 | 각 actionItem | CTA 클릭 | 자료수집·기장검토·급여로 라우팅(부가세 actionItem은 "기장 확정 후 산출" 정책으로 제외; Brief §5) | PASS·단위 |

### 2.4 준비 현황 카드 소스 정확성
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-30 | `request_item_validation`에 missing/non_compliant/uncertain 존재, reviewStatus!=excluded | 자료수집 카드 계산 | 미수집 건수가 해당 조건 행 수와 일치 | PASS·단위 |
| S-31 | `bookkeeping_transaction_classification.status in (needs_decision, unclassified)` | 기장검토 카드 | 미분류 건수 일치 | PASS·단위 |
| S-32 | 전용 `vat_*` 테이블 없음 | 부가세 카드 | 수치 대신 "기장 확정 후 산출/검토 대기" 상태만 표시 | PASS·구현 |
| S-33 | 신고 기간 내 `payroll_extraction_row.aiVerdict='fail'` 행 존재 | 급여 카드 | 확인 필요 직원 수가 기간 범위 fail row 수로 표시된다(latest-batch 스코프는 JC-012 후속) | PASS·구현 |
| S-34 | 전용 `filing_*` 테이블 없음 | 신고지원 카드 | 패키지 잠금/대기 상태 표시 | PASS·구현 |

### 2.5 민감정보·범위 격리 (보안)
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-40 | 최근 제출·영수증 행 | 렌더 | private blob URL·storage key·이메일·주민정보를 표시하지 않는다(안전한 제목만) | PASS·구현 (fileType 기반 제목) |
| S-41 | tenant A + tenant B 데이터 공존 | tenant A로 로더 실행 | 모든 쿼리가 tenantId·businessEntityId 범위를 벗어나지 않는다(B 데이터 미노출) | PASS·구현 (쿼리 스코프; 멀티테넌트 전용 테스트 후속) |
| S-42 | 기간 필터 | 로더 | `period.startMonth <= rowMonth <= period.endMonth`만 집계 | PASS·단위 (monthInPeriod) |

### 2.6 제외 테이블 미참조 (책임 경계)
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-50 | 회사 홈 데이터 로더 | 정적 분석/테스트 | `request_template`·`client_request_schedule`·`client_request_event`·`outbound_email`·`inbound_email`·`staff_mailbox` 계열을 참조하지 않는다 | PASS·단위 |

### 2.7 상태(State) 커버리지
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-60 | 데이터 페치 지연 | 진입 | 카드·표 스켈레톤(loading) 표시 | PASS·구현 (loading.tsx) |
| S-61 | 사업장 없음 | 진입 | 사업장 미보유 빈 상태(회사용 온보딩 안내) | PASS·구현 |
| S-62 | 사업장 있으나 자료·최근 이력 없음 | 진입 | 자료 없음/최근 이력 없음 빈 상태가 각각 분리되어 표시 | PASS·구현 |
| S-63 | 데이터 로드 실패 | 진입 | "현황을 불러오지 못했습니다" + 다시 시도 | PASS·구현 (error.tsx) |

### 2.8 권한·인증
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-70 | 미인증 사용자 | `/dashboard` 접근 | `/sign-in`으로 이동 | PASS·구현 |
| S-71 | 인증됐으나 tenant 미소속 | 진입 | 회사용 접근 안내(회계법인 문구 금지) | PASS·구현 |

### 2.9 무변경(read-only) 보장
| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-80 | 회사 홈 어떤 상호작용 | 페이지 사용 | DB mutation이 발생하지 않는다 | PASS·단위 (read-only loader) |
| S-81 | 기간 선택 변경 | pill 선택 | URL search param(`?period=`)만 갱신, DB 저장 없음 | PASS·구현 |
| S-82 | 회사 홈 | 사용 | 업로드·승인·패키지 생성·접수증 업로드 mutation을 수행하지 않는다 | PASS·구현 |

## 3. 자동화 현황 및 후속
- **자동 단위 완료** (`lib/company-home/summary.test.ts`, 10건 통과): 기간 파생(S-10·S-11), actionItems 우선순위·범위(S-20·S-21·S-22), 소스 카운트(S-30·S-31), 기간 필터(S-42), 제외 테이블 미참조(S-50), read-only loader(S-80).
- **구현·빌드/수동 검증** (전용 자동 테스트 후속): 구조 순서(S-01·S-02), 진행률 파생(S-12), VAT/급여/신고 상태 카드(S-32~S-34), 민감정보 미노출(S-40), 상태(S-60~63), 권한(S-70·S-71), URL-only/무 mutation(S-81·S-82).
- **후속 테스트 권장**: 멀티테넌트 격리 전용 테스트(S-41), payroll latest-batch 스코프 테스트(S-33 세부), 컴포넌트/E2E(S-01·상태·권한).

## 4. Implementation Verification

- 구현 파일: `lib/company-home/summary.ts`, `app/(dashboard)/dashboard/page.tsx`, `app/(dashboard)/dashboard/_components/company-home.tsx`, `app/(dashboard)/dashboard/loading.tsx`, `app/(dashboard)/dashboard/error.tsx`.
- 자동화 완료: `lib/company-home/summary.test.ts` 10개 테스트.
- 검증 완료: `npx vitest run lib/company-home/summary.test.ts`, `npx tsc --noEmit`, `npx eslint ...`, `npm test`, `npm run build`.
- 런타임 확인: 기존 dev server `http://localhost:3000`에서 `/dashboard` 미인증 접근이 `/sign-in`으로 redirect, `/sign-in` 200 응답.
- 축소 구현: 부가세/신고지원 전용 React 라우트는 JC-011/JC-013 범위라 회사 홈 섹션 앵커로 연결.

## 5. Related Documents
- **UI_Screens**: [Company Home Prototype Review](../02_UI_Screens/02_COMPANY_HOME_PROTOTYPE_REVIEW.md) - 승인된 화면·상태
- **UI_Screens**: [HTML Preview](../02_UI_Screens/previews/00_company_home.html) - 검증 기준 화면
- **Technical_Specs**: [Company Home Pre-Code Brief](../03_Technical_Specs/04_COMPANY_HOME_PRE_CODE_BRIEF.md) - Data Contract·Derivation·Acceptance
- **Technical_Specs**: [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) - 테이블 소스·제외 테이블
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-006 Context Lock·Acceptance
- **QA_Validation**: [MVP QA Baseline](./01_MVP_QA_BASELINE.md) - 공통 릴리스 기준
