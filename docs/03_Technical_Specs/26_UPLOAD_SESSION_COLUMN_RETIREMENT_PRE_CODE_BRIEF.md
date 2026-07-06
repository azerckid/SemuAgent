# JC-031 Slice 4-2 Upload Session Column Retirement Pre-Code Brief
> Created: 2026-07-06 19:26 KST
> Last Updated: 2026-07-06 19:26 KST

## 0. Flow Status

```text
[Flow]
현재: JC-031 Slice 4-2-0 준비 완료 — upload_session 컬럼 retirement 범위와 차단 조건 고정
Gate: Pre-Code Brief / docs-only / migration 미착수
완료: Slice 1~3c, Slice 4-0~4-1, Slice 4-2-0
다음: Slice 4-2a legacy session/request context surface 정리 결정 및 구현
필요 확인: prod DB migration 0060 적용 여부, /dashboard/sessions/new 및 request-event snapshot 유지 여부
권장 스킬: rules-product -> rules-dev/rules-workflow
```

## 1. Purpose

Slice 4-2의 원래 표현은 `upload_session` 레거시 portal/mail 컬럼 retirement였다. 감사 결과, 이 표현만으로는 위험하다. `upload_session`에는 이미 legacy portal/mail 쓰기 경로가 닫힌 필드도 있지만, SemuAgent v1의 direct-upload compatibility, AI/review context, session-scoped workflow가 아직 읽거나 쓰는 필드도 섞여 있다.

따라서 이 문서는 Slice 4-2에서 **지금 지울 수 있는 컬럼**과 **아직 지우면 안 되는 컬럼**을 분리하고, table rebuild migration 전에 닫아야 할 precondition을 고정한다.

결론: **Slice 4-2는 아직 table rebuild에 들어가면 안 된다.** 먼저 4-2a에서 legacy session/request context surface를 정리하거나 이관해, 삭제 대상 컬럼의 runtime read/write가 0건인지 증명해야 한다.

## 2. Current Evidence

감사 기준: PR #110 머지 후 main `7ebeb53` 기준, 2026-07-06.

### 2.1 Prod Data Snapshot

2026-07-06 19:26 KST prod DB snapshot:

| 항목 | row count |
|---|---:|
| `upload_session` | 2 |
| `source_batch` | 2 |
| `upload_session.request_event_id IS NOT NULL` | 0 |
| `request_email_subject/body/cc` 중 하나라도 존재 | 0 |
| `analysis_notes/session_evaluation/extracted_criteria/additional_criteria` 중 하나라도 존재 | 2 |
| `upload_url IS NOT NULL` | 0 |

이 snapshot은 참고용일 뿐이다. row count가 0이어도 runtime code가 계속 쓰거나 읽으면 컬럼 삭제는 금지다. 삭제 기준은 **prod row count 0 + runtime read/write 0 + migration rollback plan**이다.

### 2.2 Route Surface Finding

`app/(dashboard)/dashboard/sessions/layout.tsx`는 `/dashboard`로 redirect하므로 `/dashboard/sessions/new` UI는 도달 불가능하다. 그러나 `sessions/new/page.tsx`와 `SessionCreateForm`은 아직 남아 있고, request-event 생성/발송 snapshot(`emailSubjectSnapshot`, `emailBodySnapshot`, `ccEmailSnapshot`, `analysisCriteriaSnapshot`)을 호출하는 코드가 존재한다.

이 경로는 live UI가 아니므로 바로 사용자 기능으로 보지는 않지만, table rebuild 전에는 아래 중 하나로 결정해야 한다.

1. redirect leaf만 남기고 page/component/API residue를 삭제한다.
2. 필요한 context를 `source_batch` 또는 별도 internal review context로 이관한다.
3. compatibility로 유지하되 삭제 대상 컬럼에서 제외한다.

## 3. Column Retirement Classification

### 3.1 Do Not Remove In Slice 4-2

| 컬럼/그룹 | 현재 사용 | 판단 |
|---|---|---|
| `id`, `tenant_id`, `client_id`, `created_by_staff_id`, `accounting_period`, `bookkeeping_period_*`, `status`, `source`, `staff_direct_label`, `deleted_at`, `deleted_by_staff_id`, `created_at` | direct-upload compatibility, session-scoped workflow, hidden review/session surfaces | Slice 4-4/4-5 전까지 유지 |
| `token_hash`, `expires_at`, `last_accessed_at` | `lib/session.ts` `verifyToken`, `/api/upload/*` compatibility | `/upload/[token]` quarantine 이후에도 upload callback compatibility가 남아 있어 유지 |
| `upload_url` | `/dashboard/direct-upload`가 raw token 추출에 사용, `createDirectUploadSession`이 반환 | token/display flow 재설계 전 삭제 금지 |
| `request_kind`, `request_event_id` | payroll/general branch, upload submit, completion, clients/calendar/session APIs | request-event/session compatibility 정리 전 삭제 금지 |
| `analysis_notes`, `session_evaluation`, `extracted_criteria`, `additional_criteria` | AI evaluation, classification prompt, review context, adaptive eligibility | 별도 review context 이관 전 삭제 금지 |
| `request_email_subject`, `request_email_body`, `request_email_cc` | review/session UI, AI/default criteria input, direct upload synthetic snapshots | 4-2a에서 surface 정리 또는 이관 전 삭제 금지 |

### 3.2 Candidate After 4-2a

| 후보 | 조건 | 가능한 처리 |
|---|---|---|
| `request_email_subject`, `request_email_body`, `request_email_cc` | `/dashboard/sessions/new` residue, review/session display, AI/default criteria 사용처를 제거/이관하고 `rg` runtime 0 확인 | `upload_session` table rebuild로 제거 |
| `extracted_criteria`, `additional_criteria` | AI/review criteria context를 `client.analysis_notes` 또는 별도 internal review context로 대체하고 기존 row migration 정책 확정 | 제거 또는 유지 결정 |
| `analysis_notes`, `session_evaluation` | prod row 2건이 실제 보유. session detail/evaluation UX에서 더 이상 필요 없거나 이관 완료 | 제거 또는 compatibility 유지 |

### 3.3 Not A Column In `upload_session`

`request_email_greeting`과 `sender_phone`은 현재 `upload_session` 컬럼이 아니다. 이 값은 request-event snapshot/form residue에 속하므로 Slice 4-2 table rebuild 컬럼 목록에 포함하지 않는다.

## 4. Proposed 4-2 Sub-slices

| Sub-slice | 범위 | DB migration | 완료 조건 |
|---|---|---|---|
| **4-2-0** | 이 문서. 컬럼별 운명과 blocker 고정 | 없음 | 삭제 금지 컬럼/후보 컬럼 문서화, 기존 allowlist/backlog sync |
| **4-2a** | `sessions/new` 및 request-email/context residue 결정 | 없음 또는 코드 삭제만 | redirect-blocked UI residue 삭제 또는 context 이관 결정. `request_email_*` runtime read/write 감소 |
| **4-2b** | AI/review criteria context 이관 여부 결정 | 필요 시 additive migration | `analysis_notes`/criteria/sessionEvaluation을 유지할지 새 모델로 옮길지 확정 |
| **4-2c** | 실제 `upload_session` table rebuild | rebuild migration | 제거 대상 컬럼 runtime read/write 0, prod row migration plan, dev/prod `foreign_key_check` |

4-2a와 4-2b가 끝나기 전에는 4-2c를 시작하지 않는다.

## 5. Table Rebuild Gate

`upload_session` table rebuild PR은 다음 체크리스트를 모두 만족해야 한다.

- [ ] 삭제 대상 컬럼 목록이 이 문서에 반영되어 있다.
- [ ] `rg`로 각 컬럼의 runtime read/write 0건을 확인했다(test/migration/history 제외).
- [ ] prod DB에서 삭제 대상 컬럼의 row 상태를 확인했다.
- [ ] table rebuild SQL은 FK/index/default/enum-like check를 보존한다.
- [ ] dev DB 적용 후 row count와 `PRAGMA foreign_key_check`를 검증했다.
- [ ] prod DB 적용 순서가 코드 배포와 충돌하지 않도록 릴리스 창을 잡았다.
- [ ] rollback 또는 forward-fix 계획이 PR 설명에 포함되어 있다.

## 6. Non-goals

- 이 문서 PR에서 DB migration 생성 금지.
- 이 문서 PR에서 runtime code 변경 금지.
- direct-upload, `/api/upload/*`, 기장/급여/session-scoped workflow 중단 금지.
- prod row count만 근거로 컬럼 삭제 금지.
- `upload_session` 테이블 전체 삭제 금지. 전체 retirement는 Slice 4-5 범위다.

## 7. Acceptance Criteria

- [x] `upload_session` 컬럼별 retirement 분류가 문서화된다.
- [x] 즉시 table rebuild 금지 사유가 문서화된다.
- [x] 4-2가 4-2-0/4-2a/4-2b/4-2c로 쪼개지고, 각 완료 조건이 명확하다.
- [x] 기존 allowlist, completion contract, backlog가 새 브리프를 참조한다.
- [ ] 4-2a에서 legacy session/request context surface가 실제로 제거 또는 이관된다.
- [ ] 4-2c에서 삭제 대상 컬럼의 runtime read/write 0건이 증명된다.

## 8. Related Documents

- [Slice 4 Schema Retirement Allowlist](./25_SLICE4_SCHEMA_RETIREMENT_ALLOWLIST.md)
- [Source Batch Replacement Pre-Code Brief](./24_SOURCE_BATCH_REPLACEMENT_PRE_CODE_BRIEF.md)
- [Legacy Upload/Email Retirement Audit](./20_LEGACY_UPLOAD_EMAIL_RETIREMENT_AUDIT.md)
- [Legacy Mail Side-effect Audit](./21_LEGACY_MAIL_SIDE_EFFECT_AUDIT.md)
- [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Backlog JC-031](../04_Logic_Progress/00_BACKLOG.md)
