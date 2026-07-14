# Shared Filing UI Patterns Prototype Review

> Created: 2026-07-14
> Last Updated: 2026-07-14
> Status: owner approved · D1-D3 runtime complete
> Preview: [17_shared_filing_patterns.html](./previews/17_shared_filing_patterns.html)

## 1. 검토 목적

신고 준비 화면마다 다르게 구현된 확인 필요 항목, 기간 표시, 홈택스·위택스 안내를 같은 정보 순서와 밀도로 정리한다. 공통화 자체가 목적이 아니라 사용자가 어느 세목에서도 `무엇을 먼저 처리하고`, `어느 포털에서 무엇을 해야 하는지` 같은 방식으로 읽게 하는 것이 목적이다.

## 2. Preview 결정안

1. 확인 필요 항목은 `상태 점 · 제목 · 설명 · 한 개 CTA` 순서로 표시한다.
2. 확인 필요 항목이 0건이면 목록 전체를 표시하지 않는다.
3. 기간은 Topbar의 한 위치에서만 표시한다. 실제 이전·다음 기간 URL이 있을 때만 이동 버튼을 제공한다.
4. 홈택스와 위택스는 `포털 · 대상 세목 · SemuAgent가 준비한 것 · 사용자가 수행할 것 · 포털 열기` 순서를 공유한다.
5. 위택스의 엑셀파일신고 경로는 확인됐지만 공식 Excel 원본을 입수하지 않았으므로 `공식 원본 입수 대기`로 표시하고 파일 생성 가능하다고 말하지 않는다.
6. 데스크톱은 한 행 비교, 모바일은 같은 순서를 세로로 쌓는다.

## 3. 상태 계약

| 패턴 | 상태 | 표시 |
|:---|:---|:---|
| 확인 필요 | `danger` | 완료 전 다음 단계가 차단되는 항목, 강한 CTA |
| 확인 필요 | `warn` | 확인 권장 항목, outline CTA |
| 기간 | 이동 가능 | 이전·다음 버튼과 현재 기간 |
| 기간 | 읽기 전용 | 현재 기간만 표시, 가짜 이동 버튼 없음 |
| 포털 안내 | 준비됨 | 확정값·입력 위치와 사용자 행동 |
| 포털 안내 | 원본 미확인 | 확인된 값만 표시하고 업로드·자동 제출 표현 금지 |

## 4. 유지 경계

- blocker 원본 타입과 계산 로직은 각 도메인에 남긴다.
- 기간 URL·기본 기간·마감 판정은 기존 도메인 로더를 재사용한다.
- 홈택스·위택스 로그인, 자동 입력, 자동 제출, 납부를 추가하지 않는다.
- 세액 계산, DB, API, migration을 변경하지 않는다.
- 첫 runtime 단계는 공통 표시 컴포넌트 추출과 기존 화면 교체만 수행한다.

## 5. 오너 확인

- [x] 확인 필요 목록의 정보 밀도가 적절하다.
- [x] 기간 선택이 한 위치에서 이해된다.
- [x] 홈택스·위택스 안내가 같은 수준으로 읽힌다.
- [x] 위택스의 `공식 원본 입수 대기` 표현이 과장 없이 정확하다.
- [x] 모바일 적층 순서가 자연스럽다.

2026-07-14 오너 승인 후 [Brief 61](../03_Technical_Specs/61_SHARED_FILING_UI_PATTERNS_BRIEF.md) §3의 D1 → D2 → D3 순서로 runtime을 구현한다.

## 6. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 직접사용·신고 보조 경계
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 신고 준비 진입과 이동 흐름
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 공통 컴포넌트와 반응형 규칙
- **Technical_Specs**: [Shared Filing UI Patterns Brief](../03_Technical_Specs/61_SHARED_FILING_UI_PATTERNS_BRIEF.md) - 구현 전 기술 계약
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-042 Slice D 실행 상태
- **QA_Validation**: [Runtime UI Trust Test Scenarios](../05_QA_Validation/11_RUNTIME_UI_TRUST_TEST_SCENARIOS.md) - 공통 패턴 검증 시나리오
