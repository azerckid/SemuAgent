# VAT Prototype Review
> Created: 2026-07-01 20:50
> Last Updated: 2026-07-01 20:50

## 1. HTML UI Preview
- Preview: [부가세](./previews/03_vat.html)
- 확인 방식: 브라우저에서 HTML 파일 직접 열람. 회사 홈 "부가세 열기"(다음 할 일) 또는 사이드바 "부가세"로 진입.
- 확인 목적: 부가세 세액 집계·매출 구분·매입세액 공제 검토·신고 패키지 흐름의 화면 구조, 동선, 상태별 UI

## 2. Prototype Link/Screenshot
- 정적 HTML Preview 파일 1종. 회사 홈·자료수집·기장검토와 상호 링크.

## 3. Key User Flows
- 기장검토 확정 전표 → 부가세 집계 반영.
- 회사 홈 → 부가세 진입(다음 할 일 CTA / 사이드바).
- 세액 요약(매출세액 − 매입세액 = 납부 예정세액)과 마감 D-day 확인.
- 매출 구분(과세/영세율/면세) 확인.
- 매입세액 공제 검토: 불공제 후보 확정/공제, 공통매입 안분 계산.
- 부속 명세 준비 상태 확인 → 검토 완료 후 신고 패키지 생성.

## 4. Screen States
- Default: 세액 요약·매출 구분·공제 검토·부속 명세·패키지 미리보기가 채워진 화면.
- Loading: 카드·표 스켈레톤.
- Empty: 집계할 매출·매입 자료 0건 시 "기장검토 먼저 확정" 안내.
- Error: 세액 집계 로드 실패 시 오류 + 다시 시도.
- Permission denied / unavailable: tenant 미소속·미인증 시 접근 차단(구현 단계에서 확정).

## 5. Data Flow
- Inputs: 기장검토 확정 전표(매출·매입), 증빙 유형, 공제/불공제 판정 근거.
- Displayed data: 매출세액·매입세액·납부(예정)세액, 과세/영세율/면세 구분, 공제 검토 표(공급가액·세액·판정·사유), 부속 명세 준비 상태, 신고 패키지 미리보기.
- Mutations / saved data: 공제/불공제 확정, 공통매입 안분 계산, 신고 패키지 생성. 검토 완료 전에는 세액이 "예정"이며 패키지 생성 잠금.
- External dependencies: 없음(내부 집계). 자동 홈택스 제출은 범위 밖(패키지 + 준비값 확인까지). 외부 세무사 검토 흐름은 v1 제외.

## 6. User Confirmation
- 화면/UI 선확인 여부: 확인함
- HTML Preview 확인 여부: 확인함 (브라우저 열람, 신고 패키지 생성 버튼 잠금 표현 확인)
- 확인자: 프로젝트 오너
- 확인 일시: 2026-07-01
- 보완 필요 사항: 없음 (잠금 버튼 수정 반영 후 승인).

## 7. Feedback & Improvements
- (반영) 신고 패키지 생성 버튼을 승인 전 잠금 상태로 표현: `is-disabled` + `disabled` + `aria-disabled="true"`, muted 스타일, 잠김 라벨.
- (구현 노트) disabled 버튼의 `title` 툴팁은 브라우저별로 표시가 일관되지 않는다. React 구현 시 비활성 버튼을 래퍼(예: span/tooltip 컴포넌트)로 감싸 잠금 사유를 접근성 있게 노출한다. → Component & Library Plan / JC-011 전제조건에 반영.

## 8. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 사용자
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 사용자 흐름 (4d. 부가세)
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **UI_Screens**: [Bookkeeping Review Prototype Review](./04_BOOKKEEPING_REVIEW_PROTOTYPE_REVIEW.md) - 선행 화면(기장검토)
- **UI_Screens**: [HTML Preview](./previews/03_vat.html) - 브라우저 확인용 프로토타입
