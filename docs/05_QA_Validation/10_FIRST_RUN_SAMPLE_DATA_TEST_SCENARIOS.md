# First-run Sample Data Test Scenarios
> Created: 2026-07-04 00:20
> Last Updated: 2026-07-12 03:50

## 1. Scope

이 문서는 JC-019 첫 가입 샘플 데이터의 QA 계약이다. 목적은 신규 사용자가 승인 Preview와 유사한 채워진 화면을 먼저 보고, 실제 사용 전 샘플 데이터를 안전하게 삭제할 수 있음을 검증하는 것이다.

결과 범례:
- `Pending`: 구현 전
- `PASS · unit`: 단위/정적 테스트로 통과
- `PASS · integration`: API/DB 통합 테스트로 통과
- `PASS · browser`: 브라우저 수동 또는 자동 검증으로 통과
- `FAIL`: 수정 필요

## 2. Scenario Matrix

| ID | Area | Scenario | Expected | Result |
|:---|:---|:---|:---|:---|
| S-01 | First-run | 신규 사용자가 가입 후 회사/사업장을 만든다. | 온보딩 완료 후 active sample dataset이 1개 생성된다. | PASS · unit |
| S-02 | First-run | sample seed가 성공한 신규 tenant가 `/dashboard`에 진입한다. | 회사 홈이 빈 상태가 아니라 preview와 유사한 채워진 상태로 보인다. | Pending |
| S-03 | First-run | 기존 tenant 사용자가 다시 로그인한다. | sample이 자동 생성되지 않는다. | PASS · unit |
| S-04 | First-run | sample을 삭제한 tenant가 다시 로그인한다. | sample이 자동 재생성되지 않는다. | PASS · unit |
| S-05 | First-run | seed 중 일부 domain row 생성이 실패한다. | 온보딩은 완료되고 재시도 가능한 sample 생성 오류 상태가 표시된다. | PASS · unit |
| S-10 | Data Contract | 회사 홈 sample을 조회한다. | 미수집 1/24, 분류 대기 18/342, 부가세 공제 검토 3, 급여 확인 필요 0(마감 완료)이 표시된다. | PASS · unit |
| S-11 | Data Contract | 자료수집 sample을 조회한다. | 자료 23/24, 카드 1건 미수집, 영수증 정규화 대기 3, 파싱 오류 1이 표시된다. | PASS · unit |
| S-12 | Data Contract | 기장검토 sample을 조회한다. | 324/342 확정, 검토 대기 18, 신뢰도 낮음 5가 표시된다. | PASS · unit |
| S-13 | Data Contract | 부가세 sample을 조회한다. | 매출세액 32,000,000 - 매입세액 18,000,000 = 납부 예정 14,000,000으로 표시된다. | PASS · unit |
| S-14 | Data Contract | 급여 sample을 조회한다. | 대상 11명(정규직 6·프리랜서 2·일용직 3), 지급 35,740,000(비과세 식대 포함), 공제 3,248,120, 실지급 32,491,880, 확인 필요 0(전원 확정·기간 마감)이 표시된다. 정규직 소득세는 근로소득 간이세액표(별표2) 조회값(공제대상가족수별). | PASS · unit |
| S-15 | Data Contract | 신고지원 sample을 조회한다. | 부가세 패키지 잠금, 원천세 준비됨(사업자 프로필 채움), 4대보험 확인 완료, 접수증 대기가 표시된다. | PASS · unit |
| S-16 | Data Contract | 직원 명부 sample을 조회한다. | 전체 11명, 재직 11, 퇴사 0, 급여 대상 11, 4대보험 확인 필요 0. 정규직·일용직은 '가입'(일용직은 '고용보험만' 보조표기), 프리랜서만 '해당 없음'. | PASS · unit |
| S-18 | Cross-check | 급여 sample에서 4대보험 정합성 교차검증을 확인한다. | 정합 상태에서는 경고 0건. 프리랜서에 4대보험이 잡히거나 일용직에 국민연금/건강보험이 잡히면 경고 배너로 노출된다(고용형태 기준). | PASS · unit |
| S-17 | Data Contract | 리마인드 sample을 조회한다. | 활성 규칙 3, 대상 2, 실패 1과 provider missing 상태 예시가 표시된다. | PASS · unit |
| S-20 | Labeling | sample active 상태에서 각 dashboard 화면을 연다. | 전역 banner 또는 badge가 샘플 데이터임을 명확히 표시한다. | PASS · unit |
| S-21 | Labeling | sample banner의 삭제 CTA를 확인한다. | "샘플 데이터 삭제하고 실제 사용 시작" CTA가 표시된다. | PASS · unit |
| S-22 | Labeling | 사용자가 삭제 dialog를 연다. | 실제 데이터는 삭제하지 않고 sample만 삭제한다는 설명이 보인다. | PASS · unit |
| S-30 | Deletion | sample 삭제를 확정한다. | dataset은 즉시 deleted 상태로 전환된다. 정리 중에는 기존 workspace를 숨기고 전환 안내만 보이며, registry·파생 sample row 정리가 끝나면 empty/default 화면을 보인다. | Pending |
| S-31 | Deletion | sample 삭제 API를 두 번 호출한다. | 두 번째 호출은 idempotent하게 성공 또는 no-op 처리된다. | Pending |
| S-32 | Deletion | sample 삭제 후 회사 홈·자료수집·기장검토·부가세·급여·신고지원·직원명부·리마인드를 연다. | 정리 중에는 본문·사이드바 어느 곳에도 sample 집계·준비 상태가 보이지 않고, 완료 뒤 실제 empty/default 상태가 보인다. | Pending |
| S-33 | Deletion | sample 삭제 후 사용자가 실제 파일을 업로드한다. | 실제 업로드 row는 sample registry에 들어가지 않는다. | Pending |
| S-34 | Deletion | 실데이터가 있는 tenant에서 sample 삭제를 호출한다. | registry에 없는 실데이터 row는 삭제되지 않는다. | Pending |
| S-40 | Scope | tenant A가 tenant B의 sampleDatasetId로 삭제 API를 호출한다. | tenant scope mismatch로 거부되거나 삭제 0건 처리된다. | PASS · unit |
| S-41 | Scope | businessEntity A 사용자가 businessEntity B sample row를 조회한다. | 범위 밖 sample row가 표시되지 않는다. | Pending |
| S-42 | Scope | registry에 whitelist 밖 `entity_table` 값을 주입한다. | cleanup이 해당 row를 삭제하지 않고 오류/감사 상태로 남긴다. | Pending |
| S-50 | Privacy | sample seed가 주민번호·계좌번호·전화번호 원문을 만든다. | 원문 필드는 생성되지 않는다. | PASS · unit |
| S-51 | Privacy | sample seed가 Blob storage key 또는 실제 파일 URL을 만든다. | 실제 원본 파일/Blob은 생성하지 않는다. | PASS · unit |
| S-52 | Privacy | sample 리마인드 메일 본문을 생성한다. | 민감정보 원문 없이 샘플 업무 상태만 포함한다. | Pending |
| S-60 | State | sample seed pending 상태에서 dashboard를 연다. | 로딩 또는 생성 중 안내가 표시된다. | Pending |
| S-61 | State | sample seed failed 상태에서 dashboard를 연다. | 재시도 CTA와 실패 안내가 표시된다. | PASS · unit |
| S-62 | State | sample delete failed 상태가 발생한다. | banner가 유지되고 다시 시도 안내가 표시된다. | PASS · unit |
| S-70 | Static | `sample_entity_ref` 삭제 whitelist를 정적 검증한다. | 허용된 domain table만 cleanup 대상이다. | PASS · unit |
| S-71 | Static | sample cleanup 코드가 `delete from <table>` 동적 문자열을 직접 조합하는지 검사한다. | whitelist 매핑 함수 외 임의 SQL 조합이 없다. | PASS · unit |
| S-72 | Static | sample banner가 모든 dashboard workspace shell에 포함되는지 검사한다. | 회사 홈·자료수집·기장검토·부가세·급여·신고지원·직원명부·리마인드에서 노출된다. | PASS · unit |
| S-80 | Browser | 신규 계정으로 가입부터 sample 삭제까지 수행한다. | 가입 -> 온보딩 -> sample active -> 삭제 -> empty/default 전환이 끊기지 않는다. | Pending |
| S-81 | Browser | 승인 Preview와 실제 sample 화면을 캡처 비교한다. | 구조·색상·주요 수치가 preview 계약과 일치한다. | Pending |

## 3. Automation Plan

- `lib/first-run-sample/seed.test.ts`: deterministic id, preview 수치 fixture, 민감정보·실제 Blob 미생성
- `lib/first-run-sample/cleanup.test.ts`: whitelist, delete order, tenant/client scope, idempotent 삭제
- `lib/first-run-sample/summary.test.ts`: active/deleted/failed banner state
- API/static route tests: onboarding seed 호출, `POST /api/first-run-sample`, `DELETE /api/first-run-sample` session/staff/tenant guard
- Static tests: dashboard shell sample banner 포함, 임의 테이블 delete 금지
- Browser QA: 프로덕션 또는 preview DB에서 신규 가입 -> 온보딩 -> sample 표시 -> 삭제 플로우 검증(구현 PR 이후 별도 확인)

## 4. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 신규 회사 사용자의 셀프사용 목적
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - first-run sample 생성·삭제 흐름
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - sample banner/delete dialog 계약
- **Technical_Specs**: [First-run Sample Data Pre-Code Brief](../03_Technical_Specs/12_FIRST_RUN_SAMPLE_DATA_PRE_CODE_BRIEF.md) - 구현 전 계약
- **Technical_Specs**: [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) - sample dataset registry 논리 모델
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-019 Context Lock
