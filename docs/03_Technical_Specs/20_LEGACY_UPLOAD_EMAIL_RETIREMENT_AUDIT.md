# Legacy Upload/Email Retirement Audit
> Created: 2026-07-05 14:30
> Last Updated: 2026-07-06 15:35 KST

## 0. Flow Status

```text
[Flow]
현재: JC-031 Slice 4-1 완료 — legacy mail dead code 제거
Gate: 통과
완료: Slice 1~3c, Slice 4-0~4-1
다음: Slice 4-2 upload_session 레거시 컬럼 retirement 준비
필요 확인: prod DB migration 0060 적용 여부
권장 스킬: rules-product -> rules-dev/rules-workflow per deletion slice
```

## 1. Purpose

JC-031은 JARYO-GIWA에서 가져온 `upload_session` / `outbound_email` 중심의 고객 요청·업로드·메일 서브시스템을
SemuAgent의 회사 직접사용 구조에 맞게 단계적으로 은퇴시키는 에픽이다.

이 감사의 결론은 명확하다.

1. `outbound_email` 기반 요청메일·mail-console·request-event 흐름은 SemuAgent v1의 핵심 경로가 아니다.
2. 그러나 `upload_session`은 아직 자료수집·기장·급여·리뷰 파이프라인의 **원천 lineage FK**로 넓게 남아 있어 즉시 삭제할 수 없다.
3. 따라서 JC-031은 **레거시 외부 포털/메일 요청 흐름 차단 및 삭제**와 **내부 source lineage 모델 대체**를 분리해야 한다.

## 2. Inventory Snapshot

2026-07-05 기준 `rg`로 확인한 범위다. 검색 범위·시점에 따라 수치는 변할 수 있으므로,
아래 숫자는 삭제 기준이 아니라 영향 범위의 크기를 보여주는 참고값으로만 사용한다.

| 영역 | 관찰 |
|---|---|
| `uploadSession` / `upload_session` | app/lib/docs/drizzle 전반에 넓게 참조. 앱 코드만 보아도 100개 이상 파일에 걸쳐 있음. |
| `outboundEmail` / `outbound_email` | request email, mail console, transaction-purpose request, send lock 등 메일 요청 계열에 남아 있음. |
| 레거시 후보 route/module | sessions, upload portal, emails, request-events, schedules, templates, mail-console, calendar 계열이 다수 남아 있음. |
| 현재 노출 UI | 메인 사이드바에는 `자료수집(/dashboard/direct-upload)`이 v1 기능으로 살아 있음. `sessions`, `reviews`, `emails`, `calendar` 일부 layout은 `/dashboard`로 redirect되어 직접 탐색이 차단됨. |

## 3. Route / Surface Audit

### 3.1 유지해야 하는 v1 표면

- `/dashboard/direct-upload` — 현재 SemuAgent의 자료수집 진입점. `upload_session`을 내부 자료 batch처럼 사용한다.
- `/api/staff-direct-upload`, `/api/upload/*` 일부 — 자료 업로드와 파일 처리 경로에 연결되어 있다.
- 기장·급여·부가세·신고지원·신고준비 화면 — `upload_session_id`를 원천 추적용으로 참조하는 파생 데이터가 있다.

### 3.2 은퇴 후보 표면

- `/upload/[token]` — 외부 고객용 업로드 포털. SemuAgent v1은 회사 내부 사용자가 직접 자료를 올리는 구조이므로 제품 방향과 맞지 않는다.
- `/dashboard/sessions/*` — JARYO-GIWA식 요청 세션 상세/검토 흐름. 레이아웃 redirect가 있으나 코드와 API가 남아 있다.
- `/dashboard/emails/*`, mail-console — 고객 자료 요청 메일 콘솔. SemuAgent의 현행 내부 리마인드/업무메일과 구분해야 한다.
- request-events / request-schedules / request-templates — 고객 자료 요청 일정/템플릿 계열.
- `/dashboard/calendar` — 세무 일정 허브가 신고 준비 허브로 재프레임된 뒤 주변부가 됐고, legacy request-event 상태와 섞여 있다.

## 4. Database Impact

`upload_session`은 다음 두 성격이 섞여 있다.

1. **레거시 고객 요청 세션**: 토큰, 외부 업로드 URL, 요청메일 원문, request_event 연결, 고객 제출 상태.
2. **현행 source lineage**: 업로드된 파일과 그 파일에서 파생된 기장·급여·리뷰 결과를 묶는 source batch 역할.

즉 `upload_session` 테이블명은 레거시지만, 현재 기능 일부는 이 테이블을 아직 필요로 한다. 바로 삭제하면 아래 계열이 깨질 수 있다.

- `upload_file`
- `request_item_validation`, `upload_item_declaration`
- bookkeeping classification/material attribution/journal/voucher 계열
- payroll extraction batch/row/employee line/rule profile application 계열
- adaptive structure model/run 계열 — **3c-5 결정:** provenance/audit용 `upload_session_id` 유지, Slice 4 allowlist
- transaction purpose request 계열

따라서 DB 은퇴 순서는 다음처럼 나눠야 한다.

1. 레거시 request/email 컬럼과 라우트 사용 중단
2. 내부 자료 batch 대체 모델 설계(`source_batch` 후보)
3. `upload_file`와 파생 도메인의 FK를 새 모델로 이관
4. 레거시 데이터 보존/삭제 정책 확정
5. 마지막에 `upload_session`·`outbound_email` 스키마 제거

## 5. Mail Impact

메일 경로는 두 계열로 분리한다.

### 유지

- `internal_reminder` / `internal_reminder_send` — JC-017/018에서 만든 현행 내부 리마인드. SemuAgent v1에 필요.
- 업무메일 설정/직원 업무 이메일 — 현행 직원 리마인드와 회사 내부 운영에 필요.

### 은퇴 후보

- `outbound_email` — 고객 자료 요청/누락 요청/완료 감사/transaction purpose request 발송 기록.
- `mail-console` — 고객 요청 메일 생성·발송 콘솔.
- request-event 기반 자동/예약 요청 메일.

주의: `transaction_purpose_request.sent_email_id -> outbound_email.id` FK는 Slice 2c(2026-07-05)에서 제거됐다. `outbound_email` 테이블 자체는 Slice 4까지 유지한다.

## 6. Retirement Plan

### Slice 0 — Audit / Context Lock (this PR)

- 영향 범위 문서화
- `upload_session` 즉시 삭제 금지 명시
- 은퇴 후보/유지 후보 분리
- 단계별 삭제 순서 정의

### Slice 1 — Route Quarantine

- 외부 고객 포털 `/upload/[token]`을 v1 제외로 확정한 뒤 route redirect 또는 gone 처리
- `/api/request-events`, `/api/request-schedules`, `/api/request-templates`, `/api/mail-console/*` 직접 호출 차단 정책 정리
- 이미 redirect된 화면(`sessions`, `emails`, `calendar`)은 삭제 가능성 검토 전 import 의존성 확인

### Slice 2 — Mail Retirement

- **Slice 2a (2026-07-05)**: 레거시 고객 요청메일 쓰기 API를 410 Gone으로 차단한다. 대상은 `request-events` 생성/발송, `request-schedules`·`request-templates` 쓰기, `mail-console` bulk send, 레거시 `/api/sessions` POST, `/api/sessions/draft`, completion thanks, missing-request approve/reject이다.
- `GET /api/sessions`, `GET /api/request-schedules`, `GET /api/request-templates`, direct-upload 공유 API, `work-emails`, internal reminder, transaction-purpose request는 유지한다.
- **Slice 2b 이후**: `lib/email/missing-request`, pipeline 내부 보충요청 초안 side effect, transaction purpose request의 `outbound_email` FK를 내부 self-use 방식으로 재설계하거나 제거한다. 상세 영향 감사는 [Legacy Mail Side-effect Audit](./21_LEGACY_MAIL_SIDE_EFFECT_AUDIT.md)에 고정한다.
- DB 스키마(`outbound_email`, request-event 계열)는 Slice 4 전까지 삭제하지 않는다.

### Slice 3 — Source Batch Replacement

- `upload_session`의 현행 source lineage 역할을 별도 모델로 분리
- 후보명: `source_batch` / `source_document_batch`
- `upload_file` 및 파생 도메인 FK를 새 모델로 전환
- 기존 자료수집(`/dashboard/direct-upload`)은 새 모델을 사용하게 이관
- 구현 순서는 [Source Batch Replacement Pre-Code Brief](./24_SOURCE_BATCH_REPLACEMENT_PRE_CODE_BRIEF.md)에 고정한다: 3a schema/backfill/dual-write → 3b read model switch → 3c downstream FK migration.
- Slice 3에서 `upload_session` 테이블을 삭제하지 않는다. 삭제/compatibility 제거는 Slice 4에서만 판단한다.

### Slice 4 — Schema Retirement

- FK 이관 완료 후 `outbound_email`, request-event 계열, legacy upload_session 컬럼 제거
- 마지막에 `upload_session` 테이블 제거 또는 compatibility view/alias 제거
- 각 slice마다 `tsc`, `lint`, `test`, `build` 통과 확인

JC-031의 최종 done 조건과 남은 slice 고정 규칙은 [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)에 따른다. 새 slice를 임의로 추가하지 않고, 새 발견 사항은 Slice 2c·3·4 중 하나로 분류하거나 completion contract를 먼저 갱신한다.

## 7. First Safe Deletion Candidate

첫 코드 PR은 DB를 건드리지 않는다. 다음 중 하나를 작은 단위로 선택한다.

1. 이미 layout redirect로 차단된 legacy dashboard surface의 dead page/component 삭제
2. 외부 포털 `/upload/[token]` v1 제외 승인 후 route를 410/redirect로 바꾸고, 관련 public portal 컴포넌트 제거
3. request-event/mail-console write API를 410으로 막고, `outbound_email` 신규 생성 경로를 현행 internal reminder와 분리

Slice 1~1c로 외부 포털 quarantine과 dead code 제거를 완료했다. Slice 2a는 3번을 가장 작은 안전 단위로 실행해,
레거시 고객 요청메일 쓰기 API를 닫되 DB·source lineage·direct-upload 공유 API는 건드리지 않는다.
Slice 2b-1~2b-5의 상세 완료 상태는 [Legacy Mail Side-effect Audit](./21_LEGACY_MAIL_SIDE_EFFECT_AUDIT.md)에 고정되어 있으며, 남은 마무리 기준은 [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)에 고정한다.

## 8. Non-goals

- 한 PR에서 `upload_session` 테이블 삭제
- 한 PR에서 `outbound_email`과 request-event 계열 전부 삭제
- 현재 자료수집(`/dashboard/direct-upload`) 중단
- 기장/급여/부가세/신고지원/신고준비 read model의 source lineage 손상

## 9. Related Documents

- **Concept_Design**: [Product Baseline — JARYO-GIWA Relationship](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- **Logic_Progress**: [Backlog JC-031](../04_Logic_Progress/00_BACKLOG.md)
- **Technical_Specs**: [Internal Reminder Cron Brief](./14_INTERNAL_REMINDER_CRON_PRE_CODE_BRIEF.md) — 레거시 cron 제거 선행
- **Technical_Specs**: [DB Schema](./03_DB_SCHEMA.md) — `upload_session`, `outbound_email`, 파생 FK 현황
- **Technical_Specs**: [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md) — JC-031 최종 done 조건과 남은 slice 고정
- **Technical_Specs**: [Slice 4 Schema Retirement Allowlist](./25_SLICE4_SCHEMA_RETIREMENT_ALLOWLIST.md) — `upload_session`/`outbound_email` 잔존 참조 분류·table rebuild 전략
- **Technical_Specs**: [Legacy Mail Side-effect Audit](./21_LEGACY_MAIL_SIDE_EFFECT_AUDIT.md) — Slice 2b 보충요청 초안 side effect·transaction-purpose FK 감사
