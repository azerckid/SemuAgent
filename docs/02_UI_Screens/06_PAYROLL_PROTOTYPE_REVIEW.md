# Payroll Prototype Review
> Created: 2026-07-01 21:15
> Last Updated: 2026-07-02 14:21

## 1. HTML UI Preview
- Preview: [급여](./previews/04_payroll.html)
- 확인 방식: 브라우저에서 HTML 파일 직접 열람. 사이드바 "급여"로 진입, 월별 급여 기간 선택.
- 확인 목적: 급여대장·공제·명세서·마감 흐름의 화면 구조, 동선, 상태별 UI

## 2. Prototype Link/Screenshot
- 정적 HTML Preview 파일 1종. 회사 홈·자료수집·기장검토·부가세와 상호 링크.

## 3. Key User Flows
- 사이드바 → 급여 진입, 급여 기간(월) 선택.
- 급여 요약(지급·공제·실지급·마감상태) 확인.
- 확인 필요(오류/누락) 직원 처리 → 급여대장에서 개별 편집.
- 공제 상세(원천세·4대보험) 확인.
- 급여명세서·지급명세서 미리보기 → 급여 마감·확정.
- 원천징수 지급명세서는 신고지원 화면으로 전달.

## 4. Screen States
- Default: 급여 요약·급여대장·공제 상세·명세서가 채워진 화면.
- Loading: 카드·표 스켈레톤.
- Empty: 이 달 급여 입력 0건 시 "급여 자료 불러오기" 안내.
- Error: 급여 계산 로드 실패 시 오류 + 다시 시도.
- Permission denied / unavailable: tenant 미소속·미인증 시 접근 차단, 개인정보 마스킹(구현 단계에서 확정).

## 5. Data Flow
- Inputs: 직원별 급여 입력(기본급·수당), 4대보험 요율·취득 기준, 원천세 간이세액, 건강보험 EDI/사회보험 고지내역 업로드 또는 수동 입력.
- Displayed data: 지급총액·공제총액·실지급액·마감상태, 급여대장(직원별 지급/공제/실지급), 공제 상세, 명세서 미리보기.
- Mutations / saved data: 직원 급여 개별 편집, 확인 필요(오류/누락) 처리, 급여명세서·지급명세서 생성, 급여 마감·확정. 확인 필요 항목이 있으면 마감 불가.
- External dependencies: 건강보험 EDI/사회보험 고지내역은 최종 4대보험 공제액 근거로 사용한다. 단, 자동 로그인·자동 스크래핑·공동인증서 저장은 v1 제외이고 사용자가 받은 고지내역을 업로드/수동 입력한다. 원천징수 지급명세서는 신고지원 화면으로 전달. 외부 세무사 흐름은 v1 제외.
- 개인정보 주의: 급여·주민정보 등 민감정보를 다루므로 접근 권한·마스킹·감사로그는 구현 단계에서 확정한다.

## 6. User Confirmation
- 화면/UI 선확인 여부: 확인함
- HTML Preview 확인 여부: 확인함 (브라우저 열람, 급여 숫자 정합성·마감 버튼 잠금 확인)
- 확인자: 프로젝트 오너
- 확인 일시: 2026-07-01
- 보완 필요 사항: 없음 (금액 정합성·마감 잠금 수정 반영 후 승인).

## 7. Feedback & Improvements
- (반영) 급여 금액 정합성 오류 수정: 공제총액 5,840,000(=원천세 2,100,000+4대보험 3,740,000), 실지급 36,760,000(=지급 42,600,000−공제 5,840,000), 기본급 합계 41,300,000. 급여대장 5개 행·합계 모두 교차검증 통과.
- (반영) 급여 마감·확정 버튼을 잠금 처리(`is-disabled`+`disabled`+`aria-disabled`): 확인 필요 직원 1건 처리 전 마감 불가. React 구현 시 disabled 버튼 래퍼 툴팁 처리(부가세와 동일).
- (반영) 4대보험 최종 공제액은 건강보험 EDI/사회보험 고지내역을 업로드 또는 수동 입력해 직원별 매칭한 값을 우선한다. 계산값은 예비값/차이 확인용으로 둔다.

## 8. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적 및 사용자
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 사용자 흐름 (4e. 급여)
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **UI_Screens**: [VAT Prototype Review](./05_VAT_PROTOTYPE_REVIEW.md) - 선행 화면(부가세)
- **UI_Screens**: [HTML Preview](./previews/04_payroll.html) - 브라우저 확인용 프로토타입
- **Technical_Specs**: [Payroll Pre-Code Brief](../03_Technical_Specs/08_PAYROLL_PRE_CODE_BRIEF.md) - 구현 전 데이터·mutation 계약
- **QA_Validation**: [Payroll Test Scenarios](../05_QA_Validation/06_PAYROLL_TEST_SCENARIOS.md) - 구현 검증 시나리오
