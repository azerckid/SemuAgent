# Internal Reminder Mail Test Scenarios
> Created: 2026-07-02 21:18
> Last Updated: 2026-07-02

## 1. Scope

이 문서는 JC-016 내부 리마인드 메일 구현 전 QA 계약이다. 리마인드는 회사 내부 사용자에게 업무 마감과 확인 필요 상태를 알리는 기능이며, 외부 고객 요청 메일이나 자동 신고/납부 기능이 아니다.

구현 결과 표기: `PASS·단위`(`lib/internal-reminders/*.test.ts`) / `PASS·구현`(route·UI 정적 계약, tsc/lint/build 대상) / `PASS·브라우저`(로컬 Playwright 캡처 대조) / `N/A·후속`(v1에서 닫은 범위 밖).

## 2. Scenario Matrix

| ID | Area | Scenario | Expected | Result |
|:---|:---|:---|:---|:---|
| S-01 | Structure | 리마인드 설정 화면에 접근한다. | 규칙 목록, 수신자 미리보기, 최근 발송 로그가 표시된다. | PASS·구현 |
| S-02 | Structure | 규칙이 없을 때 화면을 연다. | 빈 상태와 첫 리마인드 규칙 만들기 CTA가 표시된다. | PASS·구현 |
| S-03 | Structure | provider 설정이 없을 때 화면을 연다. | 테스트 발송 CTA가 비활성화되고 설정 안내가 표시된다. | PASS·단위/구현 |
| S-04 | Structure | 로딩 중 화면을 연다. | 규칙/로그 스켈레톤이 표시된다. | PASS·구현 |
| S-10 | Domain | 자료수집 미수집 자료가 있다. | source_collection 리마인드 후보가 생성된다. | PASS·구현 |
| S-11 | Domain | 기장검토 미분류 거래가 있다. | bookkeeping_review 리마인드 후보가 생성된다. | PASS·구현 |
| S-12 | Domain | 부가세 공제 검토 대기가 있다. | vat 리마인드 후보가 생성된다. | PASS·단위/구현 |
| S-13 | Domain | 급여 확인 필요 직원이 있다. | payroll 리마인드 후보가 생성된다. | PASS·단위/구현 |
| S-14 | Domain | 신고지원 접수증 미보관 항목이 있다. | filing_support 리마인드 후보가 생성된다. | PASS·구현 |
| S-20 | Recipient | staff 수신자 규칙을 만든다. | tenant 소속 staff만 수신 후보가 된다. | PASS·단위 |
| S-21 | Recipient | employee_directory 수신자 규칙을 만든다. | notificationEnabled=true이고 workEmail이 있는 직원만 수신 후보가 된다. | N/A·후속 |
| S-22 | Recipient | 퇴사 직원을 수신자로 선택하려 한다. | 기본 후보에서 제외되거나 명시적 경고가 표시된다. | N/A·후속 |
| S-23 | Recipient | 다른 tenant 직원 이메일을 payload에 넣는다. | 서버가 세션 tenant scope로 차단한다. | PASS·구현 |
| S-24 | Recipient | 직접 이메일 override를 저장한다. | 원문 노출을 최소화하고 표시 라벨/해시 기준으로 기록한다. | N/A·후속 |
| S-30 | Rule | D-7/D-3/D-1 deadline_offset 기본 규칙을 만든다. | triggerLabel이 마감 D-7/D-3/D-1로 표시되고 enabled=true로 파생된다. | PASS·단위 |
| S-31 | Rule | daily_digest 규칙을 만든다. | 하루 1회 요약 발송 대상으로 계산된다. | PASS·단위 |
| S-32 | Rule | 규칙을 비활성화한다. | enabled=false 이후 실행에서 제외된다. | PASS·구현 |
| S-33 | Rule | 허용되지 않은 domain 값을 보낸다. | validation 오류가 발생한다. | N/A·후속 |
| S-40 | Send | 테스트 발송을 실행한다. | 실제 상태 변경 없이 테스트 subject/body가 provider에 전달되고 로그가 남는다. | PASS·구현 |
| S-41 | Send | 즉시 발송을 실행한다. | 대상 수신자에게 발송하고 send log가 sent/failed로 남는다. | PASS·구현 |
| S-42 | Send | provider 오류가 발생한다. | 화면에 실패 상태와 재시도 안내가 표시되고 send log에 errorMessage가 남는다. | PASS·구현 |
| S-43 | Send | 같은 조건의 수동 실행이 두 번 실행된다. | idempotencyKey로 두 번째 발송은 skipped 처리된다. | PASS·단위/구현 |
| S-44 | Send | notification disabled 수신자가 포함된다. | 발송하지 않고 후보 제외로 기록한다. | PASS·단위 |
| S-50 | Boundary | GIWA 고객 요청 메일 테이블을 import하는지 정적 검사한다. | `client_request_event`, `outbound_email`, `inbound_email`, `staff_mailbox`를 도메인 모델로 사용하지 않는다. | PASS·구현 |
| S-51 | Boundary | 외부 업로드 포털 초대 메일을 발송하려 한다. | JC-016 범위 밖으로 차단된다. | PASS·구현 |
| S-52 | Boundary | 홈택스 자동 제출/납부 메일 액션을 만들려 한다. | 자동 제출/납부는 제공하지 않는다. | PASS·구현 |
| S-53 | Boundary | 공동인증서 또는 외부 사이트 자격증명을 저장하려 한다. | 저장하지 않고 validation 또는 설계 범위 밖으로 처리한다. | PASS·구현 |
| S-60 | Privacy | 메일 본문에 주민등록번호/계좌번호 원문이 들어가는지 검사한다. | 민감정보 원문은 템플릿에 포함되지 않는다. | PASS·구현 |
| S-61 | Privacy | private storage key가 메일 본문에 들어가는지 검사한다. | storage key는 포함되지 않는다. | PASS·구현 |
| S-62 | Privacy | 직원 이메일이 없는 경우 발송한다. | 해당 수신자는 제외되고 누락 안내가 표시된다. | PASS·단위 |
| S-70 | State | read model이 실패한다. | error.tsx 또는 inline 오류 상태가 표시된다. | PASS·구현 |
| S-71 | State | 미인증 상태로 접근한다. | `/sign-in`으로 redirect된다. | PASS·구현 |
| S-72 | State | UI Preview와 구현 화면을 비교한다. | 승인된 preview의 레이아웃·색상·상태 구조와 일치한다. | PASS·브라우저 |
| S-73 | State | Resend/env가 설정되지 않았다. | provider missing 상태로 테스트/실발송이 잠긴다. | PASS·단위/구현 |

## 3. Automation Plan

- `lib/internal-reminders/summary.test.ts`: provider guard, 수신자 필터, 기본 규칙, 템플릿, 통계 검증
- `lib/internal-reminders/send.test.ts`: 메일 본문 책임 경계, context/idempotency key 검증
- Static tests: `app/(dashboard)/dashboard/reminders/_components/internal-reminders-workspace.test.ts`에서 Preview 섹션 순서, route/API wiring, GIWA request mail 테이블/컴포넌트 import 금지, provider missing 상태 검증
- Browser QA: 로컬 Playwright로 `/dashboard/reminders` full-page 캡처 대조 완료. 로컬 데이터 차이로 리마인드 대상 건수는 실제 집계값을 표시한다.

## 4. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 셀프사용·신고 보조 책임 경계
- **Technical_Specs**: [Internal Reminder Mail Pre-Code Brief](../03_Technical_Specs/11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) - 구현 전 계약
- **Technical_Specs**: [Employee Directory Pre-Code Brief](../03_Technical_Specs/10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) - 직원 명부 기반 수신자 source
- **Technical_Specs**: [DB Schema](../03_Technical_Specs/03_DB_SCHEMA.md) - `internal_reminder_*` 논리 모델 초안
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-016 Context Lock
