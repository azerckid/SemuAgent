import {
  vatTaxTreatmentDisplayRowSchema,
  type VatTaxTreatmentDisplayRow,
} from '@/lib/validations/vat-tax-treatment'
import { withVatTaxTreatmentRecommendationFingerprint } from './tax-treatment-fingerprint'

type DecisiveDefault = Pick<
  VatTaxTreatmentDisplayRow,
  | 'recommendation'
  | 'confidence'
  | 'basisLabel'
  | 'missingFacts'
  | 'hometaxAction'
  | 'judgmentWorkflowStatus'
>

function hasEvidence(
  row: VatTaxTreatmentDisplayRow,
  code: string,
) {
  return row.requiredEvidence.some((item) => item.code === code && item.status === 'present')
}

function withMissingFact(row: VatTaxTreatmentDisplayRow, missingFact: string) {
  return Array.from(new Set([...row.missingFacts, missingFact])).slice(0, 12)
}

function purchaseDefault(
  row: VatTaxTreatmentDisplayRow,
): DecisiveDefault | null {
  if (row.recommendation === 'proration_required') return null

  if (row.recommendation === 'needs_review') {
    return {
      recommendation: 'likely_non_deductible',
      confidence: 'medium',
      basisLabel: '공제 근거를 찾지 못해 홈택스에서는 불공제 방향으로 확인합니다.',
      missingFacts: withMissingFact(row, '공제로 바꿀 수 있는 적격 증빙·업무 목적 근거 없음'),
      hometaxAction: 'review_deduction',
      judgmentWorkflowStatus: 'no_evidence_defaulted',
    }
  }

  if (row.recommendation !== 'likely_deductible') return null

  const missingEvidence = [
    ['exact_vat_fact', '정확한 공급가액·세액·합계액'],
    ['qualified_purchase_evidence', '적격 매입 증빙'],
    ['business_purpose', '업무 사용 목적'],
  ] as const
  const missingLabels = missingEvidence
    .filter(([code]) => !hasEvidence(row, code))
    .map(([, label]) => label)
  if (missingLabels.length === 0) return null

  return {
    recommendation: 'likely_non_deductible',
    confidence: 'medium',
    basisLabel: '공제에 필요한 근거가 모두 확인되지 않아 불공제 방향으로 확인합니다.',
    missingFacts: withMissingFact(row, `공제 근거 미확인: ${missingLabels.join('·')}`),
    hometaxAction: 'review_deduction',
    judgmentWorkflowStatus: 'no_evidence_defaulted',
  }
}

function saleDefault(
  row: VatTaxTreatmentDisplayRow,
): DecisiveDefault | null {
  if (row.recommendation === 'needs_review') {
    return {
      recommendation: 'likely_taxable',
      confidence: 'medium',
      basisLabel: '영세율·면세 근거를 찾지 못해 홈택스에서는 일반 과세 방향으로 확인합니다.',
      missingFacts: withMissingFact(row, '영세율·면세 특례를 적용할 적극적 근거 없음'),
      hometaxAction: 'review_sales_tax_type',
      judgmentWorkflowStatus: 'no_evidence_defaulted',
    }
  }

  if (
    row.recommendation === 'likely_zero_rated'
    && !hasEvidence(row, 'export_or_zero_rate_documents')
  ) {
    return {
      recommendation: 'likely_taxable',
      confidence: 'medium',
      basisLabel: '영세율 법정 증빙이 확인되지 않아 일반 과세 방향으로 확인합니다.',
      missingFacts: withMissingFact(row, '수출·외화입금 등 영세율 법정 증빙 없음'),
      hometaxAction: 'review_sales_tax_type',
      judgmentWorkflowStatus: 'no_evidence_defaulted',
    }
  }

  if (
    row.recommendation === 'likely_exempt'
    && !hasEvidence(row, 'exemption_qualification')
  ) {
    return {
      recommendation: 'likely_taxable',
      confidence: 'medium',
      basisLabel: '면세 적용 근거가 확인되지 않아 일반 과세 방향으로 확인합니다.',
      missingFacts: withMissingFact(row, '면세 품목·용역·인허가 요건 근거 없음'),
      hometaxAction: 'review_sales_tax_type',
      judgmentWorkflowStatus: 'no_evidence_defaulted',
    }
  }

  return null
}

export function resolveVatTaxTreatmentDecisiveDefault(
  row: VatTaxTreatmentDisplayRow,
): DecisiveDefault | null {
  if (row.finalDecision) return null
  if (row.aiRuntimeStatus === 'manual_fallback' || row.aiRuntimeStatus === 'deferred') return null
  if (row.judgmentWorkflowStatus === 'no_evidence_defaulted') return null

  return row.direction === 'purchase'
    ? purchaseDefault(row)
    : saleDefault(row)
}

export function applyVatTaxTreatmentDecisiveDefault(
  row: VatTaxTreatmentDisplayRow,
) {
  const decisiveDefault = resolveVatTaxTreatmentDecisiveDefault(row)
  if (!decisiveDefault) return row

  return vatTaxTreatmentDisplayRowSchema.parse(
    withVatTaxTreatmentRecommendationFingerprint({
      ...row,
      ...decisiveDefault,
    }),
  )
}

export function applyVatTaxTreatmentDecisiveDefaults(
  rows: VatTaxTreatmentDisplayRow[],
) {
  return rows.map(applyVatTaxTreatmentDecisiveDefault)
}
