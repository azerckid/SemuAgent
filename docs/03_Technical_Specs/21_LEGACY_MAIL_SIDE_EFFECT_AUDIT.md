# Legacy Mail Side-effect Audit
> Created: 2026-07-05 16:39
> Last Updated: 2026-07-06 21:55 KST

## 0. Flow Status

```text
[Flow]
현재: JC-031 Slice 4-2b 완료 — criteria context 감사 및 compatibility retain 결정
Gate: 통과
완료: Slice 1~3c, Slice 4-0~4-2b, prod DB migration 0060 적용(2026-07-06)
다음: Slice 4-2c `upload_session` table rebuild 준비
필요 확인: 없음
권장 스킬: rules-product -> rules-dev/rules-workflow
```

## 1. Purpose

Slice 2a는 레거시 고객 요청메일을 새로 만들거나 보내는 주요 API 쓰기 경로를 410 Gone으로 닫았다.
Slice 2b 감사 시점에는 `outbound_email` 신규 생성 가능성이 일부 남아 있었고, 이후 slice에서 생성·발송·read side effect를 단계적으로 제거했다.

Slice 2b에서 분리한 위험은 두 종류였다.

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
| `lib/upload-session-revision.ts` | 파일 revision 시 request validation과 파생 run 상태만 재설정 | 없음 | **Slice 2b-4 완료.** `missing_request` draft reject side-effect 제거. 파일 수정/재업로드 후 재분석 흐름은 보존 |
| `lib/sessions/criterion-review-service.ts` | 기준 검토 후 validation/session 상태만 갱신 | 없음 | **Slice 2b-4 완료.** `missing_request` draft reject side-effect 제거. criterion review 자체는 기장검토 로직이라 보존 |

### Slice 2b-1 Acceptance

- [x] `generateMissingRequestDraft`가 런타임 파이프라인에서 호출되지 않는다.
- [x] `runSessionEvaluationPipeline`은 `needs_resubmission` 결과를 유지하되 메일 초안을 생성하지 않는다.
- [x] `material-attribution/start`는 귀속기간 검토와 ledger pipeline만 수행하고 메일 초안 side effect를 갖지 않는다.
- [x] `app/api/emails/missing-requests`는 신규 draft가 생기지 않는 상태와 정합하게 410 처리된다.
- [x] `direct-upload`, 기장검토, 급여, 신고준비 read model에는 영향이 없다.

## 4. Transaction-purpose `outbound_email` Dependency

거래 용도 확인은 `missing_request`와 다른 도메인이지만, 감사 당시 발송 경로가 `outbound_email`에 결합되어 있었다. Slice 2b-2에서 route를 410으로 닫고, Slice 2b-5에서 서비스 함수와 테스트 fixture까지 제거했다.

| 경로 | 현재 상태 | `outbound_email` 결합 | 판단 |
|---|---|---|---|
| `app/api/sessions/[id]/transaction-purpose-requests/route.ts` | draft 생성. 발송 아님 | 없음 | send 차단 전까지는 낮은 위험. 다만 `/dashboard/sessions` 하위 UI가 redirect라 v1 핵심 경로 아님 |
| `app/api/transaction-purpose-requests/[id]/route.ts` | draft 조회/수정 | 없음 | send 차단 뒤 dead-code 정리 후보 |
| `app/api/transaction-purpose-requests/[id]/send/route.ts` | 410 Gone | 없음 | **Slice 2b-2 완료.** 담당자 승인 발송 경로 차단 |
| `lib/bookkeeping/transaction-purpose-service.ts` | **Slice 2c 완료.** 파일 삭제. draft 생성/조회/수정 런타임 없음 | 없음 | classification answer attach/apply만 유지 |
| `bookkeeping_transaction_purpose_request.sent_email_id` | ~~`outbound_email.id` FK~~ | **Slice 2c 완료.** 컬럼 제거(migration 0060) |
| `app/api/upload/purpose-request*` | Slice 1b에서 410 차단 | 고객 답변 포털 차단됨 | public answer 경로는 이미 닫힘 |

### Slice 2b-2 Acceptance

- [x] `POST /api/transaction-purpose-requests/[id]/send`가 410 Gone을 반환한다.
- [x] `sendPurposeRequest`가 더 이상 런타임 route에서 호출되지 않는다.
- [x] `bookkeeping_transaction_purpose_request` draft/row와 classification answer 적용 코드는 삭제하지 않는다.
- [x] `sent_email_id` FK는 스키마에서 유지한다. 제거는 Slice 4 또는 별도 migration gate에서만 한다.

### Slice 2b-5 Acceptance

- [x] `sendPurposeRequest` 서비스 함수와 Resend/outbound_email insert 경로가 제거된다.
- [x] transaction-purpose draft 생성·수정·조회와 classification answer 적용 코드는 보존한다.
- [x] `sent_email_id` FK/schema는 유지한다. 제거는 source lineage·transaction-purpose 재설계 이후 별도 migration gate에서만 한다.
- [x] send 전용 테스트·mock fixture를 제거하고 남은 draft/update 회귀 테스트가 통과한다.

## 5. Read Surfaces That Still Mention `outbound_email`

다음 표면은 read-only 또는 hidden UI 성격이다. 즉시 삭제보다 생성/발송 차단 후 정리하는 순서가 안전하다.

- `app/(dashboard)/dashboard/emails/*` — `emails/layout.tsx` redirect로 차단된 레거시 메일 화면. **Slice 2b-3b 완료.** `page.tsx`는 redirect leaf로 축소, page 전용 mail-console/read UI 제거. 설정 화면에서 재사용하는 업무메일 주소 관리 컴포넌트(`WorkEmailAddressesPanel`)와 현행 work-email API는 보존.
- `app/(dashboard)/dashboard/reviews/*` — `reviews/layout.tsx` redirect로 차단된 레거시 리뷰 화면. **Slice 2b-3a에서 missing-request draft read panel 제거 완료.** 남은 reviews 코드는 자료 검토 dead-code 정리 후보.
- `app/(dashboard)/dashboard/calendar/page.tsx` — **Slice 2b-3c 완료.** `outbound_email` read 제거. 일정 상태는 `client_request_event` + `upload_session` 기준으로만 계산한다.
- `app/(dashboard)/dashboard/clients/page.tsx` — **Slice 2b-3c 완료.** 사업장 목록의 `outbound_email` read 제거. 검토 신호는 request item validation, 파일 상태, event/session 상태 기준으로만 계산한다.
- `lib/payroll/load-payroll-derived-status.ts` / `load-payroll-summary-by-event-id.ts` — **Slice 2b-3d 완료.** 런타임 호출처가 없는 payroll event dead loader였음을 확인하고 제거. 급여 popup 컴포넌트는 DB schema 타입을 직접 참조하도록 변경해 `outbound_email` read 의존을 끊음.
- `app/(dashboard)/dashboard/clients/[id]/events/[eventId]/page.tsx` / `events/new/page.tsx` — **Slice 2b-3e 완료.** `clients/[id]/events/layout.tsx`가 이미 `/dashboard/clients`로 redirect하는 GIWA 요청 이벤트 서브트리였음을 확인. 상세/생성 page를 redirect leaf로 축소하고 전용 컴포넌트 3개(`delete-button`, `send-button`, `event-create-form`)를 삭제해 `outbound_email` read와 요청메일 발송 UI를 제거.

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
   - **2b-3c 완료(2026-07-05):** calendar/client outbound-email read 제거. 메일 발송 실패/초안 승인 대기 기반 상태를 event/session/validation/file 기반 상태로 대체.
   - **2b-3d 완료(2026-07-05):** 런타임 호출처 없는 payroll event loader 2개(`load-payroll-derived-status`, `load-payroll-summary-by-event-id`)와 전용 테스트 제거. 급여 popup 타입 import는 DB schema 타입으로 변경.
   - **2b-3e 완료(2026-07-05):** `clients/[id]/events` 하위는 JC-004 redirect-blocked 레거시 요청 이벤트 서브트리임을 정정. 상세/생성 page를 redirect leaf로 축소하고 요청메일 발송/발송기록/생성 폼 전용 컴포넌트 삭제.
4. **Slice 2b-4 — Stale missing-request cleanup side-effect 제거 (완료, 2026-07-05)**
   - `lib/upload-session-revision.ts`에서 파일 revision 시 `outbound_email` draft를 `rejected` 처리하던 side-effect 제거
   - `lib/sessions/criterion-review-service.ts`에서 기준 검토 후 stale `missing_request` draft를 `rejected` 처리하던 side-effect 제거
   - 자료 재업로드/파일 삭제/기준 검토의 현행 upload/session/validation 상태 갱신은 유지
5. **Slice 2b-5 — Transaction-purpose send dead-code 제거 (완료, 2026-07-05)**
   - `lib/bookkeeping/transaction-purpose-service.ts`에서 런타임 호출처 없는 `sendPurposeRequest` 제거
   - send 전용 Resend mock/outbound_email fixture/test 제거
   - draft 생성·수정·조회, public answer/apply, `sent_email_id` schema는 유지
6. **Slice 2c — Transaction-purpose internal task/FK decision (완료, 2026-07-05)**
   - **결정:** `bookkeeping_transaction_purpose_request` 테이블은 **과거 용도 확인 기록 + 분류 확정 연동**으로 유지한다. 신규 고객 메일 draft/발송/포털 답변 워크플로는 SemuAgent v1에서 제거한다.
   - `sent_email_id -> outbound_email.id` FK 컬럼을 migration `0060`으로 제거한다.
   - `POST /api/sessions/[id]/transaction-purpose-requests`, `GET/PATCH /api/transaction-purpose-requests/[id]`를 410 처리한다(발송 route는 2b-2에서 이미 410).
   - `transaction-purpose-service`, `transaction-purpose-public-service`, `transaction-purpose-template` 및 전용 UI/dead-code를 삭제한다.
   - **유지:** `attachPurposeAnswersToClassificationRows`, `classification-service`의 `purposeRequestRowId` 확정 연동, 기존 row/answer 데이터.
7. **Slice 4 준비 — Schema retirement gate**
   - `outbound_email` FK 제거 migration은 source lineage 이관 및 transaction-purpose 재설계 후에만 수행

JC-031의 최종 done 조건과 남은 slice 고정 규칙은 [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)에 따른다. Slice 3의 구현 순서와 데이터 계약은 [Source Batch Replacement Pre-Code Brief](./24_SOURCE_BATCH_REPLACEMENT_PRE_CODE_BRIEF.md)에 고정한다. 새 legacy mail 발견 사항은 Slice 2c·3·4 중 하나로 분류하거나 completion contract를 먼저 갱신한다.

### Slice 2c Acceptance

- [x] `bookkeeping_transaction_purpose_request.sent_email_id` 컬럼/FK가 제거되었다.
- [x] purpose request draft 생성·조회·수정 API가 410 Gone을 반환한다.
- [x] `outbound_email` insert를 수행하는 transaction-purpose 런타임 코드가 없다.
- [x] 분류 답변 attach/apply 경로(`transaction-purpose-classification-answers`, `classification-service`)는 유지된다.
- [x] tsc/lint/test가 통과한다.

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
- [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Upload Session Column Retirement Pre-Code Brief](./26_UPLOAD_SESSION_COLUMN_RETIREMENT_PRE_CODE_BRIEF.md)
- [Backlog JC-031](../04_Logic_Progress/00_BACKLOG.md)
