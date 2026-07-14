# Runtime UI Trust Test Scenarios

> Created: 2026-07-14
> Related: JC-042 Slices A-C

## 1. 범위

정상 실서비스 화면에는 사용자의 현재 업무와 데이터만 표시한다. HTML Preview의 상태 데모와 내부 작업 용어가 런타임으로 새어 나오지 않는지 검증한다.

## 2. 시나리오

| # | Given | When | Then | Result |
|:---|:---|:---|:---|:---:|
| S-01 | 회사 홈·자료수집·기장검토·급여·리마인드 정상 데이터 | 각 화면 진입 | `화면 상태 예시`·`Preview 안내`·상태 데모 카드가 보이지 않는다 | PASS · unit |
| S-02 | 회사 홈 정상 데이터 | 상단 확인 | 데이터와 연결되지 않은 `확정 신고` 선택기가 보이지 않는다 | PASS · unit |
| S-03 | 연간신고 허브 | 화면 확인 | `신고 handoff`·`병렬 신고 트랙`·`JC-023` 대신 사용자 업무 문구를 표시한다 | PASS · unit |
| S-04 | 지급명세서 직접작성 값 | 화면 확인 | `JC-030`·`Path 1b` 없이 홈택스 직접작성 값으로 표시한다 | PASS · unit |
| S-05 | 리마인드·설정·요금제 | 화면 확인 | `internal staff`·`JC-015`·`v1`·`Billing`을 사용자에게 노출하지 않는다 | PASS · unit |
| S-10 | 실제 데이터 로딩·빈 상태·오류 | 해당 상태 발생 | 기존 loading/error/empty 경로가 상태를 표시한다 | PASS · existing routes |
| S-20 | Slice A 전후 | 정적 분석 | DB·API·세액 계산·migration 변경이 없다 | PASS · diff |
| S-30 | 데스크톱·모바일 | 핵심 화면 스크린샷 비교 | 제거된 블록 자리에 겹침·과도한 공백·가로 넘침이 없다 | PASS · Chrome |
| S-40 | 기존 회사 사용자가 로그인 | 인증과 회사 활성화 완료 | 다사업장 관리가 아니라 회사 홈으로 이동한다 | Pending · Slice C runtime |
| S-41 | 신규 사용자가 회사 등록 완료 | first-run sample 생성 결과와 무관하게 | 회사 홈으로 이동하고 기술 식별자 입력을 요구하지 않는다 | Pending · Slice C runtime |
| S-42 | 설정 정상 화면 | 탭과 표 확인 | 회사 정보·사용자 관리만 보이고 업무메일·사업장 배정 열이 없다 | PASS · Preview 16 |
| S-43 | 관리자 | 사용자 추가·권한·활성 상태 변경 | 기존 tenant 격리와 관리자 권한 검증을 유지한다 | Pending · Slice C runtime |
| S-44 | 오래된 설정 링크 `?tab=mail` 또는 `?tab=clients` | 화면 진입 | 오류 없이 회사 정보 탭으로 돌아온다 | Pending · Slice C runtime |

## 3. 자동화

- `test/runtime-ui-trust.test.ts`가 런타임 데모·정적 선택기·내부 용어 회귀를 막는다.
- 기존 화면별 정적 테스트는 승인된 업무 섹션 순서를 유지하되 Preview 전용 블록을 필수 항목으로 요구하지 않는다.
- Chrome 1440×1000에서 회사 홈·자료수집·기장검토·급여·리마인드·연간신고·지급명세서·설정·요금제 9개 화면을 확인했고, 390×844에서 회사 홈을 재확인했다. 모든 화면의 문서 가로 넘침은 0px였다.

## 4. Related Documents

- [Product Purpose UI Alignment Brief](../03_Technical_Specs/58_PRODUCT_PURPOSE_UI_ALIGNMENT_BRIEF.md)
- [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md)
- [UI Design](../02_UI_Screens/01_UI_DESIGN.md)
- [Backlog](../04_Logic_Progress/00_BACKLOG.md)
- [Company Direct-Use Shell Cleanup Brief](../03_Technical_Specs/60_COMPANY_DIRECT_SHELL_CLEANUP_BRIEF.md)
