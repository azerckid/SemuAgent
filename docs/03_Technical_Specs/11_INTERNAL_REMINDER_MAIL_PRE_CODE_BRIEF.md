# Internal Reminder Mail Pre-Code Technical Brief
> Created: 2026-07-02 21:18
> Last Updated: 2026-07-02 21:18

## 0. Governing Principle

JC-016 내부 리마인드 메일은 회사 내부 사용자에게 업무 마감과 누락 상태를 알려주는 기능이다. GIWA의 고객사 자료 요청 메일 흐름을 되살리는 기능이 아니다.

- 수신자는 회사 내부 staff 또는 JC-015 직원 명부의 직원이다.
- 외부 고객 포털, 고객사 요청 메일, 회계사무소 대행 흐름은 v1 범위에서 제외한다.
- 자동 홈택스 제출, 자동 납부, 외부 사이트 로그인, 공동인증서 저장은 제공하지 않는다.
- 기존 `request_template`, `client_request_schedule`, `client_request_event`, `outbound_email`, `inbound_email`, `staff_mailbox` 계열은 v1 리마인드 도메인 모델로 재사용하지 않는다.
- 메일 발송 인프라는 Resend 같은 저수준 provider helper를 재사용할 수 있으나, 도메인 의미는 `internal_reminder_*`로 분리한다.

## 1. Scope

JC-016은 다음 기능의 구현 전 계약이다.

1. 내부 리마인드 규칙 조회
2. 리마인드 규칙 생성/수정/비활성화
3. 자료수집·기장검토·부가세·급여·신고지원의 확인 필요 상태를 리마인드 대상으로 연결
4. 직원 명부 또는 staff 계정 기반 수신자 선택
5. 수동 발송과 테스트 발송
6. 마감 D-7/D-3/D-1 또는 일일 요약 같은 예약 발송
7. 발송 로그, 중복 방지, 실패 재시도 상태 기록
8. 로딩, 빈 상태, 오류 상태

이번 문서는 구현 착수용 최종 문서가 아니라, `JC-016`을 Backlog와 데이터 모델에 등록하는 1차 게이트다. UI Preview와 사용자 확인, 수신자 source 결정이 완료되어야 코드 구현으로 넘어간다.

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | 후보: `/dashboard/reminders` 또는 `/dashboard/settings/reminders` |
| 화면 성격 | 내부 운영 알림 설정·발송 로그 화면 |
| Read model | `lib/internal-reminders/summary.ts` 후보 |
| Persistence | 신규 `internal_reminder_rule`, `internal_reminder_send_log` 후보 |
| Mutation API | 규칙 저장, 테스트 발송, 즉시 발송, 규칙 비활성화 |
| Client UI | 규칙 목록, 수신자 미리보기, 발송 로그, 테스트 발송 버튼 |
| 책임 경계 | 외부 고객 요청 메일이 아니라 회사 내부 업무 알림 |

## 3. Data Contract Draft

```ts
type ReminderDomain =
  | 'source_collection'
  | 'bookkeeping_review'
  | 'vat'
  | 'payroll'
  | 'filing_support'

type ReminderTriggerType = 'deadline_offset' | 'daily_digest' | 'manual'
type ReminderRecipientSource = 'staff' | 'employee_directory' | 'mixed'
type ReminderSendStatus = 'queued' | 'sent' | 'failed' | 'skipped'

type InternalReminderSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  stats: {
    enabledRuleCount: number
    pendingAttentionCount: number
    failedSendCount: number
  }
  rules: Array<{
    id: string
    domain: ReminderDomain
    triggerType: ReminderTriggerType
    offsetDays: number | null
    enabled: boolean
    recipientSource: ReminderRecipientSource
    subjectPreview: string
    lastSentAt: string | null
    nextRunAt: string | null
  }>
  recentLogs: Array<{
    id: string
    ruleId: string | null
    domain: ReminderDomain
    recipientLabel: string
    status: ReminderSendStatus
    sentAt: string | null
    errorMessage: string | null
  }>
}
```

## 4. Reminder Domains

| Domain | 리마인드 조건 | 수신자 후보 |
|:---|:---|:---|
| `source_collection` | 미수집 자료, 파싱 오류, 정규화 확인 필요 | 담당 staff, 자료 담당 직원 |
| `bookkeeping_review` | 미분류 거래, 낮은 신뢰도, 계정 지정 필요 | 담당 staff |
| `vat` | 공제 검토 대기, 패키지 생성 잠금, 신고 마감 D-day | 대표/담당 staff |
| `payroll` | 직원 확인 필요, 고지액 매칭 실패, 급여 미마감 | 급여 담당 staff, 직원 명부 담당자 |
| `filing_support` | 접수증 미보관, 사후 체크리스트 미완료 | 대표/담당 staff |

## 5. Data Model Draft

### `internal_reminder_rule`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id` | tenant + businessEntity 범위 |
| `domain` | 리마인드 업무 영역 |
| `trigger_type` | `deadline_offset` / `daily_digest` / `manual` |
| `offset_days` | D-7/D-3/D-1 같은 마감 기준 |
| `enabled` | 활성 여부 |
| `recipient_source` | `staff` / `employee_directory` / `mixed` |
| `subject_template`, `body_template` | 템플릿. 개인정보 원문 삽입 금지 |
| `created_by_staff_id`, `updated_by_staff_id` | 감사 |
| `created_at`, `updated_at` | 감사·동기화 |

권장 인덱스: index(`tenant_id`, `client_id`, `domain`), index(`tenant_id`, `client_id`, `enabled`).

### `internal_reminder_recipient_override`

규칙별 예외 수신자를 저장한다. 기본 수신자는 staff/employee_profile에서 파생하고, 예외만 저장한다.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id`, `rule_id` | 범위와 규칙 연결 |
| `recipient_type` | `staff` / `employee` / `email` |
| `staff_id`, `employee_id` | 내부 수신자 연결 |
| `email_hash`, `email_label` | 직접 이메일 입력 시 원문 최소화 및 표시 라벨 |
| `enabled` | 예외 수신자 활성 여부 |
| `created_at`, `updated_at` | 감사·동기화 |

### `internal_reminder_send_log`

발송 결과와 중복 방지 상태를 저장한다.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id` | 범위 |
| `rule_id` | 규칙 연결. 수동 발송은 null 가능 |
| `domain`, `context_key` | 업무 영역과 중복 방지 대상 |
| `recipient_type`, `recipient_ref_id`, `recipient_label` | 수신자 표시와 감사 |
| `idempotency_key` | 같은 조건 중복 발송 방지 |
| `status` | `queued` / `sent` / `failed` / `skipped` |
| `provider_message_id` | Resend 등 provider 응답 |
| `error_message` | 실패 사유 |
| `queued_at`, `sent_at` | 발송 시각 |
| `created_at`, `updated_at` | 감사·동기화 |

권장 인덱스: unique(`tenant_id`, `client_id`, `idempotency_key`), index(`tenant_id`, `client_id`, `status`), index(`tenant_id`, `client_id`, `domain`).

## 6. Mutation and State

| 액션 | 허용 | API/모듈 |
|:---|:---:|:---|
| 규칙 추가/수정/비활성화 | O | `POST/PATCH /api/internal-reminders/rules` 후보 |
| 테스트 발송 | O | `POST /api/internal-reminders/rules/[ruleId]/test-send` 후보 |
| 즉시 발송 | O | `POST /api/internal-reminders/send-now` 후보 |
| 예약 실행 | O | cron 또는 수동 job endpoint 후보 |
| 외부 고객 요청 메일 발송 | X | GIWA request mail 흐름 v1 제외 |
| 자동 홈택스 제출/납부 | X | 신고지원 책임 경계 유지 |

## 7. UI State Coverage

| 상태 | 조건 | UI |
|:---|:---|:---|
| Default | 규칙 1개 이상 | 규칙 목록, 수신자 미리보기, 최근 발송 로그 |
| Loading | Server Component 지연 | 목록·로그 스켈레톤 |
| Empty | 규칙 없음 | "첫 리마인드 규칙 만들기" CTA |
| Error | read model 실패 | "리마인드 설정을 불러오지 못했습니다" + 다시 시도 |
| Provider missing | Resend/env 미설정 | 테스트 발송 비활성 + 설정 안내 |
| Permission denied | 미인증 또는 tenant 미소속 | `/sign-in` redirect 또는 접근 안내 |

## 8. Implementation Preconditions

- [ ] UI Preview 작성 및 사용자 확인
- [ ] 화면 진입 위치(`/dashboard/reminders` vs 설정 하위) 확정
- [ ] JC-015 직원 명부를 수신자 source로 사용할지, v1은 staff-only로 시작할지 결정
- [ ] 신규 `internal_reminder_*` 물리 테이블 여부 확정
- [ ] Resend 발송 환경변수와 테스트 발송 방식 확인
- [ ] 예약 실행 방식(cron/manual job)과 idempotency key 확정
- [x] QA 시나리오 작성 및 Backlog Context Lock 연결

## 9. Acceptance Criteria

1. 리마인드는 회사 내부 수신자에게만 발송된다.
2. 자료수집·기장검토·부가세·급여·신고지원의 확인 필요 상태가 리마인드 대상으로 연결된다.
3. 수신자는 staff 또는 직원 명부 기반으로 결정되며, notification disabled 대상은 제외된다.
4. 같은 조건의 예약 리마인드는 idempotency key로 중복 발송되지 않는다.
5. 발송 로그는 성공/실패/스킵 상태와 실패 사유를 남긴다.
6. 외부 고객 요청 메일, 외부 업로드 포털 초대, 자동 홈택스 제출/납부는 제공하지 않는다.
7. 로딩·빈·오류·provider missing 상태가 UI Preview와 구현에 포함된다.

## 10. Open Items

- v1에서 직원 명부 기반 수신까지 포함할지, staff-only로 먼저 출시할지 결정이 필요하다.
- 예약 실행을 Vercel Cron으로 할지, 내부 수동 실행으로 시작할지 결정이 필요하다.
- 이메일 템플릿 편집을 v1에 포함할지, 고정 템플릿으로 시작할지 결정이 필요하다.

## 11. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 셀프사용·신고 보조 책임 경계
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 기존 6개 워크스페이스 흐름
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 디자인 시스템과 상태 표현
- **Technical_Specs**: [DB Schema](./03_DB_SCHEMA.md) - 리마인드 논리 테이블 초안
- **Technical_Specs**: [Employee Directory Pre-Code Brief](./10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) - 직원 명부 기반 수신자 source
- **Technical_Specs**: [Filing Support Pre-Code Brief](./09_FILING_SUPPORT_PRE_CODE_BRIEF.md) - 신고지원 책임 경계
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-016 Context Lock
- **QA_Validation**: [Internal Reminder Mail Test Scenarios](../05_QA_Validation/09_INTERNAL_REMINDER_MAIL_TEST_SCENARIOS.md) - 구현 전 검증 기준
