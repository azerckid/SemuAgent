# Internal Reminder Prototype Review
> Created: 2026-07-02
> Last Updated: 2026-07-02

## 1. HTML UI Preview
- Preview: [HTML Preview](./previews/07_internal_reminder.html)
- 확인 방식: 브라우저에서 HTML 파일 열람 / 로컬 정적 서버
- 확인 목적: 내부 리마인드 화면 구조, 규칙·수신자·발송 로그 흐름, 상태별 UI, 책임 경계 커뮤니케이션

## 2. Prototype Link/Screenshot
- 정적 HTML Preview: `docs/02_UI_Screens/previews/07_internal_reminder.html`
- 기존 7개 프리뷰(회사 홈~직원 명부) 사이드바에 "리마인드" 링크를 추가하여 프리뷰 세트 안에서 상호 이동 확인.

## 3. Key User Flows
- 사이드바 "관리 > 리마인드"로 진입한다.
- 통계(활성 규칙·리마인드 대상·발송 실패)로 현황을 파악한다.
- 업무 영역별 규칙(부가세 마감 D-7/D-3/D-1, 급여·자료수집 일일 요약, 신고지원 수동)을 활성 토글로 관리한다.
- "테스트 발송"으로 담당자 본인에게 시험 발송한다.
- 수신자 미리보기로 담당자 본인·내부 staff 수신 대상을 확인한다.
- 최근 발송 로그로 성공/실패/스킵과 실패 사유를 확인한다.

## 4. Screen States
- Default: 규칙 1개 이상 — 통계, 규칙 목록, 수신자 미리보기, 발송 로그.
- Loading: 목록·로그 스켈레톤.
- Empty: "리마인드 규칙이 없습니다" + "첫 리마인드 규칙 만들기" CTA.
- Error: "리마인드 설정을 불러오지 못했습니다" + 다시 시도.
- Provider missing: Resend/env 미설정 시 테스트 발송 비활성 + "발송 설정 안내".
- Permission denied / unavailable: 미인증 시 `/sign-in` redirect, tenant 미소속 시 접근 안내(구현 시 처리).

## 5. Data Flow
- Inputs: 규칙 생성/수정(영역·트리거·offsetDays·활성·수신자 source·제목/본문 템플릿), 테스트 발송, 즉시 발송.
- Displayed data: 통계, 규칙 목록, 수신자 미리보기(담당자 본인·내부 staff), 발송 로그(상태·사유·시각).
- Mutations / saved data: 규칙 저장/비활성화, 테스트/즉시 발송, 발송 로그 기록. 개인정보 원문은 템플릿·로그에 저장하지 않는다.
- Internal dependencies: 자료수집·기장검토·부가세·급여·신고지원의 확인 필요 상태. 수신자는 staff·`employee_profile`(후속)에서 파생.
- External dependencies: 메일 provider(Resend 등) 저수준 helper. 외부 고객 요청 메일·자동 홈택스 제출/납부는 범위 밖(없음).

## 6. User Confirmation
- 화면/UI 선확인 여부: 예
- HTML Preview 확인 여부: 예 (브라우저 확인)
- 확인자: azerckid
- 확인 일시: 2026-07-02
- 보완 필요 사항: 없음 (초기 승인)

## 7. Feedback & Improvements
- 리마인드의 실질 목적은 담당자가 세무 일정을 확인하고 늦지 않게 처리하도록 하는 자가 알림임을 반영.
- 진입 위치는 독립 메뉴 `/dashboard/reminders`로 확정.
- v1 수신자는 담당자 본인·내부 staff. 직원 명부(JC-015) 기반 직원 수신은 후속.
- 구현 전 확정 필요: `internal_reminder_*` 물리 테이블, Resend 발송 환경변수·테스트 방식, 예약 실행(cron/manual)과 idempotency key, 템플릿 편집 v1 포함 여부.

## 8. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 셀프사용·신고 보조 책임 경계
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 화면 목록·내비게이션
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 4.9 리마인드 컴포넌트
- **UI_Screens**: [HTML Preview](./previews/07_internal_reminder.html) - 브라우저 확인용 화면 프로토타입
- **Technical_Specs**: [Internal Reminder Mail Pre-Code Brief](../03_Technical_Specs/11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) - 데이터 계약·구현 전제조건
- **Technical_Specs**: [Employee Directory Pre-Code Brief](../03_Technical_Specs/10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) - 수신자 source(직원 명부)
- **QA_Validation**: [Internal Reminder Mail Test Scenarios](../05_QA_Validation/09_INTERNAL_REMINDER_MAIL_TEST_SCENARIOS.md) - 구현 전 검증 기준
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-016 Context Lock
