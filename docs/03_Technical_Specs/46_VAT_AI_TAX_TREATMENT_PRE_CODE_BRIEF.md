# VAT AI Tax Treatment Pre-Code Brief
> Created: 2026-07-11
> Last Updated: 2026-07-11
> Backlog: JC-035 · VAI-2
> Governing Rule: [VAT AI Tax Treatment Rule Matrix](./45_VAT_AI_TAX_TREATMENT_RULE_MATRIX.md)

## 0. Decision

JC-035 구현은 기존 `/dashboard/vat` 화면을 교체하지 않고, 승인된 AI 부가세 판단 표를
기존 세액 요약·부속명세·package gate 사이에 연결한다.

1차 목표는 홈택스 화면을 복제하는 것이 아니다. 사용자가 홈택스 자동채움 내용을 확인할 때
**그대로 확인할 항목과 수정·추가 검토할 항목을 근거와 함께 알려주는 것**이다.

```text
확정 거래 + exact VAT fact
  -> 규칙/패턴/조건부 AI 추천
  -> 홈택스 확인·수정 항목 표시
  -> 사용자 최종 확정
  -> VAT rebuild/package gate
```

VAI-3은 read-only다. 추천을 표시하더라도 기존 VAT fact, `vat_deduction_review.decision`,
세액 snapshot, package gate를 변경하지 않는다. 실제 저장은 VAI-4에서 별도 migration과
mutation을 검토한 뒤 시작한다.

## 1. Scope

### 1.1 Included

- 매출·매입 거래별 추천 결론, 판단 출처, 신뢰도, 근거, 필수 증빙
- 홈택스에서 확인·수정할 행동 표시
- deterministic rule과 같은 사업장 이전 확정 패턴
- 규칙·패턴으로 부족한 행의 단일 AI 보강
- 사용자 확정과 AI 추천을 분리하는 저장·감사 계약
- timeout·quota·invalid schema 실패 시 비차단 수동 검토

### 1.2 Excluded

- 암호화 전자신고 파일
- 부가세 신고서 전체 양식 업로드 파일 추정 생성
- 홈택스 화면 단계별 입력 가이드
- 홈택스 현재값을 가져오지 않고 실제 차액이라고 표시
- AI 자동확정·자동제출·자동납부
- 영세율·면세·고위험 예외의 증빙 없는 확정

## 2. Existing Contract Reuse

| 기존 자산 | 재사용 | 경계 |
|:---|:---|:---|
| `bookkeeping_transaction_classification` exact VAT fact | 매출·매입 원천 사실 | 금액 추정 금지, `derived`/`confirmed`만 대상 |
| `vat_deduction_review` | 매입 최종 공제 decision | `kind` 기본값을 AI 추천으로 오해하지 않음 |
| `vat_period_summary` | 사용자 확정 뒤 deterministic rebuild 결과 | 추천만으로 재계산 금지 |
| `lib/vat/provenance.ts` | source fingerprint·rebuild 검증 | 미확정 판단이 있으면 gate 차단 |
| 자료대조원장 확정 패턴 | 같은 사업장 이전 확정 근거 | tenant·사업장·방향·거래 성격 범위 강제 |
| 기존 AI provider order | VAI-3 single / VAI-5 consensus | 모든 행에 LLM 호출 금지 |

## 3. Display Model

구현은 Zod schema를 단일 소스로 사용한다.

```ts
type VatTaxTreatmentRecommendation = {
  rowId: string
  classificationRowId: string
  tenantId: string
  businessEntityId: string
  periodKey: string
  direction: 'sale' | 'purchase'
  currentVatFact: {
    taxType: 'taxable' | 'zero_rated' | 'exempt' | 'non_taxable' | 'needs_review'
    supplyAmountKrw: number
    taxAmountKrw: number
    grossAmountKrw: number
    status: 'derived' | 'confirmed'
  }
  recommendation:
    | 'likely_taxable'
    | 'likely_zero_rated'
    | 'likely_exempt'
    | 'likely_deductible'
    | 'likely_non_deductible'
    | 'proration_required'
    | 'needs_review'
  source: 'deterministic_rule' | 'prior_confirmed_pattern' | 'ai_single' | 'ai_consensus'
  confidence: 'high' | 'medium' | 'low'
  basisLabel: string
  ruleReference: string | null
  ruleVersion: 'vat-kr-2026.07-v1'
  requiredEvidence: Array<{
    code: string
    label: string
    status: 'present' | 'missing' | 'needs_review'
  }>
  missingFacts: string[]
  hometaxComparisonMode: 'expected_prefill'
  hometaxAction:
    | 'expected_no_change'
    | 'review_deduction'
    | 'review_sales_tax_type'
    | 'add_or_correct_amount'
    | 'review_proration'
    | 'compare_in_hometax'
  aiTrace: {
    provider: 'gemini' | 'openai' | 'claude'
    modelName: string
    promptVersion: string
    consensusProviders: Array<'gemini' | 'openai' | 'claude'>
  } | null
  finalDecision:
    | 'deductible'
    | 'non_deductible'
    | 'prorated'
    | 'taxable'
    | 'zero_rated'
    | 'exempt'
    | 'non_taxable'
    | null
  confirmedByStaffId: string | null
  confirmedAt: string | null
}
```

`tenantId`는 서버 스코프 검증용이며 Client Component에 별도 표시하지 않는다. 실제 홈택스
자료를 가져오지 않는 동안 `hometaxComparisonMode`는 `expected_prefill`만 허용한다.
Zod `superRefine`으로 purchase 행은 `deductible|non_deductible|prorated`, sale 행은
`taxable|zero_rated|exempt|non_taxable`만 최종 결정으로 허용한다.

구조화 문자열과 배열에는 다음 상한을 둔다.

- `basisLabel`: 500자 이하
- `requiredEvidence`: 12개 이하, label 120자 이하
- `missingFacts`: 12개 이하, 항목당 200자 이하
- `modelName`·`promptVersion`: 100자 이하

## 4. Rule and Read Model Boundary

### 4.1 Planned Modules

| 모듈 | 역할 | 최초 작업 단위 |
|:---|:---|:---|
| `lib/vat/tax-treatment-rules.ts` | VAI-P/S deterministic rule | VAI-3 |
| `lib/vat/tax-treatment-patterns.ts` | 같은 사업장 이전 확정 패턴 | VAI-3 |
| `lib/vat/tax-treatment-ai.ts` | 단일 AI·구조화 응답·timeout | VAI-3 |
| `lib/vat/tax-treatment-summary.ts` | 표시 모델 조합·카운트·필터 | VAI-3 |
| `lib/validations/vat-tax-treatment.ts` | Zod display/AI/mutation schema | VAI-3/VAI-4 |
| `app/api/vat/tax-treatments/[rowId]/route.ts` | 사용자 최종 확정 mutation | VAI-4 |

### 4.2 Evaluation Order

1. exact VAT fact와 원천 행 유효성 확인
2. 공식 deterministic rule 적용
3. 같은 tenant·사업장의 이전 사용자 확정 패턴 확인
4. 여전히 애매한 행만 single-provider AI 호출
5. VAI-5 이후 고위험·불일치 행만 multi-provider 검토
6. 판단 불가·실패는 `needs_review`

앞 단계가 충분하면 뒤 단계를 호출하지 않는다. source와 근거는 최종 추천에 반드시 남긴다.

## 5. Persistence Contract

### 5.1 VAI-3 Read-only

- 신규 migration 없음
- 추천은 요청 시 파생하고 Zod 검증 후 표시
- 기존 VAT fact·공제 decision·summary·fingerprint 변경 없음
- AI 실패 결과를 기존 `reason` 필드에 억지로 저장하지 않음

### 5.2 VAI-4 Recommendation Audit

사용자 확정 기능을 붙이기 전 additive table `vat_tax_treatment_review`를 별도 migration으로
검토한다. 한 행은 tenant·사업장·기간·classification row 단위로 유일해야 한다.

| 필드 그룹 | 저장 내용 |
|:---|:---|
| 범위 | `tenant_id`, `client_id`, `period_key`, `classification_row_id`, `direction` |
| 추천 snapshot | recommendation, source, confidence, basis, rule reference/version, AI provider/model/prompt version |
| 증빙·부족 사실 | required evidence JSON, missing facts JSON |
| 홈택스 행동 | comparison mode, action code |
| 사용자 상태 | pending, confirmed, held, expert_review |
| 최종 결정 감사 | final decision/reason, confirmed by/at |
| 시간 | recommended at, created at, updated at |

추천 snapshot은 감사용이다. 세액 계산의 canonical source는 중복 저장하지 않는다.

- 매입 최종 결정: 기존 `vat_deduction_review.decision`을 canonical source로 유지
- 매출 최종 과세유형·금액: 기존 exact VAT fact의 manual confirmed 경로를 canonical source로 유지
- audit row와 canonical write는 하나의 DB transaction으로 처리
- 실패하면 둘 다 rollback

## 6. Mutation Contract (VAI-4)

```ts
type VatTaxTreatmentMutation =
  | { action: 'apply_recommendation'; recommendationFingerprint: string }
  | {
      action: 'confirm_different'
      finalDecision:
        | 'deductible'
        | 'non_deductible'
        | 'prorated'
        | 'taxable'
        | 'zero_rated'
        | 'exempt'
        | 'non_taxable'
      reason: string
    }
  | { action: 'hold'; reason?: string }
  | { action: 'expert_review'; reason?: string }
```

서버는 다음을 다시 검증한다.

- 인증 사용자와 tenant membership
- row의 tenant·사업장·기간 범위
- 추천 fingerprint가 현재 원천 사실·규칙 버전과 일치하는지
- exact VAT arithmetic
- 영세율·면세 필수 증빙이 모두 `present`인지
- 안분율 범위와 근거 존재 여부
- excluded/미확정 자료대조 행이 아닌지

`apply_recommendation`도 자동확정이 아니다. 사용자가 버튼을 눌렀을 때만 mutation이 발생한다.

### 6.1 Recommendation Fingerprint

fingerprint는 정렬된 canonical JSON의 SHA-256으로 만든다.

```text
tenantId + businessEntityId + periodKey + classificationRowId
+ exact VAT fact amounts/tax type/source/status
+ recommendation/source/required evidence statuses
+ ruleVersion
```

화면을 연 뒤 원천 fact·증빙·규칙 버전이 바뀌면 fingerprint가 달라져 mutation을 409로
거부하고 최신 추천을 다시 확인하게 한다. AI 문장 표현이나 생성시각은 fingerprint 입력에서
제외하고, 구조화된 판단값과 근거 코드만 사용한다.

## 7. UI Contract

기존 VAT AI Tax Treatment Table 안에서 다음 순서로 표시한다.

1. 한 줄 결론: `공제 가능성 높음`, `불공제 가능성 높음`, `안분 필요`, `확인 필요`
2. 홈택스 행동: `그대로 확인`, `공제·불공제 확인`, `금액 추가·수정 확인` 등
3. 판단 근거: 공식 규칙·이전 패턴·AI 보강·AI 합의
4. 필요한 증빙과 부족한 사실
5. 사용자 상태: 미확정 / 사용자 확정 / 보류 / 전문가 확인

홈택스 메뉴 위치나 클릭 순서를 단계별로 안내하지 않는다. 사용자가 **무엇을 확인하거나
수정해야 하는지**만 보여준다.

### 7.1 Component and Library Plan

| 구분 | 계획 |
|:---|:---|
| 기존 재사용 | 현재 `VatWorkspace`, VAT summary/package components, 공용 Table·Button·Dialog·Tooltip·상태칩 |
| 기존 계획 확장 | `VatTaxTreatmentTable`, `VatTaxTreatmentBasis`, `VatAiFallbackState`, `VatDeductionActions` |
| 신규 top-level 컴포넌트 | 없음 — 홈택스 확인 행동과 필요 증빙은 기존 판단 표 행에 포함 |
| 폼·검증 | 기존 React state + Zod; 새 form library 설치 없음 |
| mutation 피드백 | 기존 `sonner` toast와 server revalidation 재사용 |
| 날짜·기간 | 기존 VAT period parser·Luxon 재사용 |
| AI | 기존 provider adapters·provider order 재사용; 새 AI SDK 설치 없음 |
| shadcn preset | N/A — 현재 SemuAgent theme·공용 컴포넌트 유지, 새 preset 적용 없음 |
| 새 의존성 | 없음 |

별도 카드나 대시보드를 추가하지 않는다. 승인 Preview의 단일 판단 표를 확장해 정보 중복을
막는다.

## 8. AI Runtime Contract

- single-provider timeout은 구현 시 기존 provider 호출 timeout을 조사해 유한값으로 고정한다.
- 전체 행을 직렬 LLM 호출하지 않고 deterministic/pattern 결과를 먼저 제외한다.
- 같은 요청의 AI 대상 행은 제한된 batch로 처리한다.
- provider 오류·quota·invalid schema는 해당 행만 `needs_review`로 전환한다.
- 화면 SSR과 기존 공제 mutation은 AI 완료를 기다리며 무한 loading하지 않는다.
- 재시도 횟수를 제한한다.
- prompt에는 거래 판단에 필요한 최소 필드만 포함하고 원문 파일 전체를 보내지 않는다.

### 8.1 PII and Audit Boundary

- 홈택스·은행·카드 비밀번호, 인증서, 주민등록번호를 prompt나 audit에 넣지 않는다.
- 원본 증빙 파일 본문, 전체 카드번호, 계좌번호 원문을 recommendation table에 저장하지 않는다.
- 저장 가능한 AI 기록은 구조화된 추천값·근거 요약·provider/model/prompt version으로 제한한다.
- raw prompt와 raw provider response를 DB에 영구 저장하지 않는다.
- 거래처명·적요가 provider에 필요하면 목적에 필요한 최소 문자열만 보내고 기존 마스킹 정책을 따른다.
- 모든 recommendation/audit 조회·mutation은 tenantId·clientId·periodKey를 함께 검증한다.

## 9. Gate Contract

VAI-6에서 아래 항목 중 하나라도 있으면 VAT rebuild/package gate를 차단한다.

- `needs_review` 또는 사용자 미확정 판단
- 영세율·면세 필수 증빙 missing/needs_review
- 안분 근거 또는 안분율 미확정
- 추천 snapshot과 원천 fact fingerprint 불일치
- canonical VAT fact 또는 deduction decision 미확정

추천 개수나 AI confidence만으로 gate를 해제하지 않는다.

## 10. Implementation Order

| 순서 | PR 범위 | 완료선 |
|:---|:---|:---|
| VAI-3a | Zod + deterministic rules + pattern + read model | fixture에서 근거·홈택스 행동 표시, DB 쓰기 0 |
| VAI-3b | 필요한 행만 single AI + timeout/fallback | 실제 화면에서 AI/수동 상태 표시, DB 쓰기 0 |
| VAI-4a | additive audit schema + migration + API transaction | 사용자 확정 저장·tenant guard·rollback 테스트 |
| VAI-4b | 적용/다르게/보류/전문가 확인 UI + undo | 브라우저 E2E와 감사 이력 확인 |
| VAI-5 | 고위험 consensus + Claude 중재 | 불일치·실패 비차단 |
| VAI-6 | rebuild/package gate 소비 + closeout | 확정값만 세액 반영, 문서·QA 동기화 |

각 행은 별도 PR과 프로젝트 오너 확인을 거친다. 여러 작업 단위를 한 PR에 합치지 않는다.

## 11. Acceptance Criteria

- [x] 기존 VAT schema와 신규 추천/audit 책임을 분리했다.
- [x] VAI-3 read-only와 VAI-4 mutation 경계를 고정했다.
- [x] 홈택스 실제값과 자동채움 예상을 구분했다.
- [x] 홈택스에서 확인·수정할 행동 코드를 고정했다.
- [x] canonical VAT fact/deduction decision을 중복 대체하지 않는다.
- [x] tenant·사업장·기간·규칙 버전·추천 fingerprint 검증을 고정했다.
- [x] AI timeout/fallback과 수동 검토 비차단 계약을 고정했다.
- [x] VAI-3~6 PR 순서와 완료선을 고정했다.
- [ ] 프로젝트 오너가 VAI-2 Pre-Code Brief를 승인했다.

## 12. Related Documents

- **Concept_Design**: [Product Baseline](../01_Concept_Design/01_PRODUCT_BASELINE.md) - 회사 직접 신고 보조와 사용자 최종 책임 경계
- **Technical_Specs**: [JC-035 Completion Contract](./44_VAT_AI_TAX_TREATMENT_COMPLETION_CONTRACT.md) · [Rule Matrix](./45_VAT_AI_TAX_TREATMENT_RULE_MATRIX.md) · [VAT Base Brief](./07_VAT_PRE_CODE_BRIEF.md)
- **UI_Screens**: [VAT Preview](../02_UI_Screens/previews/03_vat.html) · [VAT Prototype Review](../02_UI_Screens/05_VAT_PROTOTYPE_REVIEW.md) · [UI Design §4.4](../02_UI_Screens/01_UI_DESIGN.md)
- **Logic_Progress**: [Backlog JC-035](../04_Logic_Progress/00_BACKLOG.md)
- **QA_Validation**: [VAT Test Scenarios §2.10](../05_QA_Validation/05_VAT_TEST_SCENARIOS.md)
