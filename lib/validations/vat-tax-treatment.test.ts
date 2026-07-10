import { describe, expect, it } from 'vitest'
import { vatTaxTreatmentRecommendationSchema } from './vat-tax-treatment'

function recommendation(overrides: Record<string, unknown> = {}) {
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
      status: 'derived',
    },
    recommendation: 'likely_deductible',
    source: 'deterministic_rule',
    confidence: 'medium',
    basisLabel: '정확한 VAT fact와 적격 증빙이 있습니다.',
    ruleReference: 'P-01',
    ruleVersion: 'vat-kr-2026.07-v1',
    requiredEvidence: [],
    missingFacts: [],
    hometaxComparisonMode: 'expected_prefill',
    hometaxAction: 'expected_no_change',
    aiTrace: null,
    finalDecision: null,
    confirmedByStaffId: null,
    confirmedAt: null,
    ...overrides,
  }
}

describe('VAT tax treatment validation', () => {
  it('accepts the VAI-3a deterministic read-only contract', () => {
    expect(vatTaxTreatmentRecommendationSchema.parse(recommendation())).toMatchObject({
      source: 'deterministic_rule',
      hometaxComparisonMode: 'expected_prefill',
      finalDecision: null,
    })
  })

  it('rejects a sale decision on a purchase row', () => {
    expect(vatTaxTreatmentRecommendationSchema.safeParse(recommendation({
      finalDecision: 'taxable',
    })).success).toBe(false)
  })

  it('requires AI trace only for an AI source', () => {
    expect(vatTaxTreatmentRecommendationSchema.safeParse(recommendation({
      source: 'ai_single',
      aiTrace: null,
    })).success).toBe(false)

    expect(vatTaxTreatmentRecommendationSchema.safeParse(recommendation({
      source: 'deterministic_rule',
      aiTrace: {
        provider: 'gemini',
        modelName: 'model',
        promptVersion: 'v1',
        consensusProviders: [],
      },
    })).success).toBe(false)
  })

  it('requires confirmation audit fields together with a final decision', () => {
    expect(vatTaxTreatmentRecommendationSchema.safeParse(recommendation({
      finalDecision: 'deductible',
    })).success).toBe(false)

    expect(vatTaxTreatmentRecommendationSchema.safeParse(recommendation({
      finalDecision: 'deductible',
      confirmedByStaffId: 'staff-1',
      confirmedAt: '2026-07-11T00:00:00.000Z',
    })).success).toBe(true)
  })
})
