# JC-034 GIWA Handoff Package Pre-Code Technical Brief
> Created: 2026-07-07 04:15 KST
> Last Updated: 2026-07-07 23:04 KST

## 0. Governing Principle

JC-034는 **Filing Path 2** 를 구현한다. 회사가 확정한 신고 준비 데이터를 **수임 세무사무소**가
**자료기와(JARYO-GIWA)** 에서 검토할 수 있는 **구조화 handoff ZIP**으로 보낸다.

- **구현 우선순위:** Path 1(홈택스 양식 기입·신고 보조) 세목 확대가 **JC-034 코드 착수보다 선행**한다 ([Path 1 Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)).

- SemuAgent는 홈택스에 제출하지 않는다. 사무소는 위하고·세무사랑 등 **검정 SW**로 전자신고·대리 제출한다.
- v1은 **ZIP Export only** — SemuAgent↔GIWA API·실시간 연동·세무대리 알선 없음.
- **JC-030 Validation** 을 Path 1·2 공통 게이트로 재사용한다. blocking 오류 시 export 차단.
- 소득자 식별정보는 [JC-030 PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)와 동일 — **일회성 입력·서버 미저장**.
- 생성 ZIP·plain SC 첨부는 **v1 기본: 다운로드 후 서버 미보관**.
- UI·문구는 Path 1a 베타 이후 신규 Preview로 다시 승인한다. 기존 [08_filing_preparation.html](../02_UI_Screens/previews/08_filing_preparation.html) `#jc-034-handoff-export` 패널은 Path 1-only preview로 supersede되었다.
- 제품·범위 게이트: [JC-034 Scope Gate](./34_JC034_GIWA_HANDOFF_PACKAGE_SCOPE_GATE.md) · [Product Baseline §3](../01_Concept_Design/01_PRODUCT_BASELINE.md).

## 0.1 Flow Status

```text
[Flow]
현재: Filing Path 2 — JC-034 Pre-Code Brief 보존, 구현 착수 보류
Gate: Path 1a 베타 안정화 선행
미완료: UI-First Gate — Path 1a 베타 이후 신규 Preview 재승인 필요
다음: Path 1a 베타 후 JC-034 Scope/Preview 재검토
v1 최소 트랙: 간이지급 반기 + 원천세 summary + 부가세 summary
```

## 1. Scope

### 포함 (v1)

1. 신고 준비 허브 `/dashboard/filing-preparation` 내 **Path 2 handoff export 패널** (Path 1a 베타 이후 신규 Preview 필요)
2. 트랙 선택(체크박스) + 기간 컨텍스트 + 수신 사무소명 확인
3. **manifest.json** (Zod 검증) + 트랙별 **CSV** + **README-handoff.txt** ZIP
4. v1 최소 트랙 3종:
   - `payment_statement` — JC-024 간이지급 반기 집계
   - `withholding` — JC-012·신고지원 원천세 summary
   - `vat` — JC-011 부가세 summary
5. 적용 시 선택 트랙:
   - `local_income` — JC-027 지방소득세(원천 특별징수분)
   - `business_status` — JC-028 사업장현황신고 (면세 개인만 applicable)
6. 선택 첨부: JC-030 Validation 통과 시 **plain SC 파일** (`attachments/SC{bizRegNo10}`)
7. Export 전 **handoff 확인** + **감사 로그**(PII 없음)
8. Validation blocking 시 export 차단 + UI blocker 목록
9. 단위 테스트: manifest Zod, CSV 빌더, tenant 격리, empty/inapplicable track, validation gating

### 제외 (v1)

- SemuAgent↔GIWA API push, invitation link, receipt sync (v2)
- 세무대리인 마켓플레이스·알선·기장료 중개
- 홈택스 로그인·공동인증서·자동 제출(JC-023)
- Path 3 fcrypt·적합성 검정 파일을 Path 2 필수 산출물로 취급
- ZIP 서버 장기 보관·재다운로드 URL
- 연말정산 정산액 계산·사업소득 간이지급 SF

## 2. Route and Module Boundary

| 항목 | 결정 |
|:---|:---|
| UI Route | 기존 `/dashboard/filing-preparation` — JC-034 export 패널 추가 |
| 화면 성격 | read(트랙 상태) + **제한적 mutation**(export POST) |
| Read model | `lib/giwa-handoff/summary.ts` — JC-029·도메인 summary 래핑 + export readiness |
| Assembler | `lib/giwa-handoff/assemble-package.ts` — manifest + CSV + README (순수 함수) |
| ZIP writer | `lib/giwa-handoff/build-zip.ts` — Buffer in-memory, stream response |
| Validation | `lib/giwa-handoff/validate-export.ts` — 트랙별 blocker + JC-030 재사용 |
| Schemas | `lib/giwa-handoff/schemas.ts` — manifest·request Zod |
| Persistence | `filing_handoff_export_log` 테이블(메타만) — 신규 migration |
| API | `POST /api/filing-preparation/giwa-handoff/export` |
| Dependencies | `lib/filing-preparation/summary`, `lib/filing-support/summary`, `lib/vat/summary`, `lib/payment-statements/summary`, `lib/local-income-tax/summary`, `lib/business-status-report/summary`, `lib/efiling-simplified-wage/*` |

## 3. ZIP Layout and File Names

### 3.1 다운로드 파일명

```
semuagent-handoff-{businessRegNo10}-{exportDateYYYYMMDD}.zip
```

예: `semuagent-handoff-1234567890-20260707.zip`

### 3.2 ZIP 내부 루트

모든 경로는 ZIP 루트 기준 상대 경로. 디렉터리 구분은 `/`.

| 경로 | 필수 | 설명 |
|:---|:---:|:---|
| `manifest.json` | Y | 패키지 메타·트랙·검증 요약 |
| `README-handoff.txt` | Y | 책임 경계·사무소 후속 작업 안내 |
| `withholding/summary.csv` | 조건부 | 원천세 트랙 선택 시 |
| `vat/summary.csv` | 조건부 | 부가세 트랙 선택·applicable 시 |
| `vat/deduction-reviews.csv` | 조건부 | 부가세 트랙 + 검토 행 존재 시 |
| `payment-statements/simplified-wage-half.csv` | 조건부 | 지급명세서 트랙 선택 시 |
| `payment-statements/year-end-prep.csv` | 조건부 | 지급명세서 트랙 선택 시 (연말 준비 행) |
| `local-income-tax/lines.csv` | 조건부 | 지방소득세 트랙 선택 시 |
| `business-status/summary.csv` | 조건부 | 사업장현황 트랙·applicable 시 |
| `attachments/SC{bizRegNo10}` | N | 사용자 opt-in + JC-030 Validation 통과 시 plain 파일 |

### 3.3 CSV 공통 규칙

- 인코딩: **UTF-8 with BOM** (Excel 한글 호환)
- 구분자: `,`
- 헤더: 1행 영문 snake_case (GIWA·스크립트 import 용)
- 금액: 정수 KRW, 단위 컬럼 없음
- 날짜: `YYYY-MM-DD` 또는 `YYYY-MM` (컬럼별 고정)
- 빈 트랙 applicable이나 데이터 0건: **파일 생략** + manifest `tracks[].status = 'empty'`

## 4. manifest.json — Zod Schema

구현 파일: `lib/giwa-handoff/schemas.ts`

```typescript
import { z } from 'zod'

export const giwaHandoffTrackIdSchema = z.enum([
  'withholding',
  'vat',
  'payment_statement',
  'local_income',
  'business_status',
])

export const giwaHandoffTrackStatusSchema = z.enum([
  'included',   // CSV 생성·데이터 있음
  'empty',      // applicable·선택됐으나 집계 0건
  'skipped',    // not applicable (사업자 유형 등)
  'blocked',    // export 시점에 blocker — v1에서는 export 자체가 실패하므로 manifest에 남지 않음
])

export const giwaHandoffValidationSummarySchema = z.object({
  blockingErrorCount: z.number().int().min(0),
  warningCount: z.number().int().min(0),
  issueCodes: z.array(z.string()), // ruleId 또는 track-specific code, 값 없음
})

export const giwaHandoffTrackManifestSchema = z.object({
  trackId: giwaHandoffTrackIdSchema,
  status: giwaHandoffTrackStatusSchema,
  periodKey: z.string(),
  periodLabel: z.string(),
  files: z.array(z.object({
    path: z.string(),
    rowCount: z.number().int().min(0),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })),
  attentionCount: z.number().int().min(0),
})

export const giwaHandoffManifestSchema = z.object({
  schemaVersion: z.literal('1.0'),
  packageKind: z.literal('semuagent_giwa_handoff'),
  generatedAt: z.string().datetime(), // ISO-8601, Asia/Seoul 기준 생성 시각
  semuAgentVersion: z.string().min(1), // package.json version 또는 git sha short
  tenantId: z.string().uuid(),
  businessEntityId: z.string().uuid(),
  businessName: z.string().min(1),
  businessRegistrationNumber: z.string().regex(/^\d{10}$/),
  taxEntityType: z.enum(['individual', 'corporation', 'tax_exempt', 'unknown']),
  recipient: z.object({
    firmName: z.string().min(1).max(100),
    deliveryMode: z.literal('manual_download'), // v1 only
  }),
  filingPaths: z.object({
    path: z.literal(2),
    pathLabel: z.literal('GIWA handoff'),
  }),
  tracks: z.array(giwaHandoffTrackManifestSchema).min(1),
  validation: giwaHandoffValidationSummarySchema,
  attachments: z.array(z.object({
    path: z.string(),
    kind: z.enum(['plain_simplified_wage_sc']),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })),
  responsibility: z.object({
    semuAgentDid: z.array(z.string()),
    semuAgentDidNot: z.array(z.string()),
    firmMust: z.array(z.string()),
  }),
})

export type GiwaHandoffManifest = z.infer<typeof giwaHandoffManifestSchema>
```

### 4.1 responsibility 고정 문구 (manifest + README 공유)

**semuAgentDid:**

- 확정 신고 준비 데이터를 구조화 CSV로 정리
- 선택 트랙에 대한 사전검증(형식·누락·정합) 결과 요약

**semuAgentDidNot:**

- 홈택스·위택스 제출·대리 제출
- 국세청 적합성 검정·인증 전자신고 파일 보장(Path 3)
- 세무대리인 알선·수수료 중개

**firmMust:**

- 자료기와(JARYO-GIWA) 또는 내부 절차로 자료 검토
- 검정 전자신고 SW로 신고 파일 작성·홈택스 대리 제출
- 최종 세액·신고 책임 확인

## 5. Per-Track CSV Columns

### 5.1 `withholding/summary.csv`

소스: `loadFilingSupportSummary` + 해당 `payroll_period_summary` (원천세 항목).

| Column | Type | Source |
|:---|:---|:---|
| `filing_period_key` | string | `FilingPeriod.filingPeriodKey` (예: `2026-06`) |
| `filing_period_label` | string | `FilingPeriod.payrollLabel` |
| `employee_count` | int | `payroll.employeeCount` |
| `gross_pay_krw` | int | `payroll.grossPayKrw` |
| `withholding_tax_krw` | int | `payroll.withholdingTaxKrw` |
| `income_tax_krw` | int | `payroll.incomeTaxKrw` |
| `local_income_tax_krw` | int | `payroll.localIncomeTaxKrw` |
| `social_insurance_krw` | int | `payroll.socialInsuranceKrw` |
| `payroll_close_status` | string | `open` / `blocked` / `closed` |
| `withholding_statement_status` | string | `not_generated` / `ready` / `generated` / `failed` |
| `issue_count` | int | `payroll.issueCount` |
| `ready_for_handoff` | boolean | filing item `status === 'ready'` |

v1: **단일 행**(선택한 `payrollPeriodKey` 1건). 다월 일괄 export는 v2.

### 5.2 `vat/summary.csv`

소스: `loadVatSummary`.

| Column | Type | Source |
|:---|:---|:---|
| `vat_period_key` | string | `period.periodKey` |
| `vat_period_label` | string | `period.periodLabel` |
| `output_tax_krw` | int | `taxSummary.outputTaxKrw` |
| `input_tax_krw` | int | `taxSummary.inputTaxKrw` |
| `input_tax_deductible_krw` | int | `taxSummary.inputTaxDeductibleKrw` |
| `payable_tax_krw` | int | `taxSummary.payableTaxKrw` |
| `pending_deduction_count` | int | `taxSummary.pendingDeductionCount` |
| `is_final` | boolean | `taxSummary.isFinal` |
| `filing_deadline` | string | `taxSummary.filingDeadline` |
| `ready_for_handoff` | boolean | `pendingDeductionCount === 0` |

### 5.3 `vat/deduction-reviews.csv`

소스: `vat.deductionReviews[]` (0건이면 파일 생략).

| Column | Type | Source |
|:---|:---|:---|
| `review_id` | string | `id` |
| `description` | string | |
| `counterparty` | string | nullable → 빈 문자열 |
| `supply_amount_krw` | int | |
| `input_tax_krw` | int | |
| `kind` | string | `deductible` / `non_deductible_candidate` / `proration_required` |
| `decision` | string | `pending` / `deductible` / `non_deductible` / `prorated` |
| `reason` | string | |
| `proration_rate_bps` | int | nullable → 빈 |

### 5.4 `payment-statements/simplified-wage-half.csv`

소스: `loadPaymentStatementSummary` → `simplified[]` ([JC-024 Brief §4](./16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md)).

| Column | Type | Source |
|:---|:---|:---|
| `reporting_year` | int | `context.year` |
| `reporting_half` | int | `1` or `2` |
| `half_label` | string | `context.halfLabel` |
| `employee_key` | string | `employeeKey` (내부 키; PII 아님) |
| `employee_code` | string | nullable |
| `employee_name` | string | |
| `period_label` | string | 반기 내 급여 월 요약 |
| `gross_pay_krw` | int | |
| `withholding_tax_krw` | int | Σ `incomeTaxKrw` |
| `preparation_status` | string | `ready` / `needs_review` / `missing_months` / `profile_incomplete` |
| `ready_for_handoff` | boolean | `status === 'ready'` |

**PII:** 주민등록번호 컬럼 **없음**. 사무소가 SC 첨부 또는 별도 수집.

### 5.5 `payment-statements/year-end-prep.csv`

소스: `yearEnd[]` (정산액 없음).

| Column | Type | Source |
|:---|:---|:---|
| `reporting_year` | int | |
| `employee_key` | string | |
| `employee_code` | string | nullable |
| `employee_name` | string | |
| `employee_status` | string | `active` / `leave` / `terminated` |
| `annual_gross_pay_krw` | int | nullable |
| `annual_withholding_tax_krw` | int | nullable |
| `preparation_status` | string | `YearEndStatus` |
| `missing_label` | string | |

### 5.6 `local-income-tax/lines.csv`

소스: `loadLocalIncomeTaxSummary` → `rows[]`.

| Column | Type | Source |
|:---|:---|:---|
| `filing_period_key` | string | |
| `employee_code` | string | nullable |
| `employee_name` | string | |
| `gross_pay_krw` | int | |
| `income_tax_krw` | int | |
| `local_income_tax_krw` | int | |
| `line_status` | string | `ready` / `needs_review` / `closed` |
| `included_in_totals` | boolean | |

### 5.7 `business-status/summary.csv`

소스: `loadBusinessStatusReportSummary` — `tax_exempt` applicable만.

| Column | Type | Source |
|:---|:---|:---|
| `fiscal_year` | int | |
| `revenue_total_krw` | int | `hero.revenueTotalKrw` |
| `expense_total_krw` | int | expense 합 |
| `attention_count` | int | |
| `preparation_percent` | int | `hero.preparationPercent` |
| `handoff_item` | string | `handoffRows[].item` |
| `handoff_value` | string | |
| `handoff_status` | string | `준비 완료` / `확인 필요` / `사용자 직접` |

long format: handoff 행마다 1 CSV row (동일 fiscal_year 반복).

## 6. Export Readiness and Validation Gating

### 6.1 트랙별 export blocker (v1)

| Track | Blocking 조건 |
|:---|:---|
| `withholding` | 급여 period 없음 · `payroll.closeStatus !== 'closed'` · `issueCount > 0` · filing item `locked` |
| `vat` | not applicable · `pendingDeductionCount > 0` |
| `payment_statement` | simplified 중 `status !== 'ready'` 1명 이상 |
| `local_income` | `attentionCount > 0` |
| `business_status` | not applicable · `attentionCount > 0` |

### 6.2 JC-030 Validation (plain SC 첨부 시)

- `includePlainSimplifiedWageFile === true` 일 때만 `employeePii`·submission meta 수신.
- `lib/efiling-simplified-wage/validate.ts` — `hasBlockingIssues` true면 **전체 export 400**.
- SC 첨부 없이 ZIP만 export할 때는 PII 입력 단계 **생략**.

### 6.3 inapplicable track

- 사용자가 선택했으나 `isTrackApplicable === false` → export 요청 **400** (UI에서 미리 disable).
- manifest에는 `skipped`로 남기지 않고 **요청 tracks에서 제외** (혼동 방지).

## 7. API Contract

### `POST /api/filing-preparation/giwa-handoff/export`

**Request (Zod):**

```typescript
export const giwaHandoffExportRequestSchema = z.object({
  tracks: z.array(giwaHandoffTrackIdSchema).min(1),
  periodContext: z.object({
    payrollPeriodKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    vatPeriodKey: z.string().optional(),
    paymentStatementYear: z.number().int().min(2020).max(2100),
    paymentStatementHalf: z.union([z.literal(1), z.literal(2)]),
    businessStatusFiscalYear: z.number().int().optional(),
  }),
  recipient: z.object({
    firmName: z.string().min(1).max(100),
    deliveryMode: z.literal('manual_download'),
  }),
  attachments: z
    .object({
      includePlainSimplifiedWageFile: z.boolean(),
    })
    .default({ includePlainSimplifiedWageFile: false }),
  simplifiedWageExport: z
    .object({
      taxOfficeCode: z.string().regex(/^\d{3}$/),
      contactDepartment: z.string().max(30).optional(),
      contactName: z.string().max(30),
      contactPhone: z.string().max(15),
      hometaxId: z.string().max(20).optional(),
      representativeId: z.string().optional(),
      employeePii: z.record(
        z.string(),
        z.object({ residentId: z.string().length(13) }),
      ),
    })
    .optional(),
  confirmation: z.object({
    acknowledgedResponsibility: z.literal(true),
    acknowledgedNoAutoSubmit: z.literal(true),
    acknowledgedExistingFirmOnly: z.literal(true),
  }),
})
```

**Cross-field rules:**

- `tracks`에 `withholding` 또는 `local_income` 포함 → `payrollPeriodKey` 필수
- `tracks`에 `vat` 포함 → `vatPeriodKey` 필수
- `attachments.includePlainSimplifiedWageFile` → `simplifiedWageExport` 필수 · `payment_statement` 트랙 포함 필수

**Response:**

- `200` — `application/zip`; `Content-Disposition: attachment`; body는 ZIP 스트림
- `400` — `{ errors: ExportBlocker[] }` — 트랙·검증·Zod 실패
- `403` — tenant 권한 없음

**금지:** response body에 PII echo · ZIP 서버 저장 · 생성 파일 URL 재발급 (v1).

### 7.1 Export summary read (optional GET)

`GET /api/filing-preparation/giwa-handoff/summary?period=...` — 패널 초기 로드용.

- 선택 가능 트랙·applicable·blocker preview·기본 period 제안
- mutation 없음

## 8. Audit Log

신규 테이블 `filing_handoff_export_log` (메타만):

| Column | Type | Note |
|:---|:---|:---|
| `id` | text PK | uuid |
| `tenant_id` | text FK | |
| `client_id` | text FK | |
| `exported_by_user_id` | text | |
| `exported_at` | text ISO | Luxon now |
| `track_ids_json` | text | `string[]` JSON |
| `period_context_json` | text | 요청 period (PII 없음) |
| `recipient_firm_name` | text | |
| `delivery_mode` | text | `manual_download` |
| `blocking_error_count` | int | export 성공 시 0 |
| `warning_count` | int | |
| `included_attachment_kinds_json` | text | 예: `["plain_simplified_wage_sc"]` |
| `package_manifest_version` | text | `1.0` |

로그·에러 리포트에 주민번호·ZIP 바이트 hash 외 파일 내용 **기록 금지**.

## 9. UI Copy (Preview 계약)

| 요소 | 문구 |
|:---|:---|
| 패널 제목 | 사무소 전달 패키지 Export (Path 2) |
| CTA | ZIP 다운로드 |
| 확인 체크 | 수임 세무사무소에 전달할 패키지임을 확인했습니다 |
| 확인 체크 | SemuAgent가 홈택스에 제출하지 않음을 이해했습니다 |
| 확인 체크 | 기존 수임 사무소 전달용이며 알선·마켓플레이스가 아님을 이해했습니다 |
| 사무소명 | 수신 세무사무소명 (필수) |
| blocker | blocker N건 — … 해결 전 Export 차단 |
| footer | Path 2 책임 경계 — 패키지·검증까지. 제출은 수임 사무소·검정 SW. |

**금지 문구:** `국세청 검증 완료`, `제출 보장`, `자동 신고`, `대행`, `알선`, `세무대리인 추천`

## 10. README-handoff.txt Template

고정 템플릿 + manifest 값 치환:

```text
SemuAgent — 사무소 전달 패키지 (Filing Path 2)
생성일: {generatedAt}
사업자: {businessName} ({businessRegistrationNumber})
수신: {recipient.firmName}

[SemuAgent가 한 일]
- 선택한 신고 트랙의 확정 준비 데이터를 CSV로 정리했습니다.
- 사전검증 요약: blocking {blockingErrorCount}건, warning {warningCount}건

[SemuAgent가 하지 않은 일]
- 홈택스·위택스 제출, 대리 제출, 국세청 적합성 검정(Path 3)

[세무사무소 후속 작업]
1. 자료기와(JARYO-GIWA) 또는 내부 절차로 본 ZIP을 검토하세요.
2. 검정 전자신고 SW로 신고 파일을 작성·제출하세요.
3. 최종 세액·신고 책임을 확인하세요.

manifest.json과 CSV 컬럼 정의: SemuAgent JC-034 schemaVersion 1.0
```

## 11. QA Scenarios (v1)

| # | Scenario | Expected |
|:---:|:---|:---|
| Q1 | tenant A 데이터로 export | tenant B 행 없음 |
| Q2 | 부가세 `pendingDeductionCount > 0` | 400 + blocker |
| Q3 | 간이지급 `profile_incomplete` 1명 | 400 + blocker |
| Q4 | 면세 사업자 + vat 트랙 선택 | UI disable 또는 400 |
| Q5 | business_status + 법인 | not applicable |
| Q6 | 최소 3트랙 + 확인 체크 | ZIP + manifest Zod pass |
| Q7 | plain SC opt-in + PII 누락 | 400 JC-030 validation |
| Q8 | export 성공 | `filing_handoff_export_log` 1행, PII 없음 |
| Q9 | ZIP 내 CSV | UTF-8 BOM, 헤더 일치 |
| Q10 | 서버 | ZIP bytes 미보관 |

## 12. Implementation Slices

| Slice | 내용 |
|:---|:---|
| **1** | `schemas.ts` + manifest/CSV pure builders + tests |
| **2** | `validate-export.ts` + summary read model |
| **3** | export API + audit log migration |
| **4** | 신고 준비 UI 패널 + GET summary |
| **5** | optional plain SC attachment path |

## 13. Related Documents

- **Concept_Design**: [Product Baseline §3](../01_Concept_Design/01_PRODUCT_BASELINE.md)
- **Concept_Design**: [Filing Preparation Pipeline](../01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md)
- **Technical_Specs**: [JC-034 Scope Gate](./34_JC034_GIWA_HANDOFF_PACKAGE_SCOPE_GATE.md)
- **Technical_Specs**: [JC-030 Pre-Code Brief](./30_JC030_EFILING_FILE_PRE_CODE_BRIEF.md)
- **Technical_Specs**: [JC-030 PII Policy](./27_JC030_EFILING_FILE_PII_POLICY.md)
- **Technical_Specs**: [Payment Statement Brief](./16_PAYMENT_STATEMENT_YEAR_END_PRE_CODE_BRIEF.md)
- **UI_Screens**: [08_filing_preparation.html](../02_UI_Screens/previews/08_filing_preparation.html)
- **Logic_Progress**: [Backlog JC-034](../04_Logic_Progress/00_BACKLOG.md)
