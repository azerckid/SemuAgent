# Internal Reminder Cron Pre-Code Technical Brief
> Created: 2026-07-04 18:10
> Last Updated: 2026-07-04 18:38

## 0. Governing Principle

JC-017은 JC-016 내부 리마인드(`internal_reminder_*`)를 **Vercel Cron으로 자동 예약 실행**하고, JARYO-GIWA 시절의 레거시 cron과 책임을 분리하는 작업이다.

- 발송 도메인 의미·수신자·멱등성은 JC-016에서 이미 확정됐다. JC-017은 "누가 매일 실행하는가"만 추가한다.
- 레거시 `uploadSession`/`outbound_email` 기반 cron 흐름을 되살리지 않는다. 신규 cron은 `internal_reminder_*`만 대상으로 한다.
- 자동 홈택스 제출·자동 납부·외부 로그인·자격증명 저장은 이 브리프 범위 밖이다(JC-023 원칙 유지).

## 1. Scope

포함한다.

1. 신규 cron 엔드포인트 `/api/cron/internal-reminder` — 전 테넌트 순회 → 활성 규칙별 due 판정 → 발송
2. 세션 없는 시스템 스코프 summary 로더 (cron은 userId가 없음)
3. `vercel.json`에서 레거시 cron 4개 예약 제거 + 신규 cron 1개 등록
4. due 판정·멱등성·테넌트 격리 테스트

제외한다(후속).

- 레거시 cron **라우트 코드 삭제** — 별도 chore PR (`reminder`·`retry-failed`·`stale-notify`·`auto-send-requests` 및 `uploadSession`/`outbound_email` 데드코드 연쇄)
- 직원 명부 기반 직원 수신자 연동 — JC-018
- 자동 홈택스 제출 — JC-023

## 2. Legacy Cron Disposition

| cron | 성격 | 데이터 소스 | JC-017 처분 |
|:---|:---|:---|:---|
| `reminder` | 레거시 | `uploadSession` + `outbound_email` | vercel.json에서 제거(신규로 교체) |
| `retry-failed` | 레거시 | `outbound_email` | vercel.json에서 제거 |
| `stale-notify` | 레거시 | `uploadSession` + `outbound_email` | vercel.json에서 제거 |
| `auto-send-requests` | 레거시 | `uploadSession` 요청 | vercel.json에서 제거 |
| `cleanup-send-locks` | 인프라 | `lib/locks/send-lock` | 유지 |
| `billing-renewals` | 현행(Toss 결제) | billing | 유지 |
| `internal-reminder` | **신규** | `internal_reminder_*` | 추가 |

레거시 4개는 v1에서 redirect 차단된 `uploadSession`/`outbound_email` 서브시스템에만 작용하므로 예약을 내려도 v1 기능 영향이 없다. 라우트 파일 삭제는 데드코드 연쇄 확인이 필요하여 후속 chore PR로 분리한다.

## 3. System-scope Summary Loader

현재 발송 경로는 세션 스코프다.

- `loadInternalReminderSummary({ tenantId, userId })` — `userId`로 `isSelf`("본인" 수신자)를 판정한다.
- `sendInternalReminderRule({ summary })` — 미리 로드된 summary에 의존한다.

cron은 세션이 없으므로 **테넌트 스코프 시스템 로더**를 신설한다.

- `loadInternalReminderSummaryForSystem({ tenantId, periodKey?, today? })` — 확정 명칭/시그니처. 본인(self) 판정 없이 staff 수신자만 해석한다. 직원 명부 수신은 JC-018 전까지 제외.
- 구현은 기존 `loadInternalReminderSummary({ tenantId, userId, periodKey?, today? })`의 공통 조회부를 private core 함수로 분리하고, 세션 스코프 public loader와 시스템 스코프 public loader가 같은 summary shape를 반환하게 한다.
- 발송 로직 `sendInternalReminderRule`은 그대로 재사용한다(summary shape 동일).
- `InternalReminderSendMode`에는 `cron`을 추가한다. 수동 즉시 발송(`manual`)과 예약 발송(`cron`)의 contextKey를 분리해 발송 로그에서 실행 경로를 구분한다.

## 4. Due Rule (D-day 판정) — 확정

cron은 매일 1회 실행되며(`0 0 * * *` 후보, KST 09:00 = UTC 00:00), 각 활성 규칙에 대해 오늘 발송 대상인지 판정한다.

| triggerType | 발송 조건 | 마감 출처 |
|:---|:---|:---|
| `daily_digest` | 확인 필요(`attentionCount > 0`)일 때만 1회. 0건이면 발송하지 않는다(0건 메일 스팸 방지) | 상태 요약(summary attention) |
| `deadline_offset` | **오늘 == (세무 마감일 − `offsetDays`)** 인 날에만 발송 | v1은 `vat` 도메인의 신고 마감일. 구현은 `CompanyHomePeriod.filingDeadline`을 사용하고, 세무 일정 기준은 `lib/tax-calendar.ts`의 VAT occurrence와 맞춘다. |
| `manual` | cron 대상 **제외**. `/api/internal-reminders/send-now` 버튼만 | - |

- 마감일이 없는(해당 없는) 도메인·기간의 `deadline_offset` 규칙은 skip한다.
- v1 기본 규칙 중 `deadline_offset` 대상은 `vat`만이다.
- `source_collection`, `bookkeeping_review`, `payroll`은 `daily_digest`, `filing_support`는 `manual`이 기본값이다. 해당 도메인에 저장된 `deadline_offset` 규칙이 있더라도 JC-017에서는 매핑 없음으로 skip한다.
- 원천세·지급명세서·지방소득세 등 신규 세목별 deadline mapping은 JC-024/027/030 트랙에서 추가한다.

## 5. Idempotency & Isolation

- **cron 레벨**: `acquireCronLock('internal_reminder', 'yyyy-MM-dd')` — 하루 1회 보장(기존 `lib/cron.ts` 패턴 재사용).
- **발송 레벨**: 기존 `internal_reminder_send_log` + contextKey 멱등성 재사용 — 같은 규칙·같은 컨텍스트 재발송 방지.
- **테넌트 격리**: 규칙 조회·발송은 `tenantId` 스코프로만 수행한다. 한 테넌트 실패가 다른 테넌트를 막지 않도록 테넌트 단위 try/catch.
- **provider missing**: Resend 미설정 시 `providerMissing`으로 graceful skip(기존 send 결과 규약 재사용).

## 6. Acceptance Criteria

- [ ] `/api/cron/internal-reminder`가 `verifyCronAuth` 통과 후에만 실행된다.
- [ ] 하루 중복 실행이 cron lock으로 차단된다.
- [ ] `daily_digest`는 확인 필요(attentionCount>0)일 때만, `deadline_offset`는 마감−offsetDays 당일에만, `manual`은 cron에서 발송되지 않는다.
- [ ] 세션 없이 테넌트 스코프로 활성 규칙을 조회·발송한다(userId 의존 제거).
- [ ] 예약 발송은 `cron` send mode/contextKey로 기록되어 `manual` 즉시 발송 로그와 구분된다.
- [ ] 한 테넌트 발송 실패가 다른 테넌트 발송을 막지 않는다.
- [ ] 기존 send_log 멱등성으로 같은 컨텍스트 재발송이 방지된다.
- [ ] `vercel.json`에서 레거시 cron 4개가 제거되고 신규 cron 1개가 등록된다.
- [ ] 레거시 라우트 코드 삭제는 이 PR 범위가 아니며 후속 chore로 남긴다.

## 7. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 self-use 세무 준비, 자동제출 제외 경계
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) 8번 항목 · [Internal Reminder Prototype Review](../02_UI_Screens/09_INTERNAL_REMINDER_PROTOTYPE_REVIEW.md) - 리마인드 화면·수신자·발송 로그
- **Technical_Specs**: [Internal Reminder Mail Pre-Code Brief](./11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) - JC-016 발송·규칙·멱등성 계약(선행)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-017 Context Lock
- **QA_Validation**: [Internal Reminder Mail Test Scenarios](../05_QA_Validation/09_INTERNAL_REMINDER_MAIL_TEST_SCENARIOS.md) - JC-016 검증 시나리오(cron due 판정 시나리오 추가 대상)
