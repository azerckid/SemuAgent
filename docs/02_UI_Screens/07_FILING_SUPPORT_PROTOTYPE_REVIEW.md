# Filing Support Prototype Review
> Created: 2026-07-01 22:10
> Last Updated: 2026-07-01 22:20

## 1. HTML UI Preview
- Preview: [신고지원](./previews/05_filing_support.html)
- 확인 방식: 브라우저에서 HTML 파일 직접 열람. 사이드바 "신고지원" 또는 각 신고 항목의 "…열기"로 진입.
- 확인 목적: 신고 항목·패키지·입력 가이드·접수증 보관·사후 체크리스트의 화면 구조, 동선, 책임 경계

## 2. Prototype Link/Screenshot
- 정적 HTML Preview 파일 1종. 부가세·급여 화면과 연동/상호 링크.

## 3. Key User Flows
- 부가세·급여·4대보험 산출물 → 신고 항목으로 집결.
- 신고 항목별 패키지 확인/생성(부가세는 공제 검토 완료 전 잠금).
- 홈택스 입력 가이드로 단계별 값 확인 → 회사가 홈택스에서 직접 제출.
- 제출 후 받은 접수증 업로드·보관.
- 사후 체크리스트(납부·접수증 보관)로 마무리.

## 4. Screen States
- Default: 신고 항목·입력 가이드·접수증·체크리스트가 채워진 화면.
- Loading: 카드·표 스켈레톤.
- Empty: 신고할 항목 0건 시 "부가세·급여 먼저 확정" 안내.
- Error: 신고 항목 로드 실패 시 오류 + 다시 시도.
- Permission denied / unavailable: tenant 미소속·미인증 시 접근 차단(구현 단계에서 확정).

## 5. Data Flow
- Inputs: 부가세 확정 패키지, 급여 지급명세서, 4대보험 자료, 사용자 업로드 접수증.
- Displayed data: 신고 항목 상태(준비됨/대기/확인 필요), 홈택스 입력 가이드 값, 접수증 보관 목록, 사후 체크리스트.
- Mutations / saved data: 패키지 생성, 접수증 업로드·보관, 체크리스트 상태 갱신.
- Internal dependencies: 부가세(JC-011)·급여(JC-012) 산출물(선행 화면의 내부 데이터).
- External dependencies: 없음. **자동 홈택스 제출·자동 납부는 제공하지 않음** — 실제 제출/납부는 회사가 홈택스에서 직접 수행.

## 6. 책임 경계 (명시)
- 지원 범위: 첨부 패키지 생성 · 홈택스 단계별 입력 가이드 · 제출 접수증 보관 · 사후 체크리스트.
- 비지원: 신고서 자동 제출, 세금 자동 납부, 홈택스 자격증명 서버 저장.
- 이 경계는 화면 상단 배너·하단 안내·Preview 문구에 반복 노출한다.

## 7. User Confirmation
- 화면/UI 선확인 여부: 확인함
- HTML Preview 확인 여부: 확인함 (브라우저 열람, 책임 경계·항목 연동·접수증/체크리스트 확인)
- 확인자: 프로젝트 오너
- 확인 일시: 2026-07-01
- 보완 필요 사항: 없음 (책임 경계 명확, 승인).

## 8. Feedback & Improvements
- (반영) Data Flow 문구 정정: 부가세·급여 산출물은 외부 의존성이 아니라 내부 선행 산출물 → Internal dependencies로 분리, External dependencies는 "없음"으로 명시.

## 9. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 제품 목적, MVP 비범위(자동 제출 제외)
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 사용자 흐름 (4f. 신고지원)
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **UI_Screens**: [VAT Prototype Review](./05_VAT_PROTOTYPE_REVIEW.md) - 연동 화면(부가세)
- **UI_Screens**: [Payroll Prototype Review](./06_PAYROLL_PROTOTYPE_REVIEW.md) - 연동 화면(급여)
- **UI_Screens**: [HTML Preview](./previews/05_filing_support.html) - 브라우저 확인용 프로토타입
