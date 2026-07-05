# JC-031 Slice 3 Source Batch Replacement Pre-Code Brief
> Created: 2026-07-05 23:28 KST
> Last Updated: 2026-07-05 23:28 KST

## 0. Flow Status

```text
[Flow]
현재: JC-031 Slice 3a 완료 — Source batch schema/backfill/dual-write
Gate: 통과
완료: Slice 1~2c, dev DB 0060·0061 적용, Slice 3a source_batch 도입
다음: Slice 3b read switch → Slice 3c downstream FK migration
필요 확인: 3b read model별 source_batch 우선/fallback 전략
권장 스킬: rules-product -> rules-dev/rules-workflow
```

## 1. Purpose

JC-031의 남은 핵심은 `upload_session`이 두 책임을 동시에 갖고 있는 문제를 푸는 것이다.

1. 레거시 GIWA 책임: 외부 고객 업로드 포털, 요청메일, 토큰 URL, request-event 연결.
2. SemuAgent v1 책임: 회사 내부 자료수집 batch와 그 파일에서 파생된 기장·급여·신고 준비 결과의 source lineage.

Slice 1~2c는 레거시 포털/메일 책임을 차단·삭제했다. Slice 3는 SemuAgent에 필요한 source lineage 책임을 `source_batch`로 분리한다. 이 작업은 신고 준비 기능이 아니라 기반 정리다.

## 2. Current Findings

브리프 작성 시점에는 `source_batch` 독립 테이블이 없었다. Slice 3a에서 범용 `source_batch` 테이블을 도입했다. 기존에 발견된 `source_batch_id`는 `payroll_employee_line.source_batch_id -> payroll_extraction_batch.id`로, 범용 source lineage 모델이 아니므로 3c에서 별도 정리 대상이다.

`upload_session`은 다음 필드를 함께 보유한다.

| 책임 | 대표 필드 | 판단 |
|---|---|---|
| 내부 source lineage | `tenant_id`, `client_id`, `created_by_staff_id`, `accounting_period`, `bookkeeping_period_*`, `source`, `staff_direct_label`, `deleted_at` | `source_batch`로 이관 대상 |
| 외부 포털/메일 호환 | `token_hash`, `upload_url`, `expires_at`, `status`, `last_accessed_at`, `request_email_*`, `request_event_id`, `request_kind` | Slice 4 retirement 대상 |
| 임시 분석/검토 | `analysis_notes`, `session_evaluation`, `extracted_criteria`, `additional_criteria` | 즉시 삭제 금지. 실제 사용처 확인 후 이관/유지 결정 |

스키마상 `upload_session`에 직접 묶인 주요 테이블은 다음과 같다.

| 그룹 | 테이블/컬럼 | Slice 3 판단 |
|---|---|---|
| 원천 파일 | `upload_file.upload_session_id` | 1순위. `source_batch_id` 추가·backfill·dual-write |
| 수집 검증 | `request_item_validation.upload_session_id`, `upload_item_declaration.upload_session_id` | source lineage 성격. `source_batch` 전환 후보 |
| 기장 | `bookkeeping_*_run/row/voucher/material/link/uploadSessionId`, `bookkeeping_ledger_month.last_upload_session_id` | read model 영향 큼. 3b/3c로 단계 전환 |
| 급여 | `payroll_rule_profile_application`, `payroll_extraction_batch/row`, `payroll_excel_draft`, `payroll_employee_line.uploadSessionId` | 급여 파일 lineage. 3b/3c로 단계 전환 |
| adaptive structuring | `adaptive_structure_model.source_upload_session_id`, `adaptive_structure_model_run.upload_session_id` | source lineage이지만 별도 검증 필요 |
| 레거시 요청 이벤트/메일 | `client_request_event.upload_session_id`, `outbound_email.upload_session_id` | Slice 4 retirement. Slice 3에서 건드리지 않음 |
| audit/proof | `audit_proof.upload_session_id` | 역사 추적. 삭제 금지, compatibility/fallback 유지 |

## 3. Source Batch Model Contract

새 범용 모델명은 `source_batch`로 한다.

v1 최소 필드:

| 필드 | 의미 |
|---|---|
| `id` | source batch id |
| `tenant_id` | tenant isolation |
| `client_id` | 사업장 |
| `created_by_staff_id` | 내부 업로드 담당자 |
| `source_kind` | `staff_direct` 우선. 과거 row backfill은 `legacy_upload_session` 또는 기존 source snapshot 사용 |
| `accounting_period` | 기존 upload session period snapshot |
| `bookkeeping_period_type` | monthly/quarterly/yearly |
| `bookkeeping_period_start` | inclusive YYYY-MM |
| `bookkeeping_period_end` | inclusive YYYY-MM |
| `display_label` | 기존 `staff_direct_label` 승계 |
| `legacy_upload_session_id` | backfill/호환 추적용 nullable unique-ish pointer |
| `deleted_at`, `deleted_by_staff_id` | source collection soft delete |
| `created_at`, `updated_at` | audit |

원칙:

- 새 런타임 source lineage는 `source_batch.id`를 기준으로 한다.
- `upload_session`은 Slice 3 기간 동안 compatibility table로 남긴다.
- backfill row는 원래 `upload_session.id`를 `legacy_upload_session_id`로 보존한다.
- 기존 파일/blob 자체는 이동하지 않는다. storage key와 content hash는 `upload_file`에 유지한다.
- tenant/client/period 조건은 `source_batch`와 `upload_file` 양쪽에서 tenant scoped로 유지한다.

## 4. Slice 3 Sub-slices

### Slice 3a — Schema, Backfill, Dual-write

목표: 런타임 read를 크게 바꾸지 않고 새 source lineage 뼈대를 만든다.

Changes:

- `source_batch` 테이블 추가.
- `upload_file.source_batch_id` nullable FK 추가.
- 기존 `upload_session` row를 `source_batch`로 backfill.
- 기존 `upload_file.upload_session_id`를 기준으로 `upload_file.source_batch_id` backfill.
- 신규 direct-upload/staff-upload 생성 경로는 `upload_session` compatibility row와 `source_batch`를 동시에 생성한다.
- 공유 upload API(`/api/upload`, `/api/upload/submit`, `/api/upload/files/*`)는 깨지지 않게 `upload_session` compatibility를 유지한다.

Done for 3a:

- [x] 모든 기존 `upload_file` row가 `source_batch_id`를 갖는다(dev DB 0061 검증: 4/4 linked).
- [x] 신규 direct-upload로 생성되는 파일도 `source_batch_id`를 갖는다(`createDirectUploadSession` dual-write + upload callback 저장).
- [x] 기존 source collection 화면과 API는 동작이 변하지 않는다(`upload_session` compatibility 유지).
- [x] migration은 Turso에서 실제 적용 가능한 SQL이어야 하며, FK/인덱스 보존 검증을 포함한다(dev DB `foreign_key_check` 0).

### Slice 3b — Read Model Switch

목표: 신고 준비/자료수집/기장/급여 read model이 source lineage 판단에 `source_batch`를 우선 사용한다.

Priority read surfaces:

1. `lib/source-collection/summary.ts`
2. `lib/bookkeeping-review/summary.ts`
3. `lib/bookkeeping/fiscal-year-ledger*.ts`
4. `lib/business-status-report/summary.ts`
5. payroll extraction/read summaries that only need source lineage

Rules:

- `source_batch_id`가 있으면 `source_batch` 기준으로 period/client/source를 판단한다.
- legacy row는 `upload_session` fallback을 허용한다.
- 화면 숫자와 blocker가 서로 다른 lineage source를 쓰지 않게 loader 단위로 통일한다.
- mutation은 3b에서 최소화한다. read switch와 write switch를 섞지 않는다.

Done for 3b:

- 신고 준비 허브/자료수집/기장검토/사업장현황신고/급여 관련 read model이 기존 테스트와 신규 source_batch 테스트를 통과한다.
- `upload_session` fallback allowlist가 문서화된다.

### Slice 3c — Downstream FK Migration

목표: source lineage만 필요한 downstream table에 `source_batch_id`를 추가하고, 새 row는 `source_batch`를 기록한다.

Candidate tables:

- `request_item_validation`, `upload_item_declaration`
- `bookkeeping_material_attribution`, `bookkeeping_ledger_material_link`
- `bookkeeping_classification_run`, `bookkeeping_transaction_classification`
- `bookkeeping_journal_entry_run/row/voucher`
- payroll extraction/application/draft/employee-line tables
- adaptive structuring run/model tables

Rules:

- 한 PR에서 모든 downstream table을 이관하지 않는다.
- 각 table은 `add nullable source_batch_id -> backfill -> write dual -> read prefer -> tighten/delete legacy FK later` 순서를 따른다.
- `upload_session_id` 삭제는 Slice 4 schema retirement 전까지 하지 않는다.

Done for 3c:

- 핵심 source lineage read path가 `source_batch`를 통해 end-to-end 추적 가능하다.
- 남은 `upload_session` 참조는 compatibility/legacy/request-event/audit allowlist로 분류된다.
- `rg upload_session|uploadSession` 결과가 allowlist 문서와 일치한다.

## 5. Non-goals

- Slice 3a에서 `upload_session` 테이블 삭제.
- Slice 3a에서 `outbound_email`, request-event, mail-console schema 삭제.
- direct-upload 공유 API 중단.
- blob 파일 이동 또는 storage key 재작성.
- 과거 데이터 삭제.
- UI 재설계. 사용자 화면은 기존 자료수집/신고 준비 화면을 유지한다.

## 6. Risks And Guardrails

| Risk | Guardrail |
|---|---|
| direct-upload가 깨짐 | compatibility `upload_session` dual-write 유지 |
| read model 숫자 불일치 | loader별로 source lineage source를 하나로 통일 |
| FK migration이 Turso에서 실패 | PR #96 교훈 반영: FK/인덱스 포함 실제 SQL 검증 |
| 한 PR이 너무 커짐 | 3a/3b/3c 분리, downstream table은 추가 micro-slice 허용하되 contract 안에서만 |
| legacy 참조가 계속 늘어남 | 새 코드에서 `upload_session` source lineage 참조 추가 금지 |

## 7. Verification Plan

각 slice마다 최소 확인:

- `npx tsc --noEmit`
- `npm test -- --run`
- `npm run lint`
- migration 포함 시 dev DB target 확인 후 적용 검증(`PRAGMA table_info`, FK, index, row count)
- `rg "upload_session|uploadSession|outbound_email|outboundEmail"` allowlist 갱신
- direct-upload smoke: source collection 화면/API, upload submit, file download/retry/password 경로 영향 없음 확인

## 8. Acceptance Criteria

Slice 3 전체 완료 기준:

- [ ] `source_batch`가 SemuAgent 내부 source lineage의 primary model로 도입된다.
- [ ] `upload_file`과 핵심 자료수집 read model이 `source_batch`를 사용한다.
- [ ] 기장/급여/신고 준비 read model이 `source_batch` 우선, legacy fallback 허용 방식으로 동작한다.
- [ ] 새 runtime code가 source lineage 목적으로 `upload_session` 의존을 추가하지 않는다.
- [ ] 남은 `upload_session` 참조가 compatibility/legacy/request-event/audit allowlist로 문서화된다.
- [ ] direct-upload, source collection, bookkeeping review, payroll, VAT, filing support, reminders, filing preparation tests pass.

## 9. Related Documents

- [Legacy Upload/Email Retirement Audit](./20_LEGACY_UPLOAD_EMAIL_RETIREMENT_AUDIT.md)
- [Legacy Mail Side-effect Audit](./21_LEGACY_MAIL_SIDE_EFFECT_AUDIT.md)
- [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- [DB Schema](./03_DB_SCHEMA.md)
- [Backlog JC-031](../04_Logic_Progress/00_BACKLOG.md)
