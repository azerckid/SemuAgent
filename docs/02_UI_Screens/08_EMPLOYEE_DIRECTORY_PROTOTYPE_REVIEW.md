# Employee Directory Prototype Review
> Created: 2026-07-02
> Last Updated: 2026-07-02

## 1. HTML UI Preview
- Preview: [HTML Preview](./previews/06_employee_directory.html)
- 확인 방식: 브라우저에서 HTML 파일 열람 / 로컬 정적 서버
- 확인 목적: 직원 명부 화면 구조, 사용자 동선, 상태별 UI, 개인정보 경계 커뮤니케이션

## 2. Prototype Link/Screenshot
- 정적 HTML Preview: `docs/02_UI_Screens/previews/06_employee_directory.html`
- 기존 6개 워크스페이스 프리뷰 사이드바에 "직원 명부" 링크를 추가하여 프리뷰 세트 안에서 상호 이동 확인.

## 3. Key User Flows
- 사이드바 "관리 > 직원 명부"로 진입한다.
- 직원 통계(재직·급여 대상·4대보험 확인 필요·퇴사)로 명부 현황을 파악한다.
- 검색·필터(재직 상태, 급여 대상)로 직원 목록을 좁힌다.
- 행별 "수정" 또는 상단 "직원 추가"로 추가/수정 패널을 연다.
- 추가/수정 시 급여 대상·내부 리마인드 수신을 토글로 관리한다.
- 연결 화면 카드로 급여대장·4대보험 고지액 매칭·내부 리마인드 수신자 연결 상태를 확인한다.

## 4. Screen States
- Default: 직원 1명 이상 — 통계, 검색/필터, 직원 표, 추가/수정 패널, 연결 화면 카드.
- Loading: 목록 스켈레톤.
- Empty: "등록된 직원이 없습니다" + "첫 직원 추가" CTA.
- Error: "직원 명부를 불러오지 못했습니다" + 다시 시도.
- Permission denied / unavailable: 미인증 시 `/sign-in` redirect, tenant 미소속 시 접근 안내(구현 시 처리).

## 5. Data Flow
- Inputs: 직원 추가/수정(이름·사번·부서·직책·재직상태·입사일·업무 이메일), 급여 대상·리마인드 수신 토글, 검색/필터.
- Displayed data: 직원 통계, 직원 목록(재직 상태·급여 대상·4대보험 확인·입사일·최근 급여·업무 이메일), 연결 화면 상태.
- Mutations / saved data: 직원 추가/수정, 재직 상태 변경, 급여 대상 여부 변경. 주민등록번호·계좌번호·전화번호 원문은 저장하지 않는다.
- Internal dependencies: `payroll_employee_line`(최근 급여), `payroll_insurance_notice_line`(4대보험 매칭 상태). 내부 리마인드(JC-016)는 후속.
- External dependencies: 없음. 외부 인사/노무/보험 포털 자동 연동은 v1 범위 밖.

## 6. User Confirmation
- 화면/UI 선확인 여부: 예
- HTML Preview 확인 여부: 예 (브라우저 확인)
- 확인자: azerckid
- 확인 일시: 2026-07-02
- 보완 필요 사항: 없음 (초기 승인)

## 7. Feedback & Improvements
- 진입 위치는 독립 메뉴 `/dashboard/employees`로 확정(설정 하위 아님).
- 이메일이 없는 직원은 내부 리마인드 수신자를 staff 계정으로 대체하는 방향을 Preview에 반영.
- 구현 전 확정 필요: `employee_profile` 물리 테이블 도입, 급여 line과 직원 마스터 연결 방식(자동 매칭 vs 사용자 확인).

## 8. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 셀프사용 제품 목적
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 화면 목록·내비게이션
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 4.8 직원 명부 컴포넌트
- **UI_Screens**: [HTML Preview](./previews/06_employee_directory.html) - 브라우저 확인용 화면 프로토타입
- **Technical_Specs**: [Employee Directory Pre-Code Brief](../03_Technical_Specs/10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) - 데이터 계약·구현 전제조건
- **QA_Validation**: [Employee Directory Test Scenarios](../05_QA_Validation/08_EMPLOYEE_DIRECTORY_TEST_SCENARIOS.md) - 구현 전 검증 기준
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-015 Context Lock
