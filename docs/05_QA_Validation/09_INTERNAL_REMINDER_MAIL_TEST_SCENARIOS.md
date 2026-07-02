# Internal Reminder Mail Test Scenarios
> Created: 2026-07-02 21:18
> Last Updated: 2026-07-02 21:18

## 1. Scope

이 문서는 JC-016 내부 리마인드 메일 구현 전 QA 계약이다. 리마인드는 회사 내부 사용자에게 업무 마감과 확인 필요 상태를 알리는 기능이며, 외부 고객 요청 메일이나 자동 신고/납부 기능이 아니다.

현재 단계는 문서 게이트다. UI Preview와 구현이 아직 없으므로 Result는 전부 Pending이다.

## 2. Scenario Matrix

| ID | Area | Scenario | Expected | Result |
|:---|:---|:---|:---|:---|
| S-01 | Structure | 리마인드 설정 화면에 접근한다. | 규칙 목록, 수신자 미리보기, 최근 발송 로그가 표시된다. | Pending |
| S-02 | Structure | 규칙이 없을 때 화면을 연다. | 빈 상태와 첫 리마인드 규칙 만들기 CTA가 표시된다. | Pending |
| S-03 | Structure | provider 설정이 없을 때 화면을 연다. | 테스트 발송 CTA가 비활성화되고 설정 안내가 표시된다. | Pending |
| S-04 | Structure | 로딩 중 화면을 연다. | 규칙/로그 스켈레톤이 표시된다. | Pending |
| S-10 | Domain | 자료수집 미수집 자료가 있다. | source_collection 리마인드 후보가 생성된다. | Pending |
| S-11 | Domain | 기장검토 미분류 거래가 있다. | bookkeeping_review 리마인드 후보가 생성된다. | Pending |
| S-12 | Domain | 부가세 공제 검토 대기가 있다. | vat 리마인드 후보가 생성된다. | Pending |
| S-13 | Domain | 급여 확인 필요 직원이 있다. | payroll 리마인드 후보가 생성된다. | Pending |
| S-14 | Domain | 신고지원 접수증 미보관 항목이 있다. | filing_support 리마인드 후보가 생성된다. | Pending |
| S-20 | Recipient | staff 수신자 규칙을 만든다. | tenant 소속 staff만 수신 후보가 된다. | Pending |
| S-21 | Recipient | employee_directory 수신자 규칙을 만든다. | notificationEnabled=true이고 workEmail이 있는 직원만 수신 후보가 된다. | Pending |
| S-22 | Recipient | 퇴사 직원을 수신자로 선택하려 한다. | 기본 후보에서 제외되거나 명시적 경고가 표시된다. | Pending |
| S-23 | Recipient | 다른 tenant 직원 이메일을 payload에 넣는다. | 서버가 세션 tenant scope로 차단한다. | Pending |
| S-24 | Recipient | 직접 이메일 override를 저장한다. | 원문 노출을 최소화하고 표시 라벨/해시 기준으로 기록한다. | Pending |
| S-30 | Rule | D-7 deadline_offset 규칙을 만든다. | offsetDays=7, enabled=true로 저장된다. | Pending |
| S-31 | Rule | daily_digest 규칙을 만든다. | 하루 1회 요약 발송 대상으로 계산된다. | Pending |
| S-32 | Rule | 규칙을 비활성화한다. | enabled=false 이후 예약 실행에서 제외된다. | Pending |
| S-33 | Rule | 허용되지 않은 domain 값을 보낸다. | validation 오류가 발생한다. | Pending |
| S-40 | Send | 테스트 발송을 실행한다. | 실제 상태 변경 없이 테스트 subject/body가 provider에 전달되고 로그가 남는다. | Pending |
| S-41 | Send | 즉시 발송을 실행한다. | 대상 수신자에게 발송하고 send log가 sent/failed로 남는다. | Pending |
| S-42 | Send | provider 오류가 발생한다. | 화면에 실패 상태와 재시도 안내가 표시되고 send log에 errorMessage가 남는다. | Pending |
| S-43 | Send | 같은 조건의 예약 job이 두 번 실행된다. | idempotencyKey로 두 번째 발송은 skipped 처리된다. | Pending |
| S-44 | Send | notification disabled 수신자가 포함된다. | 발송하지 않고 skipped 또는 후보 제외로 기록한다. | Pending |
| S-50 | Boundary | GIWA 고객 요청 메일 테이블을 import하는지 정적 검사한다. | `client_request_event`, `outbound_email`, `inbound_email`, `staff_mailbox`를 도메인 모델로 사용하지 않는다. | Pending |
| S-51 | Boundary | 외부 업로드 포털 초대 메일을 발송하려 한다. | JC-016 범위 밖으로 차단된다. | Pending |
| S-52 | Boundary | 홈택스 자동 제출/납부 메일 액션을 만들려 한다. | 자동 제출/납부는 제공하지 않는다. | Pending |
| S-53 | Boundary | 공동인증서 또는 외부 사이트 자격증명을 저장하려 한다. | 저장하지 않고 validation 또는 설계 범위 밖으로 처리한다. | Pending |
| S-60 | Privacy | 메일 본문에 주민등록번호/계좌번호 원문이 들어가는지 검사한다. | 민감정보 원문은 템플릿에 포함되지 않는다. | Pending |
| S-61 | Privacy | private storage key가 메일 본문에 들어가는지 검사한다. | storage key는 포함되지 않는다. | Pending |
| S-62 | Privacy | 직원 이메일이 없는 경우 발송한다. | 해당 수신자는 제외되고 누락 안내가 표시된다. | Pending |
| S-70 | State | read model이 실패한다. | error.tsx 또는 inline 오류 상태가 표시된다. | Pending |
| S-71 | State | 미인증 상태로 접근한다. | `/sign-in`으로 redirect된다. | Pending |
| S-72 | State | UI Preview와 구현 화면을 비교한다. | 승인된 preview의 레이아웃·색상·상태 구조와 일치한다. | Pending |
| S-73 | State | Resend/env가 설정되지 않았다. | provider missing 상태로 테스트/실발송이 잠긴다. | Pending |

## 3. Automation Plan

- `lib/internal-reminders/summary.test.ts`: domain별 후보 계산, 수신자 필터, idempotency key 파생 검증
- `lib/internal-reminders/send.test.ts`: provider 성공/실패, duplicate skip, disabled recipient skip 검증
- API route tests: 규칙 저장/비활성화, 테스트 발송, 즉시 발송 validation과 tenant scoping
- Static tests: GIWA request mail 테이블/컴포넌트 import 금지
- Browser QA: 승인된 HTML Preview와 실제 화면 캡처 대조

## 4. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 셀프사용·신고 보조 책임 경계
- **Technical_Specs**: [Internal Reminder Mail Pre-Code Brief](../03_Technical_Specs/11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) - 구현 전 계약
- **Technical_Specs**: [Employee Directory Pre-Code Brief](../03_Technical_Specs/10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) - 직원 명부 기반 수신자 source
- **Technical_Specs**: [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) - `internal_reminder_*` 논리 모델 초안
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-016 Context Lock
