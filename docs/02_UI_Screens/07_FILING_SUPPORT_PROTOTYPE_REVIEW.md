# Filing Support Prototype Review
> Created: 2026-07-01 22:10
> Last Updated: 2026-07-11 KST

## 1. HTML UI Preview
- Preview: [신고지원](./previews/05_filing_support.html)
- 확인 방식: 브라우저에서 HTML 파일 직접 열람. 사이드바 "신고지원" 또는 각 신고 항목의 "…열기"로 진입.
- 확인 목적: 신고 항목·패키지·준비값 확인·접수증 보관·사후 체크리스트의 화면 구조, 동선, 책임 경계

## 2. Prototype Link/Screenshot
- 정적 HTML Preview 파일 1종. 부가세·급여 화면과 연동/상호 링크.

## 3. Key User Flows
- 부가세·급여·4대보험 산출물 → 신고 항목으로 집결.
- 신고 항목별 준비값과 패키지 상태 확인(부가세는 자료대조·공제검토·provenance 완료 전 잠금).
- 공식 비암호화 업로드 양식이 확인된 세목만 파일 생성 → 회사가 홈택스에서 직접 업로드·제출.
- 제출 후 받은 접수증 업로드·보관.
- 사후 체크리스트(납부·접수증 보관)로 마무리.

## 4. Screen States
- Default: 신고 항목·준비값 확인·접수증·체크리스트가 채워진 화면.
- Loading: 카드·표 스켈레톤.
- Empty: 신고할 항목 0건 시 "부가세·급여 먼저 확정" 안내.
- Error: 신고 항목 로드 실패 시 오류 + 다시 시도.
- Permission denied / unavailable: tenant 미소속·미인증 시 접근 차단(구현 단계에서 확정).

## 5. Data Flow
- Inputs: 부가세 확정 패키지, 급여 지급명세서, 4대보험 자료, 사용자 업로드 접수증.
- Displayed data: 신고 항목 상태(준비됨/대기/확인 필요), 신고 준비값 확인 값, 접수증 보관 목록, 사후 체크리스트.
- Mutations / saved data: 패키지 생성, 접수증 업로드·보관, 체크리스트 상태 갱신.
- Internal dependencies: 부가세(JC-011)·급여(JC-012) 산출물(선행 화면의 내부 데이터).
- External dependencies: Path 1a 파일 지원 세목은 홈택스·국세청의 공식 비암호화 업로드 양식과 직접 수용 경로가 필요하다. 양식이 없는 세목은 Path 1b(직접입력 정리) 대상으로 두며, **1b 값 정리 화면은 아직 구현하지 않았다**(현재 앱은 준비값·검증 패널만 표시). **자동 홈택스 제출·자동 납부는 제공하지 않음** — 실제 제출/납부는 회사가 직접 수행.

## 6. 책임 경계 (명시)
- 지원 범위: 신고 준비값 검증 · 공식 비암호화 업로드 양식이 확인된 세목의 파일 생성(Path 1a) · 양식이 없는 세목의 `항목 = 값` 직접입력 정리(Path 1b) · 제출 접수증 보관 · 사후 체크리스트.
- 비지원: 홈택스 메뉴·입력칸 위치 단계별 안내(1b는 값 정리 표시까지), 회계프로그램 변환파일 추정, 암호화 파일, 신고서 자동 제출, 세금 자동 납부, 홈택스 자격증명 서버 저장.
- 이 경계는 화면 상단 배너·하단 안내·Preview 문구에 반복 노출한다.

### 6.1 Current Contract Caveat (2026-07-11)

- 원천징수이행상황신고서는 공식 경로가 직접작성 또는 비밀번호 기반 회계프로그램
  변환파일로 확인되어 공식 비암호화 업로드 양식이 없으므로 **Path 1b(직접입력 정리)
  대상으로 결정**했다. 목표는 확정 A01 집계를 `항목 = 값`으로 보여주는 것이고 파일
  generator는 만들지 않는다. **1b 값 정리 화면은 아직 구현하지 않았다**(현재 앱은 검증 패널만 표시).
- 부가세는 현재 홈택스 회계프로그램 파일변환 메뉴와 일부 첨부서류 도구까지만
  확인했다. 최신 비암호화 수용 여부가 확인되기 전에는 부가세도 **Path 1b 대상**이고
  (1b 값 정리 화면 미구현), 1a 파일 생성 UI는 활성화하지 않는다. Stage A는 1a 승격용 선택 조사다.
- 어떤 세목도 `blocked`로 두지 않는다.
- Preview의 기존 화면 구조 승인은 유지하되, 파일 생성 가능 여부와 책임 경계 문구는
  최신 [Path 1 Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md)을 따른다.

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
- **Technical_Specs**: [Path 1 Form Fill Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md) - 세목별 1a(양식)/1b(직접입력 정리) 상태
- **Technical_Specs**: [VAT Stage A Audit](../03_Technical_Specs/43_JC030_VAT_NONENCRYPTED_UPLOAD_TEMPLATE_AUDIT.md) - 부가세 공개 근거와 외부 확인 항목
