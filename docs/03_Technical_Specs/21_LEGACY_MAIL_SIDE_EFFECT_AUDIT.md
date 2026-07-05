# Legacy Mail Side-effect Audit
> Created: 2026-07-05 16:39
> Last Updated: 2026-07-05 17:38

## 0. Flow Status

```text
[Flow]
현재: JC-031 Slice 2b-3b 완료 — dashboard/emails mail-console read cleanup
Gate: 통과
완료: Slice 1~1c 외부 포털 quarantine, Slice 2a 레거시 요청메일 쓰기 API 410 차단, Slice 2b 영향 감사, Slice 2b-1 보충요청 초안 생성 side effect 제거, Slice 2b-2 transaction-purpose send quarantine, Slice 2b-3a hidden reviews approval queue read 제거, Slice 2b-3b dashboard/emails mail-console read 제거
다음: calendar/client outbound-email read 영향 분리 또는 transaction-purpose 내부 작업 재설계
필요 확인: transaction-purpose 확인 요청을 self-use 내부 작업으로 재설계할지 여부(후속)
권장 스킬: rules-product -> rules-dev/rules-workflow per deletion slice
```

## 1. Purpose

Slice 2a는 레거시 고객 요청메일을 새로 만들거나 보내는 주요 API 쓰기 경로를 410 Gone으로 닫았다.
그러나 `outbound_email` 신규 생성 가능성은 완전히 사라지지 않았다.

남은 위험은 두 종류다.

1. 평가/검토 파이프라인 내부에서 `missing_request` 초안을 자동 생성하는 side effect
2. 거래 용도 확인(`transaction_purpose_request`) 발송 시 `outbound_email`을 생성하고 `sent_email_id` FK로 묶는 경로

이 문서는 코드 삭제 전 남은 의존성을 분리하고, 다음 slice를 안전한 순서로 고정한다.

## 2. Non-goals

- `outbound_email` 테이블 삭제
- `upload_session` 테이블 삭제 또는 source lineage 변경
- direct-upload 자료수집 경로 변경
- 업무메일(`work-emails`) 또는 내부 리마인드(`internal_reminder_*`) 변경
- 거래 용도 확인 도메인의 모든 테이블 즉시 삭제

## 3. Remaining `missing_request` Side Effects

| 경로 | 현재 상태 | side effect | Slice 2b 판단 |
|---|---|---|---|
| `app/api/sessions/draft/route.ts` | Slice 2a에서 POST 410 처리됨 | 과거에는 `generateMissingRequestDraft` 직접 호출 | 이미 차단. 삭제 후보는 후속 dead-code 정리 |
| `lib/ai/run-session-evaluation.ts` | `needs_resubmission` 결과를 유지하되 draft 생성 없음 | 없음 | **Slice 2b-1 완료.** 평가 결과만 반환 |
| `app/api/sessions/[id]/material-attribution/start/route.ts` | 귀속기간 검토 후 ledger pipeline만 수행 | 없음 | **Slice 2b-1 완료.** 귀속기간/ledger pipeline은 유지 |
| `app/(dashboard)/dashboard/reviews/page.tsx` | `reviews/layout.tsx`가 `/dashboard`로 redirect되어 UI 도달 불가 | 없음 | **Slice 2b-1 완료.** 기간 gap draft backfill 제거. 페이지 자체는 후속 UI dead-code 정리 후보 |
| `app/(dashboard)/dashboard/reviews/_components/review-workspace-deferred-panels.tsx` | `reviews` 하위라 도달 불가 | 없음 | **Slice 2b-3a 완료.** `outbound_email`을 읽던 보충 요청 메일 큐 제거. 전표분개 preview만 유지 |
| `app/api/emails/missing-requests/route.ts` | 410 Gone | 없음 | **Slice 2b-1 완료.** 기존 draft 조회도 v1 범위 밖으로 차단 |
| `lib/upload-session-revision.ts` | 파일 revision 시 draft를 `rejected` 처리 | 남은 draft 상태 정리 | 생성 경로 제거 후 남은 기존 draft 처리 정책과 함께 단순화 가능 |
| `lib/sessions/criterion-review-service.ts` | 기준 검토 후 stale draft를 `rejected` 처리 | 남은 draft 상태 정리 | 생성 경로 제거 후 단순화 가능. 단, criterion review 자체는 기장검토 로직이라 보존 |

### Slice 2b-1 Acceptance

- [x] `generateMissingRequestDraft`가 런타임 파이프라인에서 호출되지 않는다.
- [x] `runSessionEvaluationPipeline`은 `needs_resubmission` 결과를 유지하되 메일 초안을 생성하지 않는다.
- [x] `material-attribution/start`는 귀속기간 검토와 ledger pipeline만 수행하고 메일 초안 side effect를 갖지 않는다.
- [x] `app/api/emails/missing-requests`는 신규 draft가 생기지 않는 상태와 정합하게 410 처리된다.
- [x] `direct-upload`, 기장검토, 급여, 신고준비 read model에는 영향이 없다.

## 4. Transaction-purpose `outbound_email` Dependency

거래 용도 확인은 `missing_request`와 다른 도메인이지만, 발송 경로가 여전히 `outbound_email`에 결합되어 있다.

| 경로 | 현재 상태 | `outbound_email` 결합 | 판단 |
|---|---|---|---|
| `app/api/sessions/[id]/transaction-purpose-requests/route.ts` | draft 생성. 발송 아님 | 없음 | send 차단 전까지는 낮은 위험. 다만 `/dashboard/sessions` 하위 UI가 redirect라 v1 핵심 경로 아님 |
| `app/api/transaction-purpose-requests/[id]/route.ts` | draft 조회/수정 | 없음 | send 차단 뒤 dead-code 정리 후보 |
| `app/api/transaction-purpose-requests/[id]/send/route.ts` | 410 Gone | 없음 | **Slice 2b-2 완료.** 담당자 승인 발송 경로 차단 |
| `lib/bookkeeping/transaction-purpose-service.ts` | draft 생성/수정/발송 서비스 | `sendPurposeRequest`만 `outbound_email` 생성 | runtime route 호출은 제거됨. 함수 자체는 서비스 테스트·후속 dead-code 정리 전까지 유지 |
| `bookkeeping_transaction_purpose_request.sent_email_id` | `outbound_email.id` FK | schema-level FK | Slice 4 전에는 삭제 금지. self-use 내부 작업 모델로 재설계 후 FK 제거 |
| `app/api/upload/purpose-request*` | Slice 1b에서 410 차단 | 고객 답변 포털 차단됨 | public answer 경로는 이미 닫힘 |

### Slice 2b-2 Acceptance

- [x] `POST /api/transaction-purpose-requests/[id]/send`가 410 Gone을 반환한다.
- [x] `sendPurposeRequest`가 더 이상 런타임 route에서 호출되지 않는다.
- [x] `bookkeeping_transaction_purpose_request` draft/row와 classification answer 적용 코드는 삭제하지 않는다.
- [x] `sent_email_id` FK는 스키마에서 유지한다. 제거는 Slice 4 또는 별도 migration gate에서만 한다.

## 5. Read Surfaces That Still Mention `outbound_email`

다음 표면은 read-only 또는 hidden UI 성격이다. 즉시 삭제보다 생성/발송 차단 후 정리하는 순서가 안전하다.

- `app/(dashboard)/dashboard/emails/*` — `emails/layout.tsx` redirect로 차단된 레거시 메일 화면. **Slice 2b-3b 완료.** `page.tsx`는 redirect leaf로 축소, page 전용 mail-console/read UI 제거. 설정 화면에서 재사용하는 업무메일 주소 관리 컴포넌트(`WorkEmailAddressesPanel`)와 현행 work-email API는 보존.
- `app/(dashboard)/dashboard/reviews/*` — `reviews/layout.tsx` redirect로 차단된 레거시 리뷰 화면. **Slice 2b-3a에서 missing-request draft read panel 제거 완료.** 남은 reviews 코드는 자료 검토 dead-code 정리 후보.
- `app/(dashboard)/dashboard/calendar/page.tsx` — 레거시 request-event/outbound-email 상태를 읽음. 신고 준비 허브로 대체된 주변부.
- `app/(dashboard)/dashboard/clients/page.tsx` — 사업장 목록에서 일부 outbound-email 상태를 읽음. business entity 유지 대상이라 삭제 전 별도 UI 영향 확인 필요.
- `lib/payroll/load-payroll-derived-status.ts` / `load-payroll-summary-by-event-id.ts` — payroll event의 이메일 상태를 파생 상태로 읽음. payroll live 경로와 섞일 수 있어 Slice 3~4 전까지 보수적으로 유지.

## 6. Recommended Order

1. **Slice 2b-1 — Missing-request side effect 제거 (완료, 2026-07-05)**
   - `run-session-evaluation`과 `material-attribution/start`에서 `generateMissingRequestDraft` 호출 제거
   - `app/api/emails/missing-requests`를 410 처리 또는 삭제
   - hidden reviews UI의 수동 초안 생성 호출은 dead-code 정리 후보로 표시
2. **Slice 2b-2 — Transaction-purpose send quarantine (완료, 2026-07-05)**
   - `/api/transaction-purpose-requests/[id]/send` 410 처리
   - `sendPurposeRequest` 런타임 호출 제거 확인
   - draft/row 및 classification answer 적용 로직은 유지
3. **Slice 2b-3 — Legacy mail UI/read cleanup**
   - **2b-3a 완료(2026-07-05):** hidden `reviews` deferred mail panel 제거. `ApprovalQueueSection`, approval queue formatter, approval email dedupe helper/test 삭제.
   - **2b-3b 완료(2026-07-05):** `dashboard/emails` page를 redirect leaf로 축소하고 page 전용 mail-console/read UI 제거. `outbound_email`/`request_template`/`inbound_email` read가 hidden route에서 사라짐.
   - **후속 분리:** calendar/client outbound-email read는 live UI 영향 확인 후 별도 slice로 제거.
4. **Slice 4 준비 — Schema retirement gate**
   - `outbound_email` FK 제거 migration은 source lineage 이관 및 transaction-purpose 재설계 후에만 수행

## 7. Verification Plan

각 코드 slice마다 다음을 확인한다.

- `rg "generateMissingRequestDraft" app lib` 결과가 의도한 dead-code 후보만 남는지 확인
- `rg "sendPurposeRequest" app lib` 결과가 route runtime에서 제거됐는지 확인
- `npx tsc --noEmit`
- `npm test -- --run`
- `npm run lint`
- build는 live dev server 충돌 가능성이 없을 때만 수행

## 8. Related Documents

- [Legacy Upload/Email Retirement Audit](./20_LEGACY_UPLOAD_EMAIL_RETIREMENT_AUDIT.md)
- [DB Schema](./03_DB_SCHEMA.md)
- [Bookkeeping Review Pre-Code Brief](./06_BOOKKEEPING_REVIEW_PRE_CODE_BRIEF.md)
- [Backlog JC-031](../04_Logic_Progress/00_BACKLOG.md)
