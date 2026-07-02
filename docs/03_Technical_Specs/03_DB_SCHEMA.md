# DB Schema (Company-context Adaptation)
> Created: 2026-07-01 22:40
> Last Updated: 2026-07-02 11:03

## 1. 목적 및 범위

JARYO Company의 데이터 모델을 정의한다. 실제 GIWA에서 상속된 앱 스키마
`lib/db/schema.ts`(56개 테이블)와 Auth 스키마 `lib/db/auth-schema.ts`(7개 테이블)를
**회사 셀프사용 컨텍스트**로 재정의하는 설계 스펙이다.

이 문서는 설계/매핑 기준이며, 실제 Drizzle 스키마 수정·마이그레이션은 **JC-005 구현 단계**에서 수행한다.
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
| 급여 | `payroll_excel_template`, `client_payroll_rule_profile(_source)`, `payroll_rule_profile_application`, `payroll_extraction_batch`, `payroll_extraction_row`, `payroll_excel_draft` | 재사용 |
| 부가세 | (기존 전용 테이블 없음 — 아래 4.1 신규) | 신규 필요 |
| 신고지원 | (기존 전용 테이블 없음 — 아래 4.2 신규) | 신규 필요 |
| 인프라/부가 | `audit_proof`, `cron_run`, `consultation_source_cache`, `adaptive_structure_model(_run)`, `review_attribution_saved_prompt` | 재사용 |
| 결제(SaaS) | `billing_*`, `tenant_billing_profile`, `tenant_subscription` | 유지(테넌트 SaaS 과금, MVP UI 범위 밖) |

## 4. 신규 테이블 (설계 초안 — 화면 게이트에서 순차 확정)

부가세·신고지원 화면은 기존 전용 테이블이 없다. 기장 확정 전표에서 파생 계산하되, 사용자 판정·상태를
저장할 최소 테이블이 필요하다. 부가세 4.1은 JC-011 게이트에서 논리 컬럼을 확정하고,
신고지원 4.2는 JC-013 게이트에서 구체화한다.

### 4.1 부가세 (VAT) — JC-011 게이트에서 최소 논리 컬럼 확정

현재 `lib/db/schema.ts`에는 `vat_*` 전용 테이블이 없다. JC-011 구현은 아래 두 테이블을
Drizzle schema/migration으로 추가한 뒤 진행한다. 물리 컬럼명은 snake_case, 코드 타입은
camelCase를 따른다.

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

### 4.2 신고지원 (Filing Support)
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

## 6. 미결(JC-005 구현 단계 확정 대상)
- `business_entity` 물리 rename 여부 및 마이그레이션 순서.
- 부가세 신규 테이블의 물리 Drizzle migration·인덱스·FK 적용 순서(JC-011 구현 PR). 논리 컬럼은 [VAT Pre-Code Brief](./07_VAT_PRE_CODE_BRIEF.md)와 본 문서 4.1 기준.
- 신고지원 신규 테이블의 정확한 컬럼·인덱스·FK.
- 과세기간(부가세 1기/2기·예정/확정) 표현 모델과 급여 귀속월·전표 기간의 정합.
- v1 제외 이메일 서브시스템 테이블의 물리 처리(보존/드롭).

## 7. Related Documents
- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 사용자 정의(company=tenant), MVP 비범위
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 6개 화면 데이터 입출력(스키마 요구사항)
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 화면별 표시/저장 데이터
- **Technical_Specs**: [Development Setup](./01_DEVELOPMENT_SETUP.md) - Drizzle/Turso 스택
- **Technical_Specs**: [Component & Library Plan](./02_COMPONENT_LIBRARY_PLAN.md) - 화면 컴포넌트(데이터 소비처)
- **Technical_Specs**: [VAT Pre-Code Brief](./07_VAT_PRE_CODE_BRIEF.md) - 부가세 신규 테이블·read model 구현 계약
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - JC-005(데이터 모델) 및 JC-006~013 착수 전제조건
