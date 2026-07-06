# JC-031 Slice 4 Schema Retirement Allowlist
> Created: 2026-07-06 15:25 KST
> Last Updated: 2026-07-06 22:50 KST

## 0. Flow Status

```text
[Flow]
현재: JC-031 의도적 보류(paused) — Slice 4-2c micro까지 완료, 에픽 미완료(todo)
Gate: 통과
완료: Slice 1~3c, Slice 4-0~4-2c micro, prod DB 0060·0065(2026-07-06)
다음: 재개 시 4-3+ 또는 optional 4-2b-impl — 필수 아님
필요 확인: 없음
권장 스킬: rules-product -> rules-dev/rules-workflow
```

## 1. Purpose

Slice 3는 SemuAgent 내부 source lineage를 `source_batch`로 분리하고 downstream additive FK(0062~0064)를 완료했다. Slice 4는 **남은 `upload_session`·`outbound_email` 의존을 분류**하고, SQLite/Turso 제약 하에서 **schema retirement**를 단계적으로 수행한다.

이 문서는 Slice 4의 **allowlist 단일 진실원**이다. `rg` 결과와 불일치하면 이 문서를 먼저 갱신한다.

## 2. Audit Method

감사 일시: 2026-07-06 (PR #110 Slice 4-1 브랜치 기준)

```bash
rg -l 'upload_session|uploadSession' --glob '*.{ts,tsx}'
rg -l 'outbound_email|outboundEmail' --glob '*.{ts,tsx}'
rg -l 'upload_session|outbound_email' --glob 'drizzle/*.sql'
```

| 패턴 | TS/TSX 파일 수 | SQL migration 파일 수 |
|---|---:|---:|
| `upload_session\|uploadSession` | 116 | 29 |
| `outbound_email\|outboundEmail` | 10 (런타임 3, 테스트 7) | 5 |

테스트 파일(`.test.ts`, `.e2e.test.ts`)은 allowlist **T — test/fixture**로 일괄 분류한다. Slice 4에서 런타임을 제거할 때 테스트 fixture를 함께 정리한다.

## 3. Allowlist Categories

각 참조는 아래 카테고리 중 하나에만 속해야 한다. **retire 시점**은 Slice 4 sub-slice 제안(§7)을 따른다.

| ID | 카테고리 | 설명 | retire 시점 |
|---|---|---|---|
| **A** | `source_batch` compatibility dual-write | `upload_session` row와 `source_batch.legacy_upload_session_id` 병행 생성·조회 | 4-4 이후 `upload_session` table rebuild 직전까지 유지 |
| **B** | Source lineage read (3b 완료) | `lib/source-batch/scope.ts` 기반 read model | `source_batch` only read로 전환 후 `upload_session_id` bridge 제거(4-4) |
| **C** | Session-scoped workflow API | `/api/sessions/*`, session id로 payroll/review/bookkeeping 파이프라인 실행 | URL·라우트를 `source_batch` 중심으로 재설계하거나 session id를 compatibility alias로 유지(4-4~4-5) |
| **D** | Downstream dual-write (3c 완료) | bookkeeping/payroll/validation 테이블에 `upload_session_id` + `source_batch_id` 동시 기록 | `upload_session_id` 컬럼 table rebuild로 제거(4-4) |
| **E** | Adaptive provenance/audit (3c-5) | `adaptive_structure_model.source_upload_session_id`, `adaptive_structure_model_run.upload_session_id` | **유지 또는 4-5에서 provenance 정리.** 범용 lineage FK 이관 대상 아님 |
| **F** | Legacy request-event / mail | `client_request_event`, `outbound_email`, portal/mail 컬럼 | 4-3 schema retirement |
| **G** | Audit / history / retention | `audit_proof`, client 삭제 cascade, historical row | retention 정책 확정 후 4-5 |
| **H** | Dead code (no runtime caller) | import/call chain 없음 | **4-1 즉시 제거 후보** |
| **I** | Schema / migration history | `lib/db/schema.ts`, `drizzle/*.sql` | 코드 제거 후 migration archive; 삭제 아님 |
| **T** | Test / fixture | `*.test.ts`, mock, seed helper | 런타임 제거 PR과 함께 |

## 4. Schema FK Inventory (`upload_session`)

### 4.1 `source_batch_id` + `upload_session_id` 동시 보유 (Slice 3c 완료 → 4-4 rebuild 대상)

| 테이블 | upload_session FK | source_batch FK | Slice 3 상태 |
|---|---|---|---|
| `upload_file` | `upload_session_id` NOT NULL | `source_batch_id` nullable | 3a dual-write |
| `request_item_validation` | NOT NULL | nullable | 3c-2 + 0062 |
| `upload_item_declaration` | NOT NULL | nullable | 3c-2 + 0062 |
| `bookkeeping_material_attribution` | NOT NULL | nullable | 3c-3 + 0063 |
| `bookkeeping_ledger_material_link` | NOT NULL | nullable | 3c-3 + 0063 |
| `bookkeeping_classification_run` | NOT NULL | nullable | 3c-3 + 0063 |
| `bookkeeping_transaction_classification` | NOT NULL | nullable | 3c-3 + 0063 |
| `bookkeeping_journal_entry_run` | NOT NULL | nullable | 3c-3 + 0063 |
| `bookkeeping_journal_entry_row` | NOT NULL | nullable | 3c-3 + 0063 |
| `bookkeeping_journal_entry_voucher` | NOT NULL | nullable | 3c-3 + 0063 |
| `payroll_rule_profile_application` | NOT NULL | nullable | 3c-4a + 0064 |
| `payroll_extraction_batch` | NOT NULL | nullable | 3c-4a + 0064 |
| `payroll_extraction_row` | NOT NULL | nullable | 3c-4a + 0064 |
| `payroll_excel_draft` | NOT NULL | nullable | 3c-4a + 0064 |

4-4 rebuild 시 각 테이블에서 `upload_session_id` 컬럼·인덱스·FK를 제거한다. **먼저** 모든 write path가 `source_batch_id`만 사용하는지 확인한다.

### 4.2 `upload_session_id` only (별도 전략)

| 테이블/컬럼 | 의미 | 카테고리 | retire 시점 |
|---|---|---|---|
| `bookkeeping_ledger_month.last_upload_session_id` | 월별 마지막 세션 스냅샷 | C/D | 4-4: `last_source_batch_id` 등으로 대체 후 rebuild |
| `bookkeeping_transaction_purpose_request.upload_session_id` | 용도 확인 요청 lineage | C | 4-4 또는 유지(기록 목적) |
| `payroll_employee_line.upload_session_id` | nullable legacy pointer | C | 4-4: `source_row_id` 체인으로 대체 |
| `payroll_employee_line.source_batch_id` | **`payroll_extraction_batch.id` FK** (범용 아님) | C | rename은 4-5; Slice 3c-4에서 범용 이관 제외 확정 |
| `adaptive_structure_model.source_upload_session_id` | 모델 provenance | **E** | 4-5 allowlist 유지 또는 provenance 컬럼 정리 |
| `adaptive_structure_model_run.upload_session_id` | 적용 audit | **E** | 동일 |
| `client_request_event.upload_session_id` | 레거시 요청 이벤트 | **F** | 4-3 |
| `outbound_email.upload_session_id` | 레거시 발송 기록 | **F** | 4-3 |
| `audit_proof.upload_session_id` | 수신 증명 이력 | **G** | retention 후 4-5 |

### 4.3 `upload_session` 테이블 자체 컬럼

| 컬럼 그룹 | 예시 | 카테고리 | retire 시점 |
|---|---|---|---|
| 내부 lineage | `tenant_id`, `client_id`, `accounting_period`, `source`, `staff_direct_label` | A/C | `source_batch`가 primary가 된 뒤 4-5. `source`·`staff_direct_label`은 direct-upload/review UI에서 아직 사용 |
| 토큰/업로드 compatibility | `token_hash`, `upload_url`, `expires_at`, `last_accessed_at` | C/F | 4-2 즉시 제거 금지. `verifyToken`, `/api/upload/*`, direct-upload raw token 표시 흐름이 남아 있음 |
| request-event/session branch | `request_event_id`, `request_kind` | C/F | payroll/general 분기와 session completion/read surface가 남아 있어 4-2 즉시 제거 금지 |
| request email snapshot | `request_email_subject`, `request_email_body` | F/C | subject/body는 4-2b-impl 후 DROP 후보; **`request_email_cc`는 4-2c micro(0065)로 제거** |
| 분석/검토 JSON | `analysis_notes`, `session_evaluation`, `extracted_criteria`, `additional_criteria` | C/G | AI/review context 사용처 이관 확인 후 제거 또는 compatibility 유지 결정 |

## 5. Runtime File Allowlist (`upload_session`)

### A — compatibility dual-write

| 경로 | 역할 |
|---|---|
| `lib/services/session-service.ts` | `createDirectUploadSession`: `upload_session` + `source_batch` 동시 INSERT |
| `app/api/staff-direct-upload/route.ts` | direct-upload 세션 생성 API |
| `app/api/upload/route.ts`, `app/api/upload/submit/route.ts` | 파일 업로드 callback, session/file 연결 |
| `lib/source-batch/scope.ts` | `legacy_upload_session_id` bridge, `sourceBatchIdForLegacyUploadSession` |
| `lib/first-run-sample/seed.ts`, `lib/first-run-sample/cleanup.ts` | 샘플 `source_batch` + session dual-write |

### B — source lineage read (3b)

| 경로 | 역할 |
|---|---|
| `lib/source-collection/summary.ts` | 자료수집 집계 |
| `lib/company-home/summary.ts` | 회사 홈 KPI |
| `lib/business-status-report/summary.ts` | 사업현황 보고 |
| `lib/bookkeeping-review/summary.ts` | 기장 검토 집계 |
| `lib/bookkeeping/fiscal-year-ledger.ts` | 회계연도 원장 read |
| `lib/bookkeeping/fiscal-year-ledger-accepted-materials.ts` | 수락 자료 read |

### C — session-scoped workflow

| 경로 그룹 | 역할 |
|---|---|
| `app/api/sessions/**` | 세션 CRUD, 평가, payroll extract/download, 파일 다운로드 |
| `lib/reviews/load-review-session-by-id.ts`, `build-review-sessions.ts`, `load-review-derived-status.ts` | 리뷰 workspace |
| `lib/bookkeeping/classification-service.ts`, `journal-entry-service.ts`, `period-attribution-service.ts`, `classification-run-lifecycle.ts` | 기장 파이프라인 (dual-write) |
| `lib/services/payroll-extraction-service.ts` | 급여 추출 (dual-write) |
| `lib/ai/process.ts`, `session-eval.ts`, `analyze.ts`, `run-session-evaluation.ts` | AI 평가·분석 |
| `lib/sessions/*` | criterion review, complete-session, blob-cleanup, upload-file-review |
| `app/(dashboard)/dashboard/direct-upload/**` | 자료수집 UI (session id 노출) |
| `app/(dashboard)/dashboard/sessions/[id]/**` | 세션 상세·분류·분개 UI |
| `lib/upload-session-revision.ts`, `lib/upload/file-password.ts` | 세션/파일 유틸 |
| `lib/tax-calendar-status.ts`, `app/(dashboard)/dashboard/calendar/page.tsx` | 캘린더 (session 참조 잔존) |
| `app/(dashboard)/dashboard/clients/page.tsx` | 클라이언트 목록 session 집계 |

### D — downstream dual-write (3c, write path)

3c에서 `source_batch_id` dual-write가 들어간 서비스는 §4.1 표와 동일. read prefer `source_batch_id` 전환은 Slice 4-4 이전 별도 micro-slice로 허용.

### E — adaptive provenance (3c-5 allowlist)

| 경로 | 역할 |
|---|---|
| `lib/payroll/adaptive-structuring-registry.ts`, `adaptive-structuring-apply.ts` | payroll adaptive 모델 provenance/run audit |
| `lib/reviews/adaptive-structuring-registry.ts`, `adaptive-structuring-apply.ts` | review/bookkeeping adaptive 동일 패턴 |
| `lib/payroll/adaptive-structuring-eligibility-context.ts` | eligibility context (session id 전달) |
| `lib/reviews/adaptive-structuring-eligibility-context.ts` | 동일 |

### F — legacy request-event / mail

| 경로 | 역할 | 비고 |
|---|---|---|
| `app/api/request-events/[id]/route.ts` | request-event 조회 | write API는 Slice 2a에서 410 |
| `lib/completion.ts` | `checkAndCompleteSession` — 세션 완료 판정 | C — `app/api/sessions/[id]/matches/[matchId]/route.ts`에서 호출 |

### G — audit / cascade delete

| 경로 | 역할 |
|---|---|
| `lib/services/proof-service.ts` | `audit_proof` 기록 |
| `app/api/clients/[id]/route.ts` | 클라이언트 삭제 시 session/file/outbound_email/audit_proof cascade |

### H — dead code (Slice 4-1 완료)

| 경로 | 근거 |
|---|---|
| ~~`lib/services/session-service.ts` → `createSessionAndSend`~~ | Slice 4-1 제거 |
| ~~`lib/email/missing-request.ts`~~ | Slice 4-1 제거 |
| ~~`lib/email/period-gap-missing-request.ts`~~ | Slice 4-1 제거 |
| ~~`lib/sessions/missing-request-targets.ts`~~ | Slice 4-1 제거 |
| ~~`lib/validations/session.ts`~~ | Slice 4-1 제거 |

4-1 이후 `rg generateMissingRequestDraft|createSessionAndSend` 런타임 0건.

### I — schema / migration

- `lib/db/schema.ts`
- `drizzle/0000`~`0064` 중 `upload_session`/`outbound_email` 참조 migration 29+5건

## 6. `outbound_email` Allowlist

| 경로 | 카테고리 | retire 시점 |
|---|---|---|
| `lib/db/schema.ts` | I | 4-3 |
| `app/api/clients/[id]/route.ts` (cascade delete) | G | 4-3 후 cascade 로직 제거 |
| `app/api/transaction-purpose-requests/[id]/send/route.ts` | F | 이미 410 (Slice 2b-2) |
| `*.test.ts` (7건) | T | 런타임 제거 시 정리 |

**런타임 신규 `outbound_email` INSERT 경로는 없음** (Slice 2a~2c 이후). 남은 참조는 schema·410 route comment·cascade delete·테스트다.

## 7. Table Rebuild Strategy (SQLite/Turso)

SQLite/Turso는 FK가 걸린 컬럼을 안전하게 `DROP COLUMN`하기 어렵다. Slice 3c 교훈대로 **additive migration만** 했고, **subtractive 변경은 table rebuild**로 한다.

### 7.1 Rebuild 패턴

```sql
-- 예시 패턴 (실제 migration PR에서 테이블별 맞춤)
CREATE TABLE <table>_new (...);  -- upload_session_id 제외, source_batch_id NOT NULL 등
INSERT INTO <table>_new SELECT ... FROM <table>;
DROP TABLE <table>;
ALTER TABLE <table>_new RENAME TO <table>;
-- 인덱스·FK 재생성
```

### 7.2 권장 순서

```text
Phase 1 (4-1)    Dead code 제거 — DB 변경 없음
Phase 2 (4-2-0)  upload_session 컬럼 retirement brief — DB 변경 없음
Phase 3 (4-2a/b) legacy session/request context surface 정리·이관 — 필요 시 코드/문서 변경
Phase 4 (4-2c)   upload_session 레거시 컬럼 제거 — 조건 충족 후 table rebuild
Phase 5 (4-3)    outbound_email·request-event 계열 table drop (runtime 0 확인 후)
Phase 6 (4-4)    Downstream upload_session_id 제거 — §4.1 leaf → root 순
                 권장: journal row/voucher → run → classification → material/link
                 → validation/declaration → payroll extraction → upload_file
Phase 7 (4-5)    upload_session table retirement 또는 compatibility view
                 adaptive_structure_* · audit_proof retention 정책 반영
```

### 7.3 Guardrails

| Risk | Guardrail |
|---|---|
| direct-upload 중단 | Phase 4에서 `upload_file` rebuild 전 `createDirectUploadSession`·upload callback smoke |
| read model 불일치 | Phase 4 각 테이블마다 `source_batch_id` backfill 100% 확인 |
| payroll employee line 혼동 | `payroll_employee_line.source_batch_id`는 extraction batch FK; 범용 컬럼으로 취급 금지 |
| prod migration 실패 | dev → prod 순, `foreign_key_check`, row count, PR #96/#101 교훈 |
| 한 PR 과대 | Phase별·테이블군별 micro-slice (contract §7) |

## 8. Slice 4 Sub-slice Proposal

| Sub-slice | 범위 | DB migration | 선행 조건 |
|---|---|---|---|
| **4-0** | allowlist 감사 (이 문서) | 없음 | Slice 3c 완료 |
| **4-1** | dead code: `createSessionAndSend`, `missing-request` 모듈 등 | 없음 | **완료** |
| **4-2-0** | `upload_session` 컬럼 retirement brief: 삭제 후보와 차단 조건 고정 | 없음 | **완료** — [Brief 26](./26_UPLOAD_SESSION_COLUMN_RETIREMENT_PRE_CODE_BRIEF.md) |
| **4-2a** | redirect-blocked `sessions/new`·`extract-criteria`·`direct-send` residue 제거 | 없음 | **완료** |
| **4-2b** | AI/review criteria context 이관 vs compatibility 결정 | 없음 (docs-only) | **완료** — [Brief 26 §2.4](./26_UPLOAD_SESSION_COLUMN_RETIREMENT_PRE_CODE_BRIEF.md) |
| **4-2b-impl** (optional) | criteria inference/read path 코드 이관 | 없음 | 4-2c 전 subject/body/criteria DROP unblock (필수 아님) |
| **4-2c** | `request_email_cc` 제거(table rebuild) | migration 0065 | **micro 완료** — dev+prod 적용; 추가 컬럼 DROP은 paused |
| **4-3** | `outbound_email`, request-event schema retirement | drop/rebuild | runtime INSERT 0 (현재 충족) |
| **4-4** | downstream `upload_session_id` 제거 | per-table rebuild 0065+ | dual-write 안정, read prefer 검토 |
| **4-5** | `upload_session` table retirement | final migration | 4-4 완료, retention 정책 |

## 9. `rg` Reconciliation Checklist

Slice 4 각 sub-slice PR 머지 후:

- [ ] `rg -l 'upload_session|uploadSession' --glob '*.{ts,tsx}'` 결과가 §5 카테고리와 일치
- [ ] `rg -l 'outbound_email|outboundEmail' --glob '*.{ts,tsx}'` 결과가 §6과 일치
- [ ] 미분류 파일 0건
- [ ] dead code(H) 항목이 실제로 제거됐거나 호출처가 문서화됨
- [ ] `docs/03_DB_SCHEMA.md` 동기화 (해당 slice에서 schema 변경 시)

## 10. Open Items

| 항목 | 상태 |
|---|---|
| prod DB migration 0060 적용 여부 | **해소(2026-07-06)** — dev는 이미 적용, prod는 `turso db shell semuagent`로 table rebuild 직접 적용·검증(`foreign_key_check` 0건) |
| JC-031 epic pause | **해소(2026-07-06)** — paused at 4-2c micro; epic stays `todo`. [Completion Contract §3 Paused](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md) |
| prod DB migration 0065 적용 여부 | **해소(2026-07-06)** — `semuagent-dev` → `semuagent` 순 적용, `request_email_cc` absent, row 2, `foreign_key_check` 0건 |
| `lib/completion.ts` 호출처 | `matches/[matchId]/route.ts` — 세션 완료 판정(C) |
| read prefer `source_batch_id` on downstream tables | 3c에서 deferred; 4-4 전 micro-slice 가능 |
| `docs/03_DB_SCHEMA.md` 전면 갱신 | 4-4/4-5 시점 |

## 11. Related Documents

- [Source Batch Replacement Pre-Code Brief](./24_SOURCE_BATCH_REPLACEMENT_PRE_CODE_BRIEF.md)
- [Upload Session Column Retirement Pre-Code Brief](./26_UPLOAD_SESSION_COLUMN_RETIREMENT_PRE_CODE_BRIEF.md)
- [Legacy Upload/Email Retirement Audit](./20_LEGACY_UPLOAD_EMAIL_RETIREMENT_AUDIT.md)
- [Legacy Mail Side-effect Audit](./21_LEGACY_MAIL_SIDE_EFFECT_AUDIT.md)
- [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [DB Schema](./03_DB_SCHEMA.md)
- [Backlog JC-031](../04_Logic_Progress/00_BACKLOG.md)
