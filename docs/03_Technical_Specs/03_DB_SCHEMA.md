# DB Schema (Company-context Adaptation)
> Created: 2026-07-01 22:40
> Last Updated: 2026-07-02 14:21

## 1. 목적 및 범위

JARYO Company의 데이터 모델을 정의한다. 실제 GIWA에서 상속된 앱 스키마
`lib/db/schema.ts`(56개 테이블)와 Auth 스키마 `lib/db/auth-schema.ts`(7개 테이블)를
**회사 셀프사용 컨텍스트**로 재정의하는 설계 스펙이다.

이 문서는 설계/매핑 기준이며, 실제 Drizzle 스키마 수정·마이그레이션은 순차 구현 PR에서 수행한다.
6개 승인 화면(회사 홈·자료수집·기장검토·부가세·급여·신고지원)이 요구하는 데이터가 기준이다.

## 2. 핵심 모델 결정

### 2.1 `client` → `business_entity`(사업장)로 재정의

GIWA에서 `client`는 세무사무소의 "고객사"였다. JARYO Company에서는 회사가 자기 자신의 회계를
운영하므로 외부 고객사가 없다. `client`를 **회사가 운영하는 사업장(business entity)** 으로 재정의한다.

```
tenant (로그인 주체 = 회사/대표)
  └─ business_entity (사업장, 1..N)   ← 기존 client 테이블 재정의
        ├─ 자료수집 (upload_session / upload_file)
        ├─ 기장/전표 (bookkeeping_*)
        ├─ 부가세 자료 (신규: vat_*)
        ├─ 급여/직원 (payroll_*)
        └─ 신고 항목 (신규: filing_*)
```

- `clientId` → `businessEntityId` 개념 전환. 전체 도메인 테이블이 이 키를 유지하므로 구조·GIWA 코드 최대 재사용.
- 초기에는 tenant당 사업장 1개로 시작하되, 스키마는 1..N을 허용한다(대표가 여러 사업체를 운영하는 경우 대응).
- `staffId`(담당 배정)는 회사 내부 담당자 배정으로 의미 전환(세무사무소 담당자 → 회사 내부 담당자). 외부 세무사 검토자는 v1 제외.

### 2.2 이메일 요청·수신함 서브시스템 v1 제외

회사가 스스로 자료를 수집하므로, 사무소가 고객사에 자료를 *요청*하는 이메일 흐름은 v1에서 제외한다.
(앞선 "외부 업로드 포털 제외" 결정과 일관.)

**v1 제외(테이블은 상속되어 있으나 스키마 문서·구현 범위에서 비활성/제외):**
`request_template` · `client_request_schedule` · `client_request_event` ·
`outbound_email` · `outbound_send_lock` · `inbound_email` · `inbound_email_attachment` ·
`staff_mailbox` · `staff_mailbox_assignment_history` · `client_cc_group` · `internal_cc_group`

### 2.3 결정 배경 링크
- [[manage-decisions]] 기준의 아키텍처 결정. 대안(self 단일 레코드 / client 제거 후 tenant 재키잉)은
  각각 사업장 복수 불가, 대규모 재작성 리스크로 기각.

## 3. 도메인별 테이블 매핑 (화면 → 기존 테이블)

| 화면 | 재사용 테이블(재정의) | 상태 |
|:---|:---|:---|
| 공통/조직 | `tenant`, `staff`, auth(`user`/`session`/`account`/`organization`/`member`/`invitation`) | 재사용 |
| 사업장 | `business_entity`(←`client`), `client_document`(←사업장 문서), `client_checklist`·`checklist_template`·`checklist_item`(수집 항목 정의) | 재정의 |
| 자료수집 | `upload_session`, `upload_file`, `upload_item_declaration`, `request_item_validation`·`request_item_validation_file`(수집 검증) | 재사용 |
| 기장검토 | `bookkeeping_material_attribution`, `bookkeeping_classification_run`, `bookkeeping_transaction_classification`, `bookkeeping_transaction_purpose_request(_row)`, `bookkeeping_journal_entry_run/row/voucher/voucher_line`, `bookkeeping_fiscal_year_ledger`, `bookkeeping_ledger_month`, `analysis_run`, `material_match` | 재사용 |
| 급여 | `payroll_excel_template`, `client_payroll_rule_profile(_source)`, `payroll_rule_profile_application`, `payroll_extraction_batch`, `payroll_extraction_row`, `payroll_excel_draft` + 아래 4.2 신규 | 재사용 + 신규 필요 |
| 부가세 | (기존 전용 테이블 없음 — 아래 4.1 신규) | 신규 필요 |
| 신고지원 | (기존 전용 테이블 없음 — 아래 4.3 신규) | 신규 필요 |
| 인프라/부가 | `audit_proof`, `cron_run`, `consultation_source_cache`, `adaptive_structure_model(_run)`, `review_attribution_saved_prompt` | 재사용 |
| 결제(SaaS) | `billing_*`, `tenant_billing_profile`, `tenant_subscription` | 유지(테넌트 SaaS 과금, MVP UI 범위 밖) |

## 4. 신규 테이블 (설계 초안 — 화면 게이트에서 순차 확정)

부가세·급여·신고지원 화면은 기존 추출/전표 테이블만으로는 사용자 판정·마감·패키지 상태를
안정적으로 표현하기 어렵다. 부가세 4.1은 JC-011 구현에서 물리 적용했고, 급여 4.2는
JC-012 게이트에서 논리 컬럼을 확정했다. 신고지원 4.3은 JC-013 게이트에서 구체화한다.

### 4.1 부가세 (VAT) — JC-011 물리 스키마 적용

JC-011 구현은 아래 두 테이블을 `lib/db/schema.ts`와
`drizzle/0053_add_vat_tables.sql`에 추가한 뒤 진행한다. 물리 컬럼명은 snake_case,
코드 타입은 camelCase를 따른다.

#### `vat_period_summary`

사업장·부가세 기간별 세액/패키지 상태 스냅샷.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id` | tenant + business_entity 범위 |
| `period_key`, `period_start_month`, `period_end_month`, `filing_type` | 예: `2026-H1`, `2026-01`~`2026-06`, `final` |
| `taxable_supply_krw`, `taxable_output_tax_krw` | 과세 매출 공급가액·매출세액 |
| `zero_rated_supply_krw` | 영세율 매출 공급가액 |
| `exempt_supply_krw` | 면세 매출 공급가액 |
| `output_tax_krw`, `input_tax_krw`, `input_tax_deductible_krw`, `payable_tax_krw` | 세액 요약 |
| `pending_deduction_count`, `is_final` | 검토 대기·예정/확정 |
| `package_status`, `package_storage_key`, `generated_at` | 신고 패키지 생성 상태(제출/납부 아님) |
| `created_at`, `updated_at` | 감사·동기화 |

#### `vat_deduction_review`

매입 거래/전표별 공제 판정 상태.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id`, `period_key` | 범위 |
| `source_voucher_id`, `source_voucher_line_id`, `classification_row_id` | 원천 전표/거래 추적 |
| `description`, `counterparty`, `supply_amount_krw`, `input_tax_krw` | 화면 표시 스냅샷 |
| `kind` | `deductible` / `non_deductible_candidate` / `proration_required` |
| `decision` | `pending` / `deductible` / `non_deductible` / `prorated` |
| `reason`, `proration_rate_bps` | 판정 근거와 안분율 |
| `confirmed_by_staff_id`, `confirmed_at` | 사용자 확정 |
| `created_at`, `updated_at` | 감사·동기화 |

매출 구분(과세/영세율/면세)은 현재 전표 라인만으로 안정적으로 복원할 수 없으므로
`vat_period_summary` snapshot에 저장한다. 향후 거래/전표에 세무 구분 태그가 추가되면
파생 방식으로 전환할 수 있다.

### 4.2 급여 (Payroll) — JC-012 게이트에서 물리 스키마 필요

기존 `payroll_extraction_row`는 업로드/AI 추출 후보이고, Preview의 마감 가능한 급여대장과
4대보험 고지액 매칭 상태를 담기에는 컬럼이 부족하다. JC-012 구현은 아래 테이블을
`lib/db/schema.ts`와 신규 migration에 추가한 뒤 진행한다.

#### `payroll_period_summary`

사업장·귀속월별 급여 요약과 마감 상태.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id` | tenant + business_entity 범위 |
| `payroll_period`, `payment_date` | 예: `2026-06`, 지급일 |
| `employee_count`, `issue_count` | 직원 수·확인 필요 건수 |
| `gross_pay_krw`, `withholding_tax_krw`, `social_insurance_krw`, `deduction_total_krw`, `net_pay_krw` | 급여 요약 |
| `notice_import_status` | 4대보험 고지내역 상태(`missing`/`partial`/`matched`) |
| `close_status`, `closed_by_staff_id`, `closed_at` | 급여 마감 |
| `payslip_status`, `withholding_statement_status`, `insurance_statement_status` | 급여명세서·지급명세서·4대보험 자료 상태 |
| `created_at`, `updated_at` | 감사·동기화 |

#### `payroll_employee_line`

직원별 급여대장 실행 결과. 금액은 화면과 신고지원의 source of truth.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id`, `period_summary_id` | 범위 |
| `source_batch_id`, `source_row_id`, `upload_session_id` | 추출 원천 |
| `employee_code`, `employee_name`, `department`, `job_title`, `job_type` | 표시 최소 직원 정보 |
| `base_salary_krw`, `allowance_krw`, `gross_pay_krw` | 지급 |
| `income_tax_krw`, `local_income_tax_krw` | 원천세 |
| `national_pension_krw`, `health_insurance_krw`, `long_term_care_krw`, `employment_insurance_krw` | 4대보험 근로자 부담액 |
| `social_insurance_krw`, `deduction_total_krw`, `net_pay_krw` | 공제·실지급 |
| `notice_match_status`, `notice_line_id` | 고지액 매칭 |
| `status`, `issue_code`, `issue_message` | 확인 필요·준비·마감 |
| `edited_by_staff_id`, `edited_at`, `created_at`, `updated_at` | 감사·동기화 |

#### `payroll_insurance_notice_import`

건강보험 EDI/사회보험 고지내역 파일 또는 수동 입력 묶음. 자격증명은 저장하지 않는다.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id`, `payroll_period` | 범위 |
| `source_type` | `nhis_edi` / `social_insurance_portal` / `manual` |
| `original_filename`, `storage_key`, `file_hash` | 원본 추적(private storage key는 UI 미노출) |
| `status`, `imported_by_staff_id`, `imported_at` | 처리 상태 |

#### `payroll_insurance_notice_line`

고지내역의 직원별 보험료 라인. 주민등록번호 원문은 저장하지 않고 매칭 해시만 사용한다.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id`, `notice_import_id` | 범위 |
| `employee_code`, `employee_name`, `match_key_hash` | 직원 매칭 |
| `national_pension_krw`, `health_insurance_krw`, `long_term_care_krw`, `employment_insurance_krw` | 고지된 직원 부담액 |
| `match_status`, `matched_employee_line_id` | 매칭 결과 |
| `created_at`, `updated_at` | 감사·동기화 |

### 4.3 신고지원 (Filing Support)
- `filing_item` — 사업장·기간·신고종류(부가세/원천세/4대보험)별 패키지 상태(준비됨/대기/확인필요).
- `filing_receipt` — 제출 접수증 보관(사용자 업로드, Vercel Blob storage key).
- `filing_checklist_item` — 사후 체크리스트 항목·완료 상태.
- 자동 홈택스 제출·자격증명 저장은 **비범위**(Product Baseline MVP Non-Scope).

## 5. 명명·마이그레이션 방침 (JC-005에서 실행)

- 물리 테이블명 즉시 rename(`client` → `business_entity`)은 마이그레이션·코드 영향이 크다.
  **개념/타입 레이어부터 전환**하고, 물리 rename 여부·시점은 JC-005 마이그레이션 설계에서 결정한다.
- `tenant_id` + `business_entity_id` 복합 스코프를 모든 도메인 쿼리의 기준으로 유지(테넌트 격리).
- 개인정보(급여·주민정보): 저장 시 최소 수집·마스킹·감사로그 방침을 급여(JC-012) 전제조건과 함께 확정.
- 홈택스/은행/카드/인증서 자격증명은 서버 저장하지 않는다(Product Baseline).

## 6. 구현 상태 및 미결(JC-005 구현 단계 확정 대상)
- 완료: 부가세 신규 테이블의 물리 Drizzle migration·인덱스·FK는 JC-011 구현 PR에서 `0053_add_vat_tables.sql`로 적용.
- 설계 완료: 급여 신규 테이블의 논리 컬럼은 [Payroll Pre-Code Brief](./08_PAYROLL_PRE_CODE_BRIEF.md)에서 확정. 구현 PR에서 물리 migration 적용 예정.
- 미결: `business_entity` 물리 rename 여부 및 마이그레이션 순서.
- 미결: 신고지원 신규 테이블의 정확한 컬럼·인덱스·FK.
- 미결: 과세기간(부가세 1기/2기·예정/확정) 표현 모델과 급여 귀속월·전표 기간의 정합.
- 미결: v1 제외 이메일 서브시스템 테이블의 물리 처리(보존/드롭).

## 7. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 사용자 정의(company=tenant), MVP 비범위
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 6개 화면 데이터 입출력(스키마 요구사항)
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 화면별 표시/저장 데이터
- **Technical_Specs**: [Development Setup](./01_DEVELOPMENT_SETUP.md) - Drizzle/Turso 스택
- **Technical_Specs**: [Component & Library Plan](./02_COMPONENT_LIBRARY_PLAN.md) - 화면 컴포넌트(데이터 소비처)
- **Technical_Specs**: [VAT Pre-Code Brief](./07_VAT_PRE_CODE_BRIEF.md) - 부가세 신규 테이블·read model 구현 계약
- **Technical_Specs**: [Payroll Pre-Code Brief](./08_PAYROLL_PRE_CODE_BRIEF.md) - 급여 신규 테이블·고지액 매칭 구현 계약
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-005(데이터 모델) 및 JC-006~013 착수 전제조건
