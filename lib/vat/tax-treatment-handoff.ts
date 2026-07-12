import {
  vatTaxTreatmentDisplayRowSchema,
  type VatTaxTreatmentDisplayRow,
  type VatTaxTreatmentHumanHandoff,
} from '@/lib/validations/vat-tax-treatment'
import { withVatTaxTreatmentRecommendationFingerprint } from './tax-treatment-fingerprint'

export type VatTaxTreatmentHandoffInput = Pick<
  VatTaxTreatmentHumanHandoff,
  'reason' | 'evidenceIssue' | 'missingEssentialFact' | 'question' | 'decisionImpact'
> & {
  reviewedEvidenceReferences?: string[]
}

function foundEvidenceReferences(row: VatTaxTreatmentDisplayRow) {
  return row.evidenceTrace
    .filter((item) => item.status === 'found' && item.reference)
    .map((item) => item.reference!)
}

function appendMissingFact(row: VatTaxTreatmentDisplayRow, missingFact: string) {
  return Array.from(new Set([...row.missingFacts, missingFact])).slice(0, 12)
}

export function applyVatTaxTreatmentHumanHandoff(
  row: VatTaxTreatmentDisplayRow,
  input: VatTaxTreatmentHandoffInput,
) {
  if (row.finalDecision || !row.provisionalJudgment) return row

  const reviewedEvidenceReferences = Array.from(new Set([
    ...foundEvidenceReferences(row),
    ...(input.reviewedEvidenceReferences ?? []),
  ])).sort().slice(0, 12)
  if (reviewedEvidenceReferences.length === 0) return row

  const humanHandoff: VatTaxTreatmentHumanHandoff = {
    reason: input.reason,
    provisionalJudgment: row.provisionalJudgment,
    reviewedEvidenceReferences,
    evidenceIssue: input.evidenceIssue,
    missingEssentialFact: input.missingEssentialFact,
    question: input.question,
    decisionImpact: input.decisionImpact,
  }

  return vatTaxTreatmentDisplayRowSchema.parse(
    withVatTaxTreatmentRecommendationFingerprint({
      ...row,
      confidence: 'low',
      missingFacts: appendMissingFact(row, input.missingEssentialFact),
      aiRuntimeStatus: input.reason === 'no_consensus' ? 'no_consensus' : row.aiRuntimeStatus,
      humanHandoff,
    }),
  )
}

function missingProrationBasis(row: VatTaxTreatmentDisplayRow) {
  if (row.recommendation !== 'proration_required') return false
  return row.requiredEvidence.some((item) => (
    (item.code === 'taxable_exempt_attribution' || item.code === 'proration_basis')
    && item.status !== 'present'
  ))
}

function missingOfficialRule(row: VatTaxTreatmentDisplayRow) {
  return row.judgmentWorkflowStatus === 'user_confirmation_pending'
    && row.evidenceTrace.some((item) => item.source === 'official_rule' && item.status === 'not_found')
}

export function resolveVatTaxTreatmentAutomaticHandoff(
  row: VatTaxTreatmentDisplayRow,
): VatTaxTreatmentHandoffInput | null {
  if (row.finalDecision || row.humanHandoff) return null

  if (missingProrationBasis(row)) {
    return {
      reason: 'essential_fact_missing',
      evidenceIssue: '과세·면세 공통 사용 가능성은 확인했지만 실지귀속 또는 안분 기준이 없습니다.',
      missingEssentialFact: '이 매입의 과세사업·면세사업별 실제 사용 비율과 안분 기준',
      question: '이 매입은 과세사업과 면세사업에 각각 어떤 비율과 기준으로 사용됐습니까?',
      decisionImpact: '공통 사용이면 확인된 기준으로 안분하고, 한쪽 사업에만 귀속되면 해당 귀속 방향으로 다시 판단합니다.',
    }
  }

  if (missingOfficialRule(row)) {
    const purchase = row.direction === 'purchase'
    return {
      reason: 'rule_gap',
      evidenceIssue: '정해진 자료는 확인했지만 현재 거래 구조에 직접 적용할 versioned 공식 규칙이 없습니다.',
      missingEssentialFact: purchase
        ? '법정 공제 요건 또는 불공제 제외 사유에 해당하는 거래 사실'
        : '적용할 과세유형을 결정하는 법정 거래 요건',
      question: purchase
        ? '이 거래에 적용할 법정 공제 요건 또는 불공제 제외 사유를 입증하는 사실이 있습니까?'
        : '이 거래의 과세유형을 결정할 법정 요건과 이를 입증하는 사실이 있습니까?',
      decisionImpact: purchase
        ? '공제 요건이 입증되면 공제 방향, 입증되지 않으면 불공제 방향을 유지합니다.'
        : '특례 요건이 입증되면 해당 과세유형, 입증되지 않으면 일반 과세 방향을 유지합니다.',
    }
  }

  return null
}

export function applyVatTaxTreatmentAutomaticHandoffs(
  rows: VatTaxTreatmentDisplayRow[],
) {
  return rows.map((row) => {
    const handoff = resolveVatTaxTreatmentAutomaticHandoff(row)
    return handoff ? applyVatTaxTreatmentHumanHandoff(row, handoff) : row
  })
}

export function findUnresolvedVatTaxTreatmentHandoff(
  rows: readonly VatTaxTreatmentDisplayRow[],
  classificationRowId: string | null,
) {
  if (!classificationRowId) return null
  return rows.find((row) => row.classificationRowId === classificationRowId)?.humanHandoff ?? null
}
