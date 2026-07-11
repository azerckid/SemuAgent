# Withholding Tax / Former Filing Support Prototype Review
> Created: 2026-07-01 22:10
> Last Updated: 2026-07-12 KST

## 1. HTML UI Preview
- Preview: [급여·지급 > 원천세](./previews/05_filing_support.html)
- 확인 방식: 브라우저에서 HTML 파일 직접 열람. 사이드바 `급여·지급 > 원천세`로 진입.
- 확인 목적: 홈택스 원천세 메뉴 경로·기본정보·A01 ④⑤⑥ 입력 위치표와 접수증 보관

## 2. Prototype Link/Screenshot
- 정적 HTML Preview 파일 1종. 부가세·급여 화면과 연동/상호 링크.

## 3. Key User Flows
- 확정 급여 산출물 → 원천세 준비값으로 집계.
- 홈택스 메뉴 경로를 확인하고 기본정보와 A01 ④⑤⑥ 위치에 확정값을 옮긴다.
- 지방소득세는 위택스 별도 신고값으로 확인한다.
- 제출 후 받은 접수증 업로드·보관.

## 4. Screen States
- Default: 홈택스 입력 위치표·입력 전 확인·위택스 별도 값·원천세 접수증이 채워진 화면.
- Loading: 카드·표 스켈레톤.
- Empty: 신고할 항목 0건 시 "부가세·급여 먼저 확정" 안내.
- Error: 신고 항목 로드 실패 시 오류 + 다시 시도.
- Permission denied / unavailable: tenant 미소속·미인증 시 접근 차단(구현 단계에서 확정).

## 5. Data Flow
- Inputs: 확정 급여·지급내역, 사용자 업로드 접수증.
- Displayed data: 홈택스 신고 경로·신고구분·귀속연월·지급연월·사업자·A01 ④⑤⑥, 위택스 지방소득세, 원천세 접수증.
- Mutations / saved data: 접수증 업로드·보관.
- Internal dependencies: 급여(JC-012) 산출물.
- External dependencies: Path 1a 파일 지원 세목은 홈택스·국세청의 공식 비암호화 업로드 양식과 직접 수용 경로가 필요하다. 원천세는 양식이 없어 Path 1b 입력 안내 화면을 구현했다. **자동 홈택스 입력·제출·납부는 제공하지 않음** — 실제 수행은 회사가 직접 한다.

## 6. 책임 경계 (명시)
- 지원 범위: 급여값 검증 · 홈택스 신고 경로·기본정보·A01 ④⑤⑥ 입력 위치표 · 위택스 지방소득세 분리 · 원천세 접수증 보관.
- 비지원: 화면 캡처 기반 클릭별 튜토리얼, 회계프로그램 변환파일 추정, 암호화 파일, 자동 입력·제출·납부, 홈택스 자격증명 서버 저장.
- 책임 경계는 입력표 하단에 한 번만 명확하게 표시한다.

### 6.1 Current Contract Caveat (2026-07-11)

- 2026-07-11 cadence IA 결정으로 `신고지원` 상위 메뉴는 폐기한다. 이 Preview는
  `급여·지급 > 원천세` 화면으로 재배치하며, 기존 부가세·4대보험 혼합 카드는 각
  도메인 화면으로 이동한다.
- 원천징수이행상황신고서는 공식 경로가 직접작성 또는 비밀번호 기반 회계프로그램
  변환파일로 확인되어 공식 비암호화 업로드 양식이 없으므로 **Path 1b(직접입력 정리)
  대상으로 결정**했다. 홈택스 신고 경로·기본정보·A01 ④⑤⑥ 위치와 live 값을 표시하는
  1b 입력 안내 화면을 구현했고 파일 generator는 만들지 않는다.
- 부가세는 현재 홈택스 회계프로그램 파일변환 메뉴와 일부 첨부서류 도구까지만
  확인했다. 최신 비암호화 수용 여부가 확인되기 전에는 부가세도 **Path 1b 대상**이고
  (1b 값 정리 화면 미구현), 1a 파일 생성 UI는 활성화하지 않는다. Stage A는 1a 승격용 선택 조사다.
- 어떤 세목도 `blocked`로 두지 않는다.
- 기존 신고지원의 다른 세목 패키지·중복 준비 단계·혼합 체크리스트 승인은 폐기한다.
  최신 화면과 책임 경계는 [Path 1 Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md)을 따른다.

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
- **UI_Screens**: [Cadence Navigation Prototype Review](./13_CADENCE_NAVIGATION_PROTOTYPE_REVIEW.md) - 역할 재배치 결정
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **UI_Screens**: [VAT Prototype Review](./05_VAT_PROTOTYPE_REVIEW.md) - 연동 화면(부가세)
- **UI_Screens**: [Payroll Prototype Review](./06_PAYROLL_PROTOTYPE_REVIEW.md) - 연동 화면(급여)
- **UI_Screens**: [HTML Preview](./previews/05_filing_support.html) - 브라우저 확인용 프로토타입
- **Technical_Specs**: [Path 1 Form Fill Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md) - 세목별 1a(양식)/1b(직접입력 정리) 상태
- **Technical_Specs**: [VAT Stage A Audit](../03_Technical_Specs/43_JC030_VAT_NONENCRYPTED_UPLOAD_TEMPLATE_AUDIT.md) - 부가세 공개 근거와 외부 확인 항목
