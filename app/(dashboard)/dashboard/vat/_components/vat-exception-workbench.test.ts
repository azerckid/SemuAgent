import { describe, expect, it } from 'vitest'
import {
  vatTaxTreatmentDisplayRowSchema,
  type VatTaxTreatmentDisplayRow,
} from '@/lib/validations/vat-tax-treatment'
import type { VatDeductionReviewRow } from '@/lib/vat/summary'
import { withVatTaxTreatmentRecommendationFingerprint } from '@/lib/vat/tax-treatment-fingerprint'
import {
  buildVatExceptionWorkbenchModel,
  isVatFilingModificationRequired,
  resolveVatDeductionReviewWorkbenchDecision,
  resolveVatTreatmentWorkbenchDecision,
} from './vat-exception-workbench'

function treatmentRow(overrides: Partial<VatTaxTreatmentDisplayRow> = {}): VatTaxTreatmentDisplayRow {
  return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
    rowId: 'row-1',
    classificationRowId: 'classification-1',
    tenantId: 'tenant-1',
    businessEntityId: 'client-1',
    periodKey: '2026-H1',
    direction: 'purchase',
    currentVatFact: {
      taxType: 'taxable',
      supplyAmountKrw: 100_000,
      taxAmountKrw: 10_000,
      grossAmountKrw: 110_000,
      source: 'parser',
      status: 'confirmed',
    },
    recommendation: 'likely_deductible',
    source: 'deterministic_rule',
    confidence: 'high',
    basisLabel: '전자증빙과 확정 금액이 일치합니다.',
    ruleReference: 'P-01',
    ruleVersion: 'vat-kr-2026.07-v1',
    requiredEvidence: [{ code: 'exact_vat_fact', label: '정확한 VAT fact', status: 'present' }],
    missingFacts: [],
    hometaxComparisonMode: 'expected_prefill',
    hometaxAction: 'expected_no_change',
    aiTrace: null,
    aiRuntimeStatus: 'not_requested',
    finalDecision: null,
    confirmedByStaffId: null,
    confirmedAt: null,
    transactionDate: '2026-06-15',
    counterparty: '테스트 거래처',
    description: '업무용 결제',
    sourceType: 'tax_invoice',
    accountLabel: '지급수수료',
    userActionStatus: 'pending',
    userActionReason: null,
    ...overrides,
  }))
}

function deductionReview(overrides: Partial<VatDeductionReviewRow> = {}): VatDeductionReviewRow {
  return {
    id: 'review-1',
    sourceVoucherId: null,
    sourceVoucherLineId: null,
    classificationRowId: 'classification-1',
    description: '업무용 결제',
    counterparty: '테스트 거래처',
    supplyAmountKrw: 100_000,
    inputTaxKrw: 10_000,
    kind: 'non_deductible_candidate',
    decision: 'pending',
    reason: '공제 여부 확인 필요',
    prorationRateBps: null,
    actionLabels: ['불공제 확정', '공제'],
    ...overrides,
  }
}

describe('VAT exception workbench model', () => {
  it('hides rows that do not require a Hometax change', () => {
    expect(isVatFilingModificationRequired(treatmentRow())).toBe(false)
    expect(isVatFilingModificationRequired(treatmentRow({
      source: 'ai_single',
      confidence: 'high',
      aiRuntimeStatus: 'completed',
      aiTrace: {
        provider: 'openai',
        modelName: 'test-model',
        promptVersion: 'test-prompt-v1',
        consensusProviders: [],
      },
    }))).toBe(false)
  })

  it('keeps actual Hometax changes and unresolved handoffs visible', () => {
    expect(isVatFilingModificationRequired(treatmentRow({
      hometaxAction: 'review_deduction',
    }))).toBe(true)
    expect(isVatFilingModificationRequired(treatmentRow({
      hometaxAction: 'expected_no_change',
      humanHandoff: {
        reason: 'evidence_conflict',
        provisionalJudgment: 'deductible',
        reviewedEvidenceReferences: ['classification:classification-1'],
        evidenceIssue: '과거 확정이 충돌합니다.',
        missingEssentialFact: '이번 거래의 실제 업무 목적',
        question: '이번 거래는 어떤 업무 목적으로 사용했습니까?',
        decisionImpact: '업무 목적이면 공제, 아니면 불공제입니다.',
      },
    }))).toBe(true)
  })

  it('removes a fully user-confirmed row from the exception queue', () => {
    expect(isVatFilingModificationRequired(treatmentRow({
      finalDecision: 'deductible',
      confirmedByStaffId: 'staff-1',
      confirmedAt: '2026-07-12T00:00:00.000Z',
      userActionStatus: 'confirmed',
    }))).toBe(false)
  })

  it('keeps a pending deduction review even when the treatment row expects no Hometax change', () => {
    const result = buildVatExceptionWorkbenchModel({
      treatmentRows: [treatmentRow()],
      deductionReviews: [deductionReview()],
    })

    expect(result.treatmentRows).toHaveLength(1)
    expect(result.treatmentRows[0]?.deductionReview?.id).toBe('review-1')
  })

  it('merges a pending deduction review into the matching tax-treatment row', () => {
    const result = buildVatExceptionWorkbenchModel({
      treatmentRows: [treatmentRow()],
      deductionReviews: [deductionReview()],
    })

    expect(result.exceptionCount).toBe(1)
    expect(result.treatmentRows[0]?.deductionReview?.id).toBe('review-1')
    expect(result.standaloneDeductionReviews).toEqual([])
  })

  it('keeps unmatched pending deduction reviews and excludes completed reviews', () => {
    const result = buildVatExceptionWorkbenchModel({
      treatmentRows: [],
      deductionReviews: [
        deductionReview({ id: 'pending', classificationRowId: null }),
        deductionReview({ id: 'done', classificationRowId: null, decision: 'deductible', actionLabels: ['확정됨'] }),
      ],
    })

    expect(result.exceptionCount).toBe(1)
    expect(result.standaloneDeductionReviews.map((review) => review.id)).toEqual(['pending'])
  })

  it('uses the explicit provisional judgment instead of a generic review label', () => {
    expect(resolveVatTreatmentWorkbenchDecision(treatmentRow())).toBe('deductible')
    expect(resolveVatTreatmentWorkbenchDecision(treatmentRow({ recommendation: 'proration_required' }))).toBe('proration_required')
    expect(resolveVatTreatmentWorkbenchDecision(treatmentRow({ recommendation: 'likely_non_deductible' }))).toBe('non_deductible')
    expect(resolveVatTreatmentWorkbenchDecision(treatmentRow({ recommendation: 'needs_review' }))).toBe('judgment_pending')
  })

  it('shows the actual sales tax judgment rather than a generic tax-type review label', () => {
    expect(resolveVatTreatmentWorkbenchDecision(treatmentRow({
      direction: 'sale',
      recommendation: 'likely_zero_rated',
    }))).toBe('zero_rated')
  })

  it('maps legacy deduction reviews onto the same compact decision vocabulary', () => {
    expect(resolveVatDeductionReviewWorkbenchDecision(deductionReview())).toBe('non_deductible')
    expect(resolveVatDeductionReviewWorkbenchDecision(deductionReview({ kind: 'proration_required' }))).toBe('deductible')
    expect(resolveVatDeductionReviewWorkbenchDecision(deductionReview({ decision: 'deductible' }))).toBe('deductible')
    expect(resolveVatDeductionReviewWorkbenchDecision(deductionReview({
      kind: 'deductible',
      decision: 'non_deductible',
    }))).toBe('non_deductible')
  })
})
