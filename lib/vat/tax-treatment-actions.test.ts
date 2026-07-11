import { describe, expect, it } from 'vitest'
import {
  canApplyVatTaxTreatmentRecommendation,
  defaultDifferentVatDecision,
  finalDecisionForVatRecommendation,
  missingRequiredEvidenceForVatDecision,
  vatTaxTreatmentDecisionOptions,
} from './tax-treatment-actions'

describe('VAT tax treatment action helpers', () => {
  it('maps only directly applicable recommendations to final decisions', () => {
    expect(finalDecisionForVatRecommendation('likely_deductible')).toBe('deductible')
    expect(finalDecisionForVatRecommendation('likely_non_deductible')).toBe('non_deductible')
    expect(finalDecisionForVatRecommendation('likely_taxable')).toBe('taxable')
    expect(finalDecisionForVatRecommendation('proration_required')).toBeNull()
    expect(finalDecisionForVatRecommendation('needs_review')).toBeNull()
  })

  it('keeps purchase and sale final-decision choices separated', () => {
    expect(vatTaxTreatmentDecisionOptions('purchase').map((item) => item.value)).toEqual([
      'deductible',
      'non_deductible',
      'prorated',
    ])
    expect(vatTaxTreatmentDecisionOptions('sale').map((item) => item.value)).toEqual([
      'taxable',
      'zero_rated',
      'exempt',
      'non_taxable',
    ])
  })

  it('blocks zero-rated or exempt confirmation until required evidence is present', () => {
    const unresolved = {
      requiredEvidence: [{
        code: 'export_or_zero_rate_documents',
        label: '영세율 법정 증빙',
        status: 'needs_review' as const,
      }],
    }
    expect(missingRequiredEvidenceForVatDecision(unresolved, 'zero_rated')).toBe(true)
    expect(canApplyVatTaxTreatmentRecommendation({
      ...unresolved,
      recommendation: 'likely_zero_rated',
    })).toBe(false)
    expect(missingRequiredEvidenceForVatDecision(unresolved, 'taxable')).toBe(false)
  })

  it('starts the different-decision form away from the current recommendation', () => {
    expect(defaultDifferentVatDecision({
      direction: 'purchase',
      recommendation: 'likely_deductible',
      finalDecision: null,
    })).toBe('non_deductible')
    expect(defaultDifferentVatDecision({
      direction: 'purchase',
      recommendation: 'proration_required',
      finalDecision: null,
    })).toBe('prorated')
  })
})
