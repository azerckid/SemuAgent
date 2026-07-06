# JC-031 Slice 4-2 Upload Session Column Retirement Pre-Code Brief
> Created: 2026-07-06 19:26 KST
> Last Updated: 2026-07-06 22:15 KST

## 0. Flow Status

```text
[Flow]
현재: JC-031 Slice 4-2c 진행 중 — upload_session.request_email_cc table rebuild (migration 0065)
Gate: 통과 (4-2b DROP 후보 확정)
완료: Slice 1~3c, Slice 4-0~4-2b, prod DB migration 0060 적용(2026-07-06)
다음: migration 0065 dev/prod 적용 후 Slice 4-2c 마이크로 완료; 이후 subject/body/criteria는 4-2b-impl 또는 read 0 증명 후
필요 확인: prod DB 0065 적용은 별도 승인·검증(`foreign_key_check`, row count)
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

### 2.2 Route Surface Finding (4-2-0)

`app/(dashboard)/dashboard/sessions/layout.tsx`는 `/dashboard`로 redirect하므로 `/dashboard/sessions/new` UI는 도달 불가능했다. 4-2a에서 page/component를 삭제했다.

### 2.3 Slice 4-2a Audit And Removal (2026-07-06)

| 대상 | redirect | 호출처(4-2a 전) | 4-2a 결정 |
|---|---|---|---|
| `sessions/new/page.tsx`, `SessionCreateForm` | `sessions/layout` | request-events POST/send (이미 410) | **삭제** |
| `lib/sessions/direct-send.ts` | — | 테스트만 | **삭제** |
| `POST /api/sessions/extract-criteria` | — | `sessions/new`, `schedules/new`, `request-templates/new` forms (모두 redirect-blocked layout) | **삭제** |
| `schedule-create-form`, `template-create-form` extract 버튼 | `schedules/layout`, `request-templates/layout` | extract-criteria API | **extract UI 제거**, 수동 criteria textarea 유지 |

4-2a 이후에도 `request_email_*` **write/read live path**가 남아 table rebuild 금지:

| 경로 | 역할 |
|---|---|
| `lib/services/session-service.ts` `createDirectUploadSession` | direct-upload synthetic `request_email_subject/body` write |
| `lib/review/default-criteria-data.ts` | subject/body에서 work type 추론 |
| `lib/ai/session-eval.ts` | evaluation prompt input |
| `lib/bookkeeping/classification-service.ts` | classification prompt context |
| `lib/reviews/build-review-sessions.ts`, `adaptive-structuring-eligibility-context.ts` | review workspace context |
| `sessions/[id]/_components/session-detail.tsx` | display (layout redirect로 도달 불가하나 코드 잔존) |

**4-2b**에서 criteria/review context 이관을 검토하기 전까지 `request_email_*` 컬럼 삭제는 금지다.

### 2.4 Slice 4-2b Criteria Context Audit (2026-07-06)

감사 기준: main `3dd203f`(PR #114 머지 후), 2026-07-06 KST.

```bash
# runtime 후보 (test/e2e 제외)
rg -l 'analysisNotes|extractedCriteria|additionalCriteria|sessionEvaluation|requestEmailSubject|requestEmailBody|requestEmailCc' \
  --glob '*.{ts,tsx}' | grep -v '\.test\.' | grep -v '\.e2e\.'

# 4-2a 삭제 확인 (파일시스템 기준 0건)
test ! -e 'app/(dashboard)/dashboard/sessions/new' && test ! -e 'app/api/sessions/extract-criteria'
```

**Redirect-blocked UI:** `sessions/layout.tsx`·`reviews/layout.tsx`가 `/dashboard`로 redirect하므로 `session-detail.tsx`·`reviews/page.tsx`는 **도달 불가 UI**다. 아래 표의 "UI read"는 코드 잔존이며 live API/파이프라인과 구분한다.

**`client.analysis_notes`와 `upload_session.analysis_notes`는 별개다.** 회사 설정·clients API·`client-manager.tsx`의 `analysisNotes`는 `client` 테이블 컬럼이며 Slice 4-2b 범위 밖이다.

#### 2.4.1 `analysis_notes` (`upload_session`)

| 구분 | 파일 (runtime, test 제외) |
|---|---|
| **WRITE live** | `lib/services/session-service.ts` (`createDirectUploadSession`), `app/api/staff-direct-upload/route.ts`, `lib/first-run-sample/seed.ts` |
| **READ live** | `lib/ai/session-eval.ts` (`sessionAnalysisNotes`), `lib/ai/analyze.ts` (`session.analysisNotes`) |
| **UI read (redirect-blocked)** | `app/(dashboard)/dashboard/sessions/[id]/_components/session-detail.tsx` |

**4-2b 결정: compatibility retain (이관 보류).**

- **근거:** direct-upload 검토 메모가 세션 단위로 기록되고, 자료 제출 후 `upload/submit` → session evaluation 파이프라인이 세션 메모를 프롬프트에 포함한다. `client.analysis_notes`(회사 상시 기준)와 역할이 다르다.
- **이관하지 않는 이유:** `source_batch`에 대응 컬럼이 없고, additive migration + dual-write + read switch는 docs-first 범위를 넘는다. optional 후속 **4-2b-impl**에서 `source_batch` metadata 또는 `upload_item_declaration` snapshot으로 옮길 수 있으나 4-2c 전 필수는 아니다.
- **4-2c:** 컬럼 DROP 금지 (live write/read 유지).

#### 2.4.2 `extracted_criteria` / `additional_criteria`

| 구분 | 파일 (runtime, test 제외) |
|---|---|
| **WRITE live** | `lib/services/session-service.ts` — **항상 `null`만 기록** (4-2a 이후 GIWA 메일 추출 write path 없음) |
| **READ live** | `lib/ai/session-eval.ts`, `lib/ai/analyze.ts`, `lib/ai/prompt.ts` |
| **UI read (redirect-blocked)** | `session-detail.tsx` |
| **기타** | `shouldMergeDefaultCriteria` 분기(`session-eval.ts`): 두 컬럼이 비어 있으면 `request_item_validation` + default criteria 병합 |

**4-2b 결정: compatibility retain (read 유지, write 사실상 dead).**

- **근거:** 신규 direct-upload 세션은 항상 null이지만, prod snapshot(§2.1) 2건이 legacy 값을 보유할 수 있고, evaluation/analyze 프롬프트가 여전히 컬럼을 읽는다.
- **이관하지 않는 이유:** GIWA `extract-criteria` API는 4-2a에서 삭제됐고, 대체 write path가 없다. `client.analysis_notes`로 이관하면 세션별·회사별 기준 경계가 깨진다. 별도 `review_context` 테이블은 Slice 4-5급 설계다.
- **4-2c:** **DROP 후보** — 단, `session-eval`·`analyze`·`prompt` read 제거(optional **4-2b-impl**) 또는 legacy prod row 2건 폐기 정책 확정 후에만 rebuild 목록에 넣는다.

#### 2.4.3 `session_evaluation`

| 구분 | 파일 (runtime, test 제외) |
|---|---|
| **WRITE live** | `lib/ai/session-eval.ts` (평가 결과 JSON `UPDATE`) |
| **WRITE null** | `lib/upload-session-revision.ts` (revision 시 초기화) |
| **READ live** | `lib/reviews/build-review-sessions.ts`, `lib/reviews/adaptive-structuring-eligibility-context.ts` |
| **UI read (redirect-blocked)** | `session-detail.tsx` |
| **트리거 (live API)** | `app/api/upload/submit/route.ts`, `app/api/sessions/evaluate/route.ts`, `app/api/sessions/[id]/start-evaluation/route.ts` |

**4-2b 결정: compatibility retain (이관 보류).**

- **근거:** v1 자료 제출 직후 세션 평가 결과가 review/adaptive-structuring eligibility 입력으로 쓰인다. 별도 결과 테이블 이관은 스키마·dual-write·read switch가 필요하다.
- **이관하지 않는 이유:** `source_batch` lineage와 무관한 **세션 검토 산출물**이며, Slice 3에서 downstream FK 이관 대상이 아니었다(Allowlist §3c-5와 동일 provenance 성격).
- **4-2c:** 컬럼 DROP 금지.

#### 2.4.4 `request_email_subject` / `request_email_body`

| 구분 | 파일 (runtime, test 제외) |
|---|---|
| **WRITE live** | `lib/services/session-service.ts` — direct-upload **synthetic** subject/body |
| **READ live** | `lib/ai/session-eval.ts`, `lib/review/default-criteria-data.ts` (`inferGeneralDefaultCriteriaWorkType`), `lib/bookkeeping/classification-service.ts`, `lib/reviews/build-review-sessions.ts`, `lib/reviews/adaptive-structuring-eligibility-context.ts` |
| **UI read (redirect-blocked)** | `session-detail.tsx` |
| **4-2a 삭제 확인** | `sessions/new`·`extract-criteria` — 파일시스템 **0건** (`rg` 인덱스 잔존 가능, `test ! -e`로 재검증) |

**4-2b 결정: compatibility retain (단기); inference 이관은 optional 4-2b-impl.**

- **근거:** direct-upload는 실제 요청 메일이 없지만, synthetic subject/body가 work-type 추론·분류 프롬프트·review context에 쓰인다.
- **이관하지 않는 이유:** `request_kind`·`staff_direct_label`·`source_batch.display_label`로 대체 가능하나 **코드 변경**이 필요하다. docs-first 4-2b에서는 결정만 고정하고 구현은 4-2b-impl 또는 4-2c 직전 micro-slice로 분리한다.
- **4-2c:** subject/body DROP는 **4-2b-impl 완료 후** 또는 read path 0건 증명 후. `request_email_cc`와 동시 삭제하지 않는다(cc는 먼저 제거 가능).

#### 2.4.5 `request_email_cc`

| 구분 | 파일 (runtime, test 제외) |
|---|---|
| **WRITE live** | `lib/services/session-service.ts` — **항상 `null`** |
| **READ live** | **0건** (`requestEmailCc` / `request_email_cc`, schema·test·4-2a 삭제 잔재 `session-create-form` rg 히트 제외 시 파일시스템 0) |

**4-2b 결정: 4-2c DROP 후보 (이관 불필요).**

- **근거:** runtime read 없음, write는 null 고정, prod snapshot(§2.1)에서도 non-null 0건.
- **이관 vs retain:** 이관 대상 없음. table rebuild 시 컬럼 제거만 하면 된다.

#### 2.4.6 4-2b Decision Summary

| 컬럼 | 결정 | 4-2c 처리 | 판단 근거 한 줄 |
|---|---|---|---|
| `analysis_notes` | **compatibility retain** | DROP 금지 | direct-upload 메모 write + AI eval/analyze read live |
| `extracted_criteria` | **compatibility retain (read)** | DROP 후보 (read 제거 후) | write dead, AI read + prod legacy row 가능 |
| `additional_criteria` | **compatibility retain (read)** | DROP 후보 (read 제거 후) | 동일 |
| `session_evaluation` | **compatibility retain** | DROP 금지 | upload submit 평가 산출물, review eligibility live |
| `request_email_subject` | **compatibility retain** | DROP 후보 (4-2b-impl 후) | synthetic write + work-type/classification read live |
| `request_email_body` | **compatibility retain** | DROP 후보 (4-2b-impl 후) | 동일 |
| `request_email_cc` | **4-2c DROP** | 첫 rebuild에 포함 가능 | runtime read 0, null-only write, prod non-null 0 |

**Optional 후속 slice `4-2b-impl` (코드, 본 PR 범위 밖):**

- `inferGeneralDefaultCriteriaWorkType`를 `request_kind` + `staff_direct_label`(+ `source_batch`) 기반으로 대체.
- `session-eval`·`analyze`·`prompt`에서 `extracted_criteria`/`additional_criteria` read 제거(legacy row 정책 확정 후).
- 위가 끝나면 `request_email_subject`/`body` synthetic write 중단 검토.

4-2b-impl 없이도 **4-2c는 `request_email_cc`만** 안전하게 제거할 수 있다. 나머지 컬럼은 §5 gate 미충족.

### 2.5 Slice 4-2c Micro — `request_email_cc` DROP (2026-07-06)

| 항목 | 내용 |
|---|---|
| migration | `drizzle/0065_drop_upload_session_request_email_cc.sql` |
| 코드 | `lib/db/schema.ts`에서 `requestEmailCc` 제거, `session-service.ts` null write 제거 |
| gate | §2.4.5 조건 충족 — runtime read 0, prod non-null 0 |
| 적용 | dev DB 먼저 → `PRAGMA foreign_key_check`·row count 검증 → prod는 별도 승인 |

**4-2c micro 완료 후에도** `request_email_subject`/`body`·criteria·`analysis_notes`·`session_evaluation` 컬럼은 유지한다.

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

### 3.2 Candidate After 4-2a (4-2b 결정 반영)

| 후보 | 4-2b 결정 | 4-2c 조건 |
|---|---|---|
| `request_email_cc` | **DROP 완료(4-2c micro)** | migration 0065 | runtime read 0 확인 완료(§2.4.5) |
| `extracted_criteria`, `additional_criteria` | **retain (read)** — write dead | optional 4-2b-impl로 AI read 제거 후 DROP |
| `request_email_subject`, `request_email_body` | **retain** — synthetic write + inference read | 4-2b-impl로 `request_kind`/`staff_direct_label` 대체 후 DROP |
| `analysis_notes`, `session_evaluation` | **retain** — v1 파이프라인 핵심 | 별도 이관 설계 전 DROP 금지 |

### 3.3 Not A Column In `upload_session`

`request_email_greeting`과 `sender_phone`은 현재 `upload_session` 컬럼이 아니다. 이 값은 request-event snapshot/form residue에 속하므로 Slice 4-2 table rebuild 컬럼 목록에 포함하지 않는다.

## 4. Proposed 4-2 Sub-slices

| Sub-slice | 범위 | DB migration | 완료 조건 |
|---|---|---|---|
| **4-2-0** | 이 문서. 컬럼별 운명과 blocker 고정 | 없음 | 삭제 금지 컬럼/후보 컬럼 문서화, 기존 allowlist/backlog sync |
| **4-2a** | `sessions/new` 및 request-email/context residue 결정 | 없음 또는 코드 삭제만 | **완료:** redirect-blocked UI/API 삭제, live `request_email_*` path 문서화 |
| **4-2b** | AI/review criteria context 이관 vs compatibility 결정 | 없음 (docs-only) | **완료(이번 PR):** §2.4 필드별 live path 감사, retain vs 4-2c DROP 후보 확정 |
| **4-2b-impl** (optional) | criteria inference·read path 코드 이관 | 없음 | 4-2c 전 subject/body/criteria DROP unblock (필수 아님) |
| **4-2c** | `request_email_cc` 제거(table rebuild) | migration 0065 | **진행(이번 PR):** schema·코드·0065 SQL, dev/prod 적용은 PR 후 |

4-2b가 끝나기 전에는 4-2c를 시작하지 않는다. 4-2b-impl은 선택적이며 gate를 막지 않는다(`request_email_cc` 단독 DROP 가능).

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
- [x] 4-2a에서 legacy session/request context surface가 실제로 제거 또는 이관된다(redirect-blocked residue 삭제, live path는 4-2b로 이관).
- [x] 4-2b에서 criteria context 필드별 live read/write가 `rg`로 감사되고 migrate vs retain 결정이 §2.4에 고정된다.
- [ ] 4-2c에서 삭제 대상 컬럼의 runtime read/write 0건이 증명된다.

## 8. Related Documents

- [Slice 4 Schema Retirement Allowlist](./25_SLICE4_SCHEMA_RETIREMENT_ALLOWLIST.md)
- [Source Batch Replacement Pre-Code Brief](./24_SOURCE_BATCH_REPLACEMENT_PRE_CODE_BRIEF.md)
- [Legacy Upload/Email Retirement Audit](./20_LEGACY_UPLOAD_EMAIL_RETIREMENT_AUDIT.md)
- [Legacy Mail Side-effect Audit](./21_LEGACY_MAIL_SIDE_EFFECT_AUDIT.md)
- [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [Backlog JC-031](../04_Logic_Progress/00_BACKLOG.md)
