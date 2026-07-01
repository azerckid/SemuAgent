# Source Collection Prototype Review
> Created: 2026-07-01 19:50
> Last Updated: 2026-07-01 19:50

## 1. HTML UI Preview
- Preview: [자료수집](./previews/01_source_collection.html)
- 확인 방식: 브라우저에서 HTML 파일 직접 열람. 회사 홈에서 사이드바 "자료수집" 또는 "자료수집 열기"로 진입, 사이드바 "회사 홈"으로 복귀.
- 확인 목적: 회사 내부 자료 업로드·정규화 흐름의 화면 구조, 동선, 상태별 UI

## 2. Prototype Link/Screenshot
- 정적 HTML Preview 파일 1종. 회사 홈(`00_company_home.html`)과 상호 링크.

## 3. Key User Flows
- 회사 홈 → 자료수집 진입(사이드바/CTA).
- 파일 업로드(드롭존) → 파싱 → 자료유형 정규화.
- 수집 상태 표에서 진행/오류 확인, 파싱 오류 건 재시도.
- 미수집·확인 필요 항목에서 재업로드/정규화 확인으로 이동.
- 사이드바 "회사 홈"으로 대시보드 복귀.

## 4. Screen States
- Default: 수집 완결성 + 업로드 + 정규화 + 수집 상태 표가 채워진 화면.
- Loading: 카드·표 스켈레톤.
- Empty: 업로드 자료 0건 시 "첫 자료 업로드" 안내.
- Error: 파일 처리 실패 시 오류 + 다시 시도(파싱 오류 행은 표에서 danger 상태로 표시).
- Permission denied / unavailable: tenant 미소속·미인증 시 접근 차단(구현 단계에서 확정).

## 5. Data Flow
- Inputs: tenant·회계기간, 사용자 업로드 파일(XLSX/CSV/PDF/이미지/ZIP, ≤50MB).
- Displayed data: 수집 완결성(진행률·미수집 건수), 자료유형별 집계·상태, 수집(가져오기) 진행/상태, 미수집·확인 필요 목록.
- Mutations / saved data: 파일 업로드 저장, 파싱/정규화 큐 등록, 정규화 확정·재분류, 재시도. (회사 홈과 달리 읽기 전용 아님)
- External dependencies: 없음(회사 내부 업로드). 외부 고객 업로드 포털·외부 세무사 흐름은 v1 제외.

## 6. User Confirmation
- 화면/UI 선확인 여부: 확인함
- HTML Preview 확인 여부: 확인함 (브라우저 열람, 회사 홈 ↔ 자료수집 상호 이동 확인)
- 확인자: 프로젝트 오너
- 확인 일시: 2026-07-01
- 보완 필요 사항: 없음 (현 방향 승인).

## 7. Feedback & Improvements
- 자료수집 방향 승인. 후속: 01_UI_DESIGN.md에 자료수집 컴포넌트 반영, 00_BACKLOG.md Context Lock 보강.

## 8. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 사용자
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 사용자 흐름 (4b. 자료수집)
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **UI_Screens**: [Company Home Prototype Review](./02_COMPANY_HOME_PROTOTYPE_REVIEW.md) - 진입 화면(회사 홈)
- **UI_Screens**: [HTML Preview](./previews/01_source_collection.html) - 브라우저 확인용 프로토타입
