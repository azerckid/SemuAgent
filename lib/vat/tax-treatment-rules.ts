import { looksPersonallyUseSuspicious } from '@/lib/bookkeeping-review/reconciliation-personal-use-detection'
import type {
  VatTaxTreatmentRecommendation,
  VatTaxTreatmentRequiredEvidence,
} from '@/lib/validations/vat-tax-treatment'

export type VatTaxTreatmentRuleRow = {
  id: string
  sourceType: 'tax_invoice' | 'card' | 'receipt'
  merchantName: string | null
  description: string | null
  finalAccount: string | null
  staffMemo: string | null
  vatDirection: 'sale' | 'purchase'
  vatTaxType: 'taxable' | 'zero_rated' | 'exempt' | 'non_taxable'
}

export type VatTaxTreatmentDeductionContext = {
  kind: 'deductible' | 'non_deductible_candidate' | 'proration_required'
  decision: 'pending' | 'deductible' | 'non_deductible' | 'prorated'
  reason: string
  prorationRateBps: number | null
} | null

export type VatTaxTreatmentRuleResult = Pick<
  VatTaxTreatmentRecommendation,
  | 'recommendation'
  | 'source'
  | 'confidence'
  | 'basisLabel'
  | 'ruleReference'
  | 'requiredEvidence'
  | 'missingFacts'
  | 'hometaxAction'
>

function evidence(
  code: string,
  label: string,
  status: VatTaxTreatmentRequiredEvidence['status'],
): VatTaxTreatmentRequiredEvidence {
  return { code, label, status }
}

function commonEvidence(row: VatTaxTreatmentRuleRow): VatTaxTreatmentRequiredEvidence[] {
  return [
    evidence('exact_vat_fact', '공급가액·세액·합계액 일치', 'present'),
    evidence(
      'qualified_purchase_evidence',
      row.sourceType === 'tax_invoice'
        ? '세금계산서 원천 행 있음'
        : row.sourceType === 'card'
          ? '카드 승인 원천 행 있음'
          : '현금영수증 원천 행 있음',
      'present',
    ),
  ]
}

function hasBusinessPurposeMemo(memo: string | null) {
  return /업무|사업|회사|직원|거래처|프로젝트/.test(memo ?? '')
}

// `vat_deduction_review.kind`는 확정 시 갱신되지 않으므로(생성 시점 값 유지),
// `decision`이 이미 확정된 행은 kind 기반 추측보다 확정 decision을 그대로 반영해
// 추천(recommendation)이 실제 사용자 확정값과 모순되지 않도록 한다.
function confirmedDeductionResult(
  deduction: NonNullable<VatTaxTreatmentDeductionContext>,
  evidenceItems: VatTaxTreatmentRequiredEvidence[],
): VatTaxTreatmentRuleResult {
  if (deduction.decision === 'deductible') {
    return {
      recommendation: 'likely_deductible',
      source: 'deterministic_rule',
      confidence: 'high',
      basisLabel: '이미 사용자가 매입세액 공제로 확정한 거래입니다.',
      ruleReference: null,
      requiredEvidence: evidenceItems,
      missingFacts: [],
      hometaxAction: 'expected_no_change',
    }
  }

  if (deduction.decision === 'non_deductible') {
    return {
      recommendation: 'likely_non_deductible',
      source: 'deterministic_rule',
      confidence: 'high',
      basisLabel: deduction.reason || '이미 사용자가 매입세액 불공제로 확정한 거래입니다.',
      ruleReference: null,
      requiredEvidence: evidenceItems,
      missingFacts: [],
      hometaxAction: 'review_deduction',
    }
  }

  const hasConfirmedRate = deduction.prorationRateBps !== null
  return {
    recommendation: 'proration_required',
    source: 'deterministic_rule',
    confidence: 'high',
    basisLabel: deduction.reason || '이미 사용자가 공통매입세액 안분으로 확정한 거래입니다.',
    ruleReference: null,
    requiredEvidence: [
      ...evidenceItems,
      evidence('proration_basis', '안분 기준과 비율', hasConfirmedRate ? 'present' : 'needs_review'),
    ],
    missingFacts: hasConfirmedRate ? [] : ['안분 기준과 비율 확인'],
    hometaxAction: 'review_proration',
  }
}

function purchaseRule(
  row: VatTaxTreatmentRuleRow,
  deduction: VatTaxTreatmentDeductionContext,
): VatTaxTreatmentRuleResult {
  const evidenceItems = commonEvidence(row)

  if (deduction && deduction.decision !== 'pending') {
    return confirmedDeductionResult(deduction, evidenceItems)
  }

  // 여기 도달하면 decision은 항상 'pending'이다(확정 건은 위에서 이미 반환됨).
  if (deduction?.kind === 'proration_required') {
    return {
      recommendation: 'proration_required',
      source: 'deterministic_rule',
      confidence: 'medium',
      basisLabel: '과세·면세 사업에 공통으로 사용한 매입으로 안분 근거를 확인해야 합니다.',
      ruleReference: 'P-06 · 부가가치세법 제40조 · 시행령 제81조',
      requiredEvidence: [
        ...evidenceItems,
        evidence('taxable_exempt_attribution', '과세·면세 사업 실지귀속', 'needs_review'),
        evidence('proration_basis', '안분 기준과 비율', 'needs_review'),
      ],
      missingFacts: ['실지귀속 또는 안분 기준·비율 확인'],
      hometaxAction: 'review_proration',
    }
  }

  const personalUseSuspicious = looksPersonallyUseSuspicious({
    counterparty: row.merchantName,
    description: row.description ?? '',
  })
  if (personalUseSuspicious && !hasBusinessPurposeMemo(row.staffMemo)) {
    return {
      recommendation: 'likely_non_deductible',
      source: 'deterministic_rule',
      confidence: 'medium',
      basisLabel: '개인 사용 또는 사업 무관 지출 가능성이 있어 사용 목적을 확인해야 합니다.',
      ruleReference: 'P-02 · 부가가치세법 제39조',
      requiredEvidence: [
        ...evidenceItems,
        evidence('business_purpose', '업무 사용 목적·소명', 'needs_review'),
      ],
      missingFacts: ['업무 사용 목적 또는 개인 사용 여부'],
      hometaxAction: 'review_deduction',
    }
  }

  if (row.finalAccount === 'entertainment') {
    return {
      recommendation: 'likely_non_deductible',
      source: 'deterministic_rule',
      confidence: 'high',
      basisLabel: '기업업무추진비·접대성 지출로 분류되어 매입세액 불공제 여부를 확인해야 합니다.',
      ruleReference: 'P-03 · 부가가치세법 제39조',
      requiredEvidence: [
        ...evidenceItems,
        evidence('business_purpose', '거래처·참석자·업무 목적', row.staffMemo ? 'present' : 'needs_review'),
      ],
      missingFacts: row.staffMemo ? [] : ['거래처·참석자·업무 목적'],
      hometaxAction: 'review_deduction',
    }
  }

  if (row.finalAccount === 'vehicle') {
    return {
      recommendation: 'needs_review',
      source: 'deterministic_rule',
      confidence: 'low',
      basisLabel: '차량 관련 매입은 차량 종류와 영업용 여부를 확인해야 공제 여부를 판단할 수 있습니다.',
      ruleReference: 'P-04 · 부가가치세법 제39조',
      requiredEvidence: [
        ...evidenceItems,
        evidence('vehicle_business_use', '차량 종류·영업용 여부·업무 사용', 'needs_review'),
      ],
      missingFacts: ['차량 종류와 영업용 여부'],
      hometaxAction: 'review_deduction',
    }
  }

  if (deduction?.kind === 'non_deductible_candidate') {
    return {
      recommendation: 'likely_non_deductible',
      source: 'deterministic_rule',
      confidence: 'medium',
      basisLabel: deduction.reason || '현재 공제 검토에서 불공제 가능성이 있는 매입으로 분류되었습니다.',
      ruleReference: 'P-02~P-05 · 부가가치세법 제39조',
      requiredEvidence: [
        ...evidenceItems,
        evidence('business_purpose', '업무 관련성과 불공제 사유', 'needs_review'),
      ],
      missingFacts: ['업무 관련성과 불공제 사유 확인'],
      hometaxAction: 'review_deduction',
    }
  }

  if (row.finalAccount && row.finalAccount !== 'unclassified') {
    return {
      recommendation: 'likely_deductible',
      source: 'deterministic_rule',
      confidence: 'medium',
      basisLabel: '정확한 매입 VAT fact와 적격 증빙, 확정 계정항목이 확인되었습니다.',
      ruleReference: 'P-01 · 부가가치세법 제38조',
      requiredEvidence: [
        ...evidenceItems,
        evidence('business_purpose', '확정 계정항목과 업무 목적', 'present'),
      ],
      missingFacts: [],
      hometaxAction: 'expected_no_change',
    }
  }

  return {
    recommendation: 'needs_review',
    source: 'deterministic_rule',
    confidence: 'low',
    basisLabel: '정확한 매입 VAT fact는 있으나 업무 관련성과 계정항목을 더 확인해야 합니다.',
    ruleReference: 'P-07 · 부가가치세법 제39조',
    requiredEvidence: [
      ...evidenceItems,
      evidence('business_purpose', '업무 관련 사용 목적', 'needs_review'),
    ],
    missingFacts: ['확정 계정항목과 업무 사용 목적'],
    hometaxAction: 'review_deduction',
  }
}

function saleRule(row: VatTaxTreatmentRuleRow): VatTaxTreatmentRuleResult {
  const evidenceItems = [evidence('exact_vat_fact', '공급가액·세액·합계액 일치', 'present')]

  if (row.vatTaxType === 'taxable') {
    return {
      recommendation: 'likely_taxable',
      source: 'deterministic_rule',
      confidence: 'high',
      basisLabel: '국내 과세 매출의 정확한 공급가액과 매출세액이 확인되었습니다.',
      ruleReference: 'S-01 · 부가가치세법 제4조·제30조',
      requiredEvidence: evidenceItems,
      missingFacts: [],
      hometaxAction: 'expected_no_change',
    }
  }

  if (row.vatTaxType === 'zero_rated') {
    return {
      recommendation: 'likely_zero_rated',
      source: 'deterministic_rule',
      confidence: 'low',
      basisLabel: '영세율 VAT fact가 있으나 법정 요건과 첨부서류를 확인해야 합니다.',
      ruleReference: 'S-02·S-05 · 부가가치세법 제21조~제24조',
      requiredEvidence: [
        ...evidenceItems,
        evidence('export_or_zero_rate_documents', '수출·외화입금 등 영세율 법정 증빙', 'needs_review'),
      ],
      missingFacts: ['영세율 법정 요건과 첨부서류'],
      hometaxAction: 'review_sales_tax_type',
    }
  }

  if (row.vatTaxType === 'exempt') {
    return {
      recommendation: 'likely_exempt',
      source: 'deterministic_rule',
      confidence: 'low',
      basisLabel: '면세 VAT fact가 있으나 품목·용역의 법정 면세 요건을 확인해야 합니다.',
      ruleReference: 'S-03·S-05 · 부가가치세법 제26조',
      requiredEvidence: [
        ...evidenceItems,
        evidence('exemption_qualification', '면세 품목·용역·인허가 요건', 'needs_review'),
      ],
      missingFacts: ['면세 품목·용역의 법정 요건'],
      hometaxAction: 'review_sales_tax_type',
    }
  }

  return {
    recommendation: 'needs_review',
    source: 'deterministic_rule',
    confidence: 'low',
    basisLabel: '비과세 또는 신고대상 제외 여부는 거래 구조와 법적 근거를 추가로 확인해야 합니다.',
    ruleReference: 'S-06 · 개별 사실관계 확인',
    requiredEvidence: evidenceItems,
    missingFacts: ['비과세 또는 신고대상 제외 근거'],
    hometaxAction: 'compare_in_hometax',
  }
}

export function evaluateVatTaxTreatmentRule(params: {
  row: VatTaxTreatmentRuleRow
  deduction: VatTaxTreatmentDeductionContext
}): VatTaxTreatmentRuleResult {
  return params.row.vatDirection === 'purchase'
    ? purchaseRule(params.row, params.deduction)
    : saleRule(params.row)
}
