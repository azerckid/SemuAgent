# First-run Sample Data Pre-Code Technical Brief
> Created: 2026-07-04 00:20
> Last Updated: 2026-07-12 03:50

## 0. Governing Principle

JC-019의 목적은 신규 사용자가 가입 직후 빈 제품을 보는 대신, 이미 승인된 Preview와 같은 업무 상태를 보며 SemuAgent의 메뉴 구조를 빠르게 이해하도록 돕는 것이다.

- 샘플 데이터는 학습용 scaffolding이다. 실제 세무·급여·신고 기록으로 오인되면 안 된다.
- 신규 tenant의 첫 onboarding 완료 직후 자동 생성한다. 별도 "샘플 보기" 버튼을 먼저 누르게 하지 않는다.
- 모든 화면에는 샘플 데이터임을 알리는 visible banner/badge를 표시한다.
- 사용자는 실사용 전 샘플 데이터를 한 번에 삭제할 수 있어야 한다.
- 삭제는 샘플 레지스트리에 기록된 행만 대상으로 하며, 같은 tenant의 실제 업로드·급여·신고 데이터는 보존한다.
- 기존 tenant 또는 샘플을 삭제한 tenant에는 자동 재생성하지 않는다.

## 1. Scope

이 문서는 JC-019 구현 계약이다. 2026-07-04 구현 PR에서 migration, seed 함수, 삭제 API, 전역 banner UI를 이 계약 기준으로 추가했다.

포함 범위:
1. 온보딩 완료 시 first-run sample dataset 생성
2. 승인된 8개 Preview의 데이터 서사를 seed 기준으로 재사용
3. 샘플 상태 banner/badge 표시
4. 샘플 전체 삭제 API와 확인 UI
5. tenant + businessEntity 범위 격리
6. 생성 실패·삭제 실패·부분 삭제 실패 상태

비범위:
- 실제 홈택스 제출, 자동 납부, 은행/카드/EDI 자동 로그인
- 실제 파일 원본 또는 Vercel Blob 샘플 파일 저장
- 샘플 데이터를 실제 회계장부로 변환하는 마이그레이션
- 기존 실데이터 tenant에 자동으로 샘플을 채우는 작업

## 2. User Flow

```text
신규 가입
  -> /onboarding 회사/사업장 생성
  -> first-run sample dataset 자동 생성(best effort)
  -> /dashboard 진입
  -> 전 화면 상단에 "샘플 데이터" banner 표시
  -> 사용자가 메뉴를 둘러봄
  -> "샘플 데이터 삭제하고 실제 사용 시작" 클릭
  -> 확인 dialog
  -> dataset을 즉시 `deleted`로 전환
  -> real empty/default 상태로 전환
  -> registry에 기록된 샘플 행은 응답 뒤에 정리
```

실패 처리:
- sample seed가 실패해도 onboarding 완료를 막지 않는다.
- seed 실패 시 dashboard에 "샘플 데이터를 만들지 못했습니다" 상태와 재시도 CTA를 표시한다.
- 삭제 실패 시 실제 데이터는 건드리지 않고 오류를 표시한다. 삭제는 idempotent해야 한다.

## 3. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Seed trigger | onboarding tenant + first businessEntity 생성 직후 서버 액션/route에서 best-effort 실행 |
| Retry API | `POST /api/first-run-sample` 후보. active sample이 있으면 idempotent no-op |
| Delete API | `DELETE /api/first-run-sample` 후보. active dataset의 registry row만 삭제 |
| Read helper | `lib/first-run-sample/summary.ts` 후보. active sample 여부와 banner 상태 파생 |
| Seed helper | `lib/first-run-sample/seed.ts` 후보. preview 기준 sample row 생성 |
| Cleanup helper | `lib/first-run-sample/cleanup.ts` 후보. whitelist + delete order 기반 삭제 |
| UI | 공용 `SampleDataBanner`, `SampleDataBadge`, `DeleteSampleDataDialog` 후보 |
| 노출 위치 | dashboard layout 또는 각 workspace shell 상단. 모든 메뉴에서 같은 CTA 제공 |

## 4. Data Model Decision

샘플 식별은 도메인 테이블마다 `is_sample` 컬럼을 흩뿌리지 않고, **registry 기반**으로 한다.

신규 테이블 후보:
- `sample_dataset`: tenant/businessEntity별 샘플 묶음과 상태
- `sample_entity_ref`: 샘플 생성 시 만들어진 실제 domain row의 table/id registry

이 방식의 이유:
- 기존 0053~0057 도메인 테이블에 광범위한 nullable column을 추가하지 않는다.
- 삭제 경계가 명시적이다. registry 행과 그 행이 참조하는 런타임 파생 행만 삭제한다.
- 실데이터와 같은 read model 경로를 타므로 화면 이해도가 높다.
- v1에서는 전역 banner로 샘플임을 표시하고, row-level badge는 필요한 화면에만 점진 적용할 수 있다.

삭제 규칙:
1. `sample_dataset.status='active'`인 dataset만 삭제 대상이다.
2. `sample_entity_ref`의 `tenant_id`, `client_id`, `sample_dataset_id`가 모두 세션 scope와 일치해야 한다.
3. `entity_table`은 서버 whitelist에 있는 테이블만 허용한다. 알 수 없는 registry 항목이 있으면 cleanup을 실패 처리하고 registry를 보존해 orphan을 숨기지 않는다.
4. `delete_order` 내림차순으로 자식 테이블부터 삭제한다.
5. registry에 없는 row, 사용자가 업로드한 Blob, 실제 `upload_file.storage_key`는 삭제하지 않는다.
6. 샘플 생성 과정에서 만든 첫 사업장(`client`)은 온보딩 회사명을 사용하고, v1 cleanup whitelist에서 제외해 보존한다. 사용자가 샘플 삭제 전 실제 자료를 입력했을 때 사업장 껍데기가 함께 삭제되는 위험을 피하기 위한 축소 구현이다.
7. 삭제 확인 직후 dataset은 `deleted`로 표시해 banner를 숨긴다. registry 대상 샘플 행과 그 파생 행 정리는 응답 뒤에 수행한다. 정리가 끝나기 전에는 기존 workspace와 사이드바 집계를 보여주지 않고 실제 사용 전환 화면만 보이며, 다음 요청에서 정리를 재시도한다. 물리 dataset row는 감사용으로 보존하고 registry row는 성공한 cleanup 뒤 제거한다.

## 5. Seed Contract: Preview Data Mapping

| 화면 | Preview 기준 | Seed 핵심 값 |
|:---|:---|:---|
| 회사 홈 | `00_company_home.html` | 온보딩 회사명을 첫 사업장명으로 사용, `2026-H1`, 미수집 1/24, 분류 대기 18/342, 부가세 공제 검토 3, 급여 마감 완료(확인 필요 0) |
| 자료수집 | `01_source_collection.html` | 자료 23/24, 세금계산서 8/8, 통장 4/4, 카드 2/3, 영수증 정규화 대기 3, 파싱 오류 1 |
| 기장검토 | `02_bookkeeping_review.html` | 계정과목 확정 324/342, 검토 대기 18, 신뢰도 낮음 5, 선택 3건 승인 가능 |
| 부가세 | `03_vat.html` | 매출세액 32,000,000, 매입세액(예정 공제) 18,000,000, 납부 예정 14,000,000, 불공제 후보 3 |
| 급여 | `04_payroll.html` | 2026-06, 대상 11명(정규직 6·프리랜서 2·일용직 3), 지급 35,740,000(비과세 식대 포함), 공제 3,248,120, 실지급 32,491,880, 확인 필요 0(11명 전원 확정·기간 마감) |
| 신고지원 | `05_filing_support.html` | 부가세 패키지 잠금, 원천세 준비됨(사업자 프로필 채움), 4대보험 확인 완료, 접수증 보관 대기 |
| 직원 명부 | `06_employee_directory.html` | 전체 11명, 재직 11, 퇴사 0, 급여 대상 11, 4대보험 확인 필요 0(정규직·일용직은 `enrolled`, 일용직은 '고용보험만' 보조표기, 프리랜서만 `not_applicable`) |
| 리마인드 | `07_internal_reminder.html` | 활성 규칙 3, 리마인드 대상 2, 발송 실패 1, provider missing 상태 예시 |

샘플 seed는 위 숫자를 read model이 자연스럽게 파생하도록 domain row를 만든다. 단, 실제 파일 원본·민감 원문·자격증명은 만들지 않는다.

> 급여 정합화(2026-07-12): 데모의 "확인 필요 1건(김대표 4대보험 취득일 누락)·기간 blocked" 상태를 제거하고, 11명 전원 `ready`(확정) + 기간 `closed`(마감) + 4대보험 신고항목 `ready`로 정리했다. 또한 샘플 사업자 프로필(`tenant_billing_profile`, 사업자번호·대표자명 등 가공값)을 추가해 원천세 화면의 사업자 확인 항목까지 채운다. 이 결과 급여·원천세·지방소득세·지급명세서 금액이 서로 정확히 일치하고(원천세 A01도 확정 기준=전체 11명과 동일), "입력 전 확인" 경고가 없는 완결 상태를 보여준다. preview HTML 목업(`04_payroll.html`·`05_filing_support.html` 등)은 여전히 예전 "확인 필요" 교육 상태를 그림으로 담고 있어 seed와 1:1로 일치하지 않는다.
>
> 급여·직원 seed 확장(2026-07-12): 초기 preview mockup의 정규직 12명/직원 14명 구성을, 고용형태 다양성을 보여주기 위해 정규직 6·프리랜서 2·일용직 3(활성 11명)으로 재구성했다. 기본급은 200만~600만으로 분산하고, 원천/4대보험은 고용형태별로 격리한다(정규직=간이세액표식 표시값+4대보험, 프리랜서=사업소득 3.3%·4대보험 없음, 일용직=(일급−15만)×2.7%·소액부징수 산식+고용보험만). 정규직 6명에는 비과세 식대 월 20만원을 배정하며, 식대는 지급계에는 포함하되 과세소득·4대보험 근사 기준에서는 제외한다. 표시되는 세액·4대보험은 모두 "확정값" 성격의 샘플이며, 앱이 세액을 계산하지 않는다. 이에 따라 seed 값은 원본 preview HTML 숫자와 더 이상 1:1로 일치하지 않는다.
>
> 정규직 소득세 간이세액표 조회 전환(2026-07-12): 정규직 소득세를 임의 하드코딩 값에서 **근로소득 간이세액표(소득세법 시행령 별표2) 직접 조회값**으로 전환했다(`lib/payroll/simplified-tax-table.ts`). 파생 산식이 아니라 별표2 조견표의 실제 공표 세액을 "과세소득 구간 × 공제대상가족수"로 조회하므로 법령 원문과 1:1 대조 검증이 가능하다. 정규직 6명의 과세소득(240·280·300·360·440·600만원)은 표의 실제 행에 정확히 안착하며, `payroll_employee_line.dependent_count`(마이그레이션 0072)로 공제대상가족수를 저장해 부양가족 효과를 보여준다. 자녀공제(8~20세) 규칙도 담았으나 샘플은 자녀 0으로 미적용. 일용직은 직원명부에서 `not_applicable` 대신 `enrolled`(고용보험만)로 정정해 급여 고용보험 부과와 일치시키고, 급여대장에 고용형태 기준 4대보험 정합성 교차검증(`lib/payroll-workspace/consistency.ts`)을 추가했다. 이 결과 정규직 소득세 변경으로 급여 공제총액이 3,686,030 → 3,248,120, 실지급이 32,053,970 → 32,491,880으로 갱신된다. 상세: [49_SIMPLIFIED_TAX_TABLE_LOOKUP](49_SIMPLIFIED_TAX_TABLE_LOOKUP.md).

## 6. Mutation Contract

| 액션 | 허용 | 규칙 |
|:---|:---:|:---|
| first-run sample 자동 생성 | O | 신규 tenant + 첫 businessEntity 생성 직후 1회 |
| sample 재시도 생성 | O | active/deleted 상태 확인 후 idempotent 처리 |
| sample 전체 삭제 | O | 확인 dialog 후 registry 기반 삭제 |
| sample 일부만 삭제 | X | v1에서는 일괄 삭제만 제공 |
| 실데이터와 sample merge | X | 사용자는 sample 삭제 후 실제 데이터를 입력한다 |
| sample row에 실제 파일/PII 원문 저장 | X | storage key·주민번호·계좌·전화·자격증명 원문 금지 |

## 7. UI Contract

샘플이 active인 동안 모든 dashboard 화면 상단에 같은 banner를 표시한다.

필수 문구:
- "샘플 데이터로 보는 화면입니다"
- "실제 신고 전에 샘플을 삭제하고 회사 자료를 업로드하세요"
- CTA: "샘플 데이터 삭제하고 실제 사용 시작"

삭제 확인 dialog:
- 삭제 대상은 샘플 데이터뿐이라는 설명
- 실제 업로드·급여·신고 데이터는 삭제하지 않는다는 설명
- 삭제 후 자동 재생성되지 않는다는 설명
- primary confirm + secondary cancel

## 8. Implementation Sequence

1. Drizzle schema/migration: `sample_dataset`, `sample_entity_ref`
2. `lib/first-run-sample/seed.ts`: sample dataset 생성 + domain row seed + registry 기록
3. `lib/first-run-sample/cleanup.ts`: whitelist/delete order 기반 idempotent cleanup
4. `lib/first-run-sample/summary.ts`: active sample 상태와 banner state 파생
5. onboarding 완료 경로에 seed best-effort 연결
6. `DELETE /api/first-run-sample`: 삭제 API + zod/tenant guard
7. 공용 banner/dialog UI를 dashboard shell에 연결
8. QA seed 브라우저 확인: 신규 가입 -> sample active -> 삭제 -> empty/default 전환

## 9. Acceptance Criteria

1. 신규 tenant는 온보딩 직후 승인 Preview와 유사한 채워진 화면을 본다.
2. 모든 dashboard 화면에서 샘플 데이터임을 명확히 인지할 수 있다.
3. 사용자는 한 번의 명시적 확인으로 샘플 데이터를 삭제할 수 있다.
4. 삭제는 registry가 추적하는 샘플 행에만 작동한다.
5. 실데이터가 있는 tenant나 이미 sample을 삭제한 tenant에는 자동 재생성되지 않는다.
6. seed 실패가 온보딩 성공을 막지 않는다.
7. 모든 sample query/mutation은 tenant + businessEntity scope를 적용한다.

## 10. Open Items

- 구현 PR에서 sample deletion whitelist와 delete order를 실제 FK 관계에 맞춰 확정했다. `client`/사업장 행은 삭제하지 않는다.
- row-level sample badge는 v1 필수에서 제외하고, 전역 banner로 모든 dashboard workspace에 표시한다.
- Browser QA는 PR 배포 후 신규 계정에서 가입 -> 온보딩 -> sample 표시 -> 삭제 플로우로 최종 확인한다.

## 11. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 셀프사용 제품 목적
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - first-run sample 진입·삭제 흐름
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - SampleDataBanner/Delete dialog UI 계약
- **UI_Screens**: [HTML Preview 폴더](../02_UI_Screens/previews/) - seed 기준이 되는 승인 Preview 8종
- **Technical_Specs**: [DB Schema](./03_DB_SCHEMA.md) - sample dataset registry 논리 모델
- **Technical_Specs**: [Component & Library Plan](./02_COMPONENT_LIBRARY_PLAN.md) - sample banner/dialog 컴포넌트 계획
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-019 Context Lock
- **QA_Validation**: [First-run Sample Data Test Scenarios](../05_QA_Validation/10_FIRST_RUN_SAMPLE_DATA_TEST_SCENARIOS.md) - 생성·표시·삭제 검증 기준
