# DB Schema (Company-context Adaptation)
> Created: 2026-07-01 22:40
> Last Updated: 2026-07-03 03:02

## 1. 목적 및 범위

세무데스크의 데이터 모델을 정의한다. 실제 GIWA에서 상속된 앱 스키마
`lib/db/schema.ts`(56개 테이블)와 Auth 스키마 `lib/db/auth-schema.ts`(7개 테이블)를
**회사 셀프사용 컨텍스트**로 재정의하는 설계 스펙이다.

이 문서는 설계/매핑 기준이며, 실제 Drizzle 스키마 수정·마이그레이션은 순차 구현 PR에서 수행한다.
6개 승인 화면(회사 홈·자료수집·기장검토·부가세·급여·신고지원)이 요구하는 데이터가 기준이다.

## 2. 핵심 모델 결정

### 2.1 `client` → `business_entity`(사업장)로 재정의

GIWA에서 `client`는 세무사무소의 "고객사"였다. 세무데스크에서는 회사가 자기 자신의 회계를
운영하므로 외부 고객사가 없다. `client`를 **회사가 운영하는 사업장(business entity)** 으로 재정의한다.

```
tenant (로그인 주체 = 회사/대표)
  └─ business_entity (사업장, 1..N)   ← 기존 client 테이블 재정의
        ├─ 자료수집 (upload_session / upload_file)
        ├─ 기장/전표 (bookkeeping_*)
        ├─ 부가세 자료 (신규: vat_*)
        ├─ 급여/직원 (payroll_*)
        ├─ 신고 항목 (신규: filing_*)
        ├─ 직원 명부 (신규 후보: employee_profile)
        └─ 내부 리마인드 (신규 후보: internal_reminder_*)
```

- `clientId` → `businessEntityId` 개념 전환. 전체 도메인 테이블이 이 키를 유지하므로 구조·GIWA 코드 최대 재사용.
- 초기에는 tenant당 사업장 1개로 시작하되, 스키마는 1..N을 허용한다(대표가 여러 사업체를 운영하는 경우 대응).
- `staffId`(담당 배정)는 회사 내부 담당자 배정으로 의미 전환(세무사무소 담당자 → 회사 내부 담당자). 외부 세무사 검토자는 v1 제외.
- **물리 rename 결정(2026-07-03, JC-005)**: 물리 테이블명은 `client`로 **유지**한다(개념만 business_entity). `client`는 앱·API·FK에 걸쳐 약 274개 파일이 참조하므로 물리 rename(`client`→`business_entity`)은 대규모·고위험 마이그레이션 대비 v1 실익이 낮다. 제품/UI 레이어는 이미 "사업장"으로 표기(JC-004 완료)하고, `businessEntityId`는 개념 명칭으로만 사용한다. 물리 rename은 다중 사업장 운영이 실제 필요해질 때 별도 마이그레이션으로 재검토한다.

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

### 2.4 기간 표현 모델 (도메인별 canonical, JC-005 확정)

기간은 **단일 통합 키로 강제하지 않고** 도메인 성격에 맞게 표현한다(부가세는 반기, 급여는 월). 이는 의도된 설계다 — 부가세 과세기간은 반기, 급여 귀속월은 월 단위라 통합 시 오히려 왜곡된다.

| 도메인 | 키 | 형식 | 검증 |
|:---|:---|:---|:---|
| 부가세·신고지원 과세기간 | `period_key` / `filing_period_key` | `YYYY-H1` / `YYYY-H2` (반기) | `^20\d{2}-H[12]$` |
| 급여 귀속월 | `payroll_period` | `YYYY-MM` (월) | `^20\d{2}-(0[1-9]\|1[0-2])$` |
| 회사 홈 기본 컨텍스트 | `periodKey` | `YYYY-H[12]`(또는 `Q1-4`) | company-home normalize |
| 전표·장부 기간 | `fiscal_year` + `ledger_month` / `accounting_period` | 회계연도 + 월 | bookkeeping ledger |

- 신고지원은 부가세 반기와 급여 귀속월을 함께 다루므로 `filing_item`이 `filing_period_key`(반기) + `payroll_period_key`(월) **dual key**로 브리지한다.
- 각 도메인 검증은 자기 validation 스키마(`lib/validations/*`)에서 수행하며 단일 통합 스키마는 두지 않는다.

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
| 직원 명부 | (기존 전용 직원 마스터 없음 — 아래 4.4 신규 후보) | 신규 필요 |
| 내부 리마인드 | (GIWA 이메일 요청 테이블은 v1 제외 — 아래 4.5 신규 후보) | 신규 필요 |
| 인프라/부가 | `audit_proof`, `cron_run`, `consultation_source_cache`, `adaptive_structure_model(_run)`, `review_attribution_saved_prompt` | 재사용 |
| 결제(SaaS) | `billing_*`, `tenant_billing_profile`, `tenant_subscription` | 유지(테넌트 SaaS 과금, MVP UI 범위 밖) |

## 4. 신규 테이블 (설계 초안 — 화면 게이트에서 순차 확정)

부가세·급여·신고지원 화면은 기존 추출/전표 테이블만으로는 사용자 판정·마감·패키지 상태를
안정적으로 표현하기 어렵다. 부가세 4.1은 JC-011 구현에서 물리 적용했고, 급여 4.2는
JC-012 구현에서 물리 적용했다. 신고지원 4.3은 JC-013 구현에서 물리 적용했다.
직원 명부 4.4와 내부 리마인드 4.5는 후속 게이트(JC-015/JC-016)에서 논리 초안을 먼저 확정한다.

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
- `filing_item` — 사업장·기간·신고종류(부가세/원천세/4대보험)별 패키지 상태(준비됨/대기/확인필요/제출기록).
- `filing_receipt` — 제출 접수증 보관(사용자 업로드, Vercel Blob private storage key).
- `filing_checklist_item` — 사후 체크리스트 항목·완료 상태.
- 자동 홈택스 제출·자격증명 저장은 **비범위**(Product Baseline MVP Non-Scope).

#### `filing_item`

부가세·원천세·4대보험 신고 항목의 상태 스냅샷. 선행 화면 산출물 상태를 읽어 화면에 표시하고,
사용자가 직접 신고한 뒤 접수증/체크리스트와 연결한다.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id` | tenant + businessEntity 범위 |
| `filing_period_key`, `payroll_period_key` | 부가세 신고 기간과 급여 귀속월 연결 |
| `item_type` | `vat` / `withholding` / `social_insurance` |
| `source_module`, `source_ref_id` | `vat_period_summary` 또는 `payroll_period_summary` 추적 |
| `title`, `description` | 화면 표시 스냅샷 |
| `status` | `locked` / `ready` / `needs_review` / `submitted` |
| `package_status` | `locked` / `ready` / `generated` / `submitted` |
| `lock_reason` | 잠금 사유(부가세 공제 검토, 급여 미마감 등) |
| `package_storage_key`, `generated_at` | 내부 패키지 저장 상태(private key는 UI 미노출) |
| `submitted_at` | 회사가 직접 제출했다고 기록한 시각 |
| `created_at`, `updated_at` | 감사·동기화 |

권장 인덱스: unique(`tenant_id`, `client_id`, `filing_period_key`, `item_type`),
index(`tenant_id`, `client_id`, `status`), index(`tenant_id`, `client_id`, `package_status`).

#### `filing_receipt`

홈택스/EDI 제출 후 사용자가 업로드한 접수증. 시스템은 제출을 대행하지 않고, 접수증 파일과 보관 상태만 기록한다.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id`, `filing_item_id` | 범위와 신고 항목 연결 |
| `receipt_type` | `hometax_receipt` / `payment_receipt` / `insurance_receipt` |
| `original_filename`, `storage_key`, `file_hash` | 원본 추적(private storage key는 UI 미노출) |
| `uploaded_by_staff_id`, `uploaded_at` | 사용자 업로드 감사 |
| `created_at`, `updated_at` | 감사·동기화 |

권장 인덱스: index(`tenant_id`, `client_id`, `filing_item_id`),
index(`tenant_id`, `client_id`, `receipt_type`).

#### `filing_checklist_item`

납부 확인·접수증 보관 같은 사후 체크리스트. 완료 상태는 내부 확인용이며, 실제 제출·납부 수행을 의미하지 않는다.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id`, `filing_period_key` | 범위 |
| `filing_item_id` | 특정 신고 항목 연결(공통 항목은 null 허용) |
| `code`, `label`, `description`, `sort_order` | 체크리스트 정의 |
| `completed`, `completed_by_staff_id`, `completed_at` | 완료 상태 |
| `created_at`, `updated_at` | 감사·동기화 |

권장 인덱스: unique(`tenant_id`, `client_id`, `filing_period_key`, `code`),
index(`tenant_id`, `client_id`, `completed`).

### 4.4 직원 명부 (Employee Directory) — JC-015 논리 설계 초안

기존 `payroll_employee_line`은 귀속월별 급여 실행 결과이며 상시 직원 마스터가 아니다.
직원 명부는 급여·4대보험 고지액 매칭·내부 리마인드의 기준 데이터로 별도 관리한다.

#### `employee_profile`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id` | tenant + businessEntity 범위 |
| `employee_code` | 사번 또는 내부 식별자 |
| `display_name` | 화면 표시 이름 |
| `department`, `job_title` | 조직 정보 |
| `employee_status` | `active` / `leave` / `terminated` |
| `payroll_eligibility` | 급여 대상 여부 |
| `insurance_enrollment_status` | 4대보험 확인 상태 |
| `hire_date`, `termination_date` | 입퇴사 기준 |
| `work_email` | 내부 리마인드 수신 후보 |
| `notification_enabled` | 내부 알림 수신 허용 |
| `created_by_staff_id`, `updated_by_staff_id` | 감사 |
| `created_at`, `updated_at` | 감사·동기화 |

권장 인덱스: unique(`tenant_id`, `client_id`, `employee_code`),
index(`tenant_id`, `client_id`, `employee_status`),
index(`tenant_id`, `client_id`, `payroll_eligibility`).

개인정보 경계: 주민등록번호·계좌번호·전화번호 원문 저장은 v1 기본 범위에서 제외한다.
필요 시 별도 개인정보/암호화 설계와 QA를 선행한다.

### 4.5 내부 리마인드 메일 (Internal Reminder Mail) — JC-016 물리 구현

내부 리마인드는 회사 내부 staff에게 업무 마감과 확인 필요 상태를 알리는 기능이다. v1 수신자는 담당자 본인·내부 staff이며, 직원 명부 기반 직원 수신은 후속이다.
GIWA의 고객사 자료 요청 메일 테이블(`request_template`, `client_request_schedule`,
`client_request_event`, `outbound_email`, `inbound_email`, `staff_mailbox`)은 v1 리마인드 도메인 모델로 재사용하지 않는다.

#### `internal_reminder_rule`

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id` | tenant + businessEntity 범위 |
| `domain` | `source_collection` / `bookkeeping_review` / `vat` / `payroll` / `filing_support` |
| `trigger_type` | `deadline_offset` / `daily_digest` / `manual` |
| `offset_days` | D-7/D-3/D-1 같은 마감 기준 |
| `enabled` | 활성 여부 |
| `recipient_source` | `staff` / `employee_directory` / `mixed` |
| `subject_template`, `body_template` | 템플릿. 민감정보 원문 삽입 금지 |
| `created_by_staff_id`, `updated_by_staff_id` | 감사 |
| `created_at`, `updated_at` | 감사·동기화 |

#### `internal_reminder_recipient_override`

규칙별 예외 수신자만 저장한다. v1 UI/API는 기본 staff 수신만 열고, 직원 명부 기반 직원 수신과 직접 이메일 override는 후속 정책 확정 전까지 닫아 둔다.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id`, `rule_id` | 범위와 규칙 연결 |
| `recipient_type` | `staff` / `employee` / `email` |
| `staff_id`, `employee_id` | 내부 수신자 연결 |
| `email_hash`, `email_label` | 직접 이메일 입력 시 원문 최소화와 표시 라벨 |
| `enabled` | 예외 수신자 활성 여부 |
| `created_at`, `updated_at` | 감사·동기화 |

#### `internal_reminder_send_log`

발송 결과와 중복 방지 상태를 저장한다.

| 컬럼 | 목적 |
|:---|:---|
| `id`, `tenant_id`, `client_id` | 범위 |
| `rule_id` | 규칙 연결. 수동 발송은 null 가능 |
| `domain`, `context_key` | 업무 영역과 중복 방지 대상 |
| `recipient_type`, `recipient_ref_id`, `recipient_label` | 수신자 표시와 감사 |
| `idempotency_key` | 같은 조건 중복 발송 방지 |
| `status` | `queued` / `sent` / `failed` / `skipped` |
| `provider_message_id` | Resend 등 provider 응답 |
| `error_message` | 실패 사유 |
| `queued_at`, `sent_at` | 발송 시각 |
| `created_at`, `updated_at` | 감사·동기화 |

권장 인덱스: unique(`tenant_id`, `client_id`, `idempotency_key`),
index(`tenant_id`, `client_id`, `status`), index(`tenant_id`, `client_id`, `domain`).

자동 홈택스 제출·자동 납부·외부 고객 요청 메일은 비범위다.

## 5. 명명·마이그레이션 방침 (JC-005 확정)

- 물리 테이블명 즉시 rename(`client` → `business_entity`)은 마이그레이션·코드 영향이 크다.
  JC-005에서는 물리명 `client`/`client_id`를 유지하고, 제품·문서·타입 의미만 `business_entity`/`businessEntityId`로 전환한다.
  물리 rename은 다중 사업장 운영이 실제로 필요해질 때 별도 migration으로 재검토한다.
- 물리 쿼리 스코프는 `tenant_id` + `client_id`를 기준으로 유지한다. 단, 문서·read model·UI에서는 `client_id`를 개념상 `businessEntityId`로 해석한다(테넌트 격리).
- 개인정보(급여·주민정보): 저장 시 최소 수집·마스킹·감사로그 방침은 급여(JC-012) 구현에서 반영했다.
- 홈택스/은행/카드/인증서 자격증명은 서버 저장하지 않는다(Product Baseline).

## 6. 구현 상태 및 후속 범위
- 완료: 부가세 신규 테이블의 물리 Drizzle migration·인덱스·FK는 JC-011 구현 PR에서 `0053_add_vat_tables.sql`로 적용.
- 완료: 급여 신규 테이블의 물리 Drizzle migration·인덱스·FK는 JC-012 구현 PR에서 `0054_add_payroll_workspace_tables.sql`로 적용.
- 구현 완료: 신고지원 신규 테이블의 논리 컬럼은 [Filing Support Pre-Code Brief](./09_FILING_SUPPORT_PRE_CODE_BRIEF.md)에서 확정했고, `0055_add_filing_support_tables.sql`로 물리 migration을 적용했다.
- 구현 완료: 직원 명부 논리 컬럼은 [Employee Directory Pre-Code Brief](./10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md)에서 확정했고, `0056_add_employee_profile.sql`로 물리 migration을 적용했다.
- 구현 완료: 내부 리마인드 메일 논리 컬럼은 [Internal Reminder Mail Pre-Code Brief](./11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md)에서 확정했고, `0057_add_internal_reminder_tables.sql`로 물리 migration을 적용했다.
- 확정: `business_entity` 물리 rename은 지연한다. v1은 물리명 `client`/`client_id`를 유지하고 개념명만 business entity로 사용한다.
- 확정: 기간 표현은 도메인별 canonical을 유지한다(부가세·신고 반기 `YYYY-H1/H2`, 급여 월 `YYYY-MM`, 전표 회계연도+월, 신고지원 dual-key 브리지).
- 후속 범위: v1 제외 이메일 서브시스템 테이블의 물리 처리(보존/드롭)는 현재 제품 노출 범위 밖이며, 즉시 migration 대상이 아니다.

## 7. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 사용자 정의(company=tenant), MVP 비범위
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 6개 화면 데이터 입출력(스키마 요구사항)
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 화면별 표시/저장 데이터
- **Technical_Specs**: [Development Setup](./01_DEVELOPMENT_SETUP.md) - Drizzle/Turso 스택
- **Technical_Specs**: [Component & Library Plan](./02_COMPONENT_LIBRARY_PLAN.md) - 화면 컴포넌트(데이터 소비처)
- **Technical_Specs**: [VAT Pre-Code Brief](./07_VAT_PRE_CODE_BRIEF.md) - 부가세 신규 테이블·read model 구현 계약
- **Technical_Specs**: [Payroll Pre-Code Brief](./08_PAYROLL_PRE_CODE_BRIEF.md) - 급여 신규 테이블·고지액 매칭 구현 계약
- **Technical_Specs**: [Filing Support Pre-Code Brief](./09_FILING_SUPPORT_PRE_CODE_BRIEF.md) - 신고지원 신규 테이블·책임 경계 구현 계약
- **Technical_Specs**: [Employee Directory Pre-Code Brief](./10_EMPLOYEE_DIRECTORY_PRE_CODE_BRIEF.md) - 직원 명부 마스터·급여/리마인드 참조 계약
- **Technical_Specs**: [Internal Reminder Mail Pre-Code Brief](./11_INTERNAL_REMINDER_MAIL_PRE_CODE_BRIEF.md) - 내부 리마인드 메일·발송 로그 계약
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-005(데이터 모델) 및 JC-006~016 착수 전제조건
