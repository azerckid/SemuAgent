# Company Home Prototype Review
> Created: 2026-07-01 19:40
> Last Updated: 2026-07-01 19:40

## 1. HTML UI Preview
- Preview: [회사 홈](./previews/00_company_home.html)
- 확인 방식: 브라우저에서 HTML 파일 직접 열람 (외부 의존성 없는 정적 파일)
- 확인 목적: 첫 진입 대시보드의 화면 구조, 사용자 동선, 상태별 UI 커뮤니케이션

## 2. Prototype Link/Screenshot
- 정적 HTML Preview 파일 1종. 배포 URL/스크린샷은 사용자 확인 후 필요 시 첨부.

## 3. Key User Flows
- 로그인 → 회사 홈(대시보드) 첫 진입.
- "다음 할 일"에서 신고 전 blockers 확인 → 기장검토/자료수집/부가세로 이동.
- 준비 현황 카드로 워크스페이스별 상태 파악 → 클릭 이동.
- 상단 기간 선택으로 회계기간 컨텍스트 전환.

## 4. Screen States
- Default: 집계 데이터가 채워진 대시보드.
- Loading: 카드·표 스켈레톤.
- Empty: 자료 0건 시 "첫 자료 업로드" 안내.
- Error: "현황을 불러오지 못했습니다" + 다시 시도.
- Permission denied / unavailable: tenant 미소속·미인증 시 접근 차단(구현 단계에서 확정).

## 5. Data Flow
- Inputs: 선택된 tenant·회계기간, 미분류 거래 수, 미수집 자료, 공제 검토 수, 제출/영수증 레코드.
- Displayed data: 기간 진행률·마감 D-day, 다음 할 일 목록, 워크스페이스 집계 카드, 최근 제출·영수증 표.
- Mutations / saved data: 없음. 회사 홈은 읽기 전용. 기간 선택만 세션/URL 컨텍스트 갱신.
- External dependencies: 없음(내부 데이터). 외부 업로드 포털·외부 세무사 흐름은 v1 제외.

## 6. User Confirmation
- 화면/UI 선확인 여부: 확인함
- HTML Preview 확인 여부: 확인함 (브라우저 열람)
- 확인자: 프로젝트 오너
- 확인 일시: 2026-07-01
- 보완 필요 사항: 없음 (현 방향 승인). 다음 화면(자료수집)으로 진행.

## 7. Feedback & Improvements
- 회사 홈 방향 승인. 사이드바 "자료수집" 메뉴에서 자료수집 화면으로 이동 가능하도록 연결 요청 → 반영.

## 8. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 사용자
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 사용자 흐름
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **UI_Screens**: [HTML Preview](./previews/00_company_home.html) - 브라우저 확인용 프로토타입
