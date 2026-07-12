import { describe, expect, it } from 'vitest'
import type { VatTaxTreatmentRecommendation } from '@/lib/validations/vat-tax-treatment'
import { buildVatTaxTreatmentEvidenceSearch } from './tax-treatment-evidence-trace'
import { buildVatTaxTreatmentRecommendationFingerprint } from './tax-treatment-fingerprint'

function recommendation(
  overrides: Partial<VatTaxTreatmentRecommendation> = {},
): VatTaxTreatmentRecommendation {
  return {
    rowId: 'row-1',
    classificationRowId: 'row-1',
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
      status: 'derived',
    },
    recommendation: 'likely_deductible',
    provisionalJudgment: 'deductible',
    judgmentWorkflowStatus: 'user_confirmation_pending',
    ...buildVatTaxTreatmentEvidenceSearch({
      classificationRowId: 'row-1',
      sourceType: 'tax_invoice',
      ruleReference: 'P-01',
    }),
    source: 'deterministic_rule',
    confidence: 'medium',
    basisLabel: '업무용 매입',
    ruleReference: 'P-01',
    ruleVersion: 'vat-kr-2026.07-v1',
    requiredEvidence: [
      { code: 'qualified_purchase_evidence', label: '적격 증빙', status: 'present' },
      { code: 'exact_vat_fact', label: 'VAT fact', status: 'present' },
    ],
    missingFacts: [],
    hometaxComparisonMode: 'expected_prefill',
    hometaxAction: 'expected_no_change',
    aiTrace: null,
    aiRuntimeStatus: 'not_requested',
    humanHandoff: null,
    finalDecision: null,
    confirmedByStaffId: null,
    confirmedAt: null,
    ...overrides,
  }
}

describe('VAT tax treatment recommendation fingerprint', () => {
  it('is deterministic regardless of evidence display order', () => {
    const row = recommendation()
    const reversed = recommendation({ requiredEvidence: [...row.requiredEvidence].reverse() })

    expect(buildVatTaxTreatmentRecommendationFingerprint(row)).toBe(
      buildVatTaxTreatmentRecommendationFingerprint(reversed),
    )
  })

  it('changes when a canonical VAT fact or structured recommendation changes', () => {
    const baseline = buildVatTaxTreatmentRecommendationFingerprint(recommendation())

    expect(buildVatTaxTreatmentRecommendationFingerprint(recommendation({
      currentVatFact: {
        ...recommendation().currentVatFact,
        taxAmountKrw: 9_000,
      },
    }))).not.toBe(baseline)
    expect(buildVatTaxTreatmentRecommendationFingerprint(recommendation({
      recommendation: 'likely_non_deductible',
    }))).not.toBe(baseline)
    expect(buildVatTaxTreatmentRecommendationFingerprint(recommendation({
      source: 'prior_confirmed_pattern',
    }))).not.toBe(baseline)
  })

  it('changes when linked evidence or searched-source facts change', () => {
    const baseline = buildVatTaxTreatmentRecommendationFingerprint(recommendation())
    const displayCopyOnly = recommendation({
      evidenceTrace: recommendation().evidenceTrace.map((item) => ({
        ...item,
        summary: `${item.summary} 표시 문구 변경`,
      })),
    })
    const changedEvidence = buildVatTaxTreatmentEvidenceSearch({
      classificationRowId: 'row-1',
      sourceType: 'tax_invoice',
      linkedEvidenceRowId: 'linked-row-2',
      ruleReference: 'P-01',
    })

    expect(buildVatTaxTreatmentRecommendationFingerprint(displayCopyOnly)).toBe(baseline)
    expect(buildVatTaxTreatmentRecommendationFingerprint(recommendation(changedEvidence)))
      .not.toBe(baseline)
  })

  it('changes when a human handoff question or reason changes', () => {
    const baseline = buildVatTaxTreatmentRecommendationFingerprint(recommendation())
    const handoff = {
      reason: 'essential_fact_missing' as const,
      provisionalJudgment: 'deductible' as const,
      reviewedEvidenceReferences: ['classification:row-1'],
      evidenceIssue: '필수 사실이 없습니다.',
      missingEssentialFact: '업무 사용 목적',
      question: '업무용으로 사용했습니까?',
      decisionImpact: '예이면 공제, 아니면 불공제입니다.',
    }

    expect(buildVatTaxTreatmentRecommendationFingerprint(recommendation({ humanHandoff: handoff })))
      .not.toBe(baseline)
    expect(buildVatTaxTreatmentRecommendationFingerprint(recommendation({
      humanHandoff: { ...handoff, question: '직원이 사용했습니까?' },
    }))).not.toBe(buildVatTaxTreatmentRecommendationFingerprint(recommendation({ humanHandoff: handoff })))
  })
})
