import { describe, expect, it } from 'vitest'
import {
  vatTaxTreatmentEvidenceMutationSchema,
  vatTaxTreatmentEvidenceMutationSuccessSchema,
  vatTaxTreatmentMutationSchema,
  vatTaxTreatmentMutationSuccessSchema,
  vatTaxTreatmentRecommendationSchema,
} from './vat-tax-treatment'
import { buildVatTaxTreatmentEvidenceSearch } from '@/lib/vat/tax-treatment-evidence-trace'

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
    basisLabel: '정확한 VAT fact와 적격 증빙이 있습니다.',
    ruleReference: 'P-01',
    ruleVersion: 'vat-kr-2026.07-v1',
    requiredEvidence: [],
    missingFacts: [],
    hometaxComparisonMode: 'expected_prefill',
    hometaxAction: 'expected_no_change',
    aiTrace: null,
    aiRuntimeStatus: 'not_requested',
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

    expect(vatTaxTreatmentRecommendationSchema.safeParse(recommendation({
      source: 'ai_single',
      aiRuntimeStatus: 'completed',
      aiTrace: {
        provider: 'openai',
        modelName: 'test-model',
        promptVersion: 'vat-tax-treatment-v3',
        consensusProviders: [],
      },
    })).success).toBe(true)
  })

  it('rejects a completed AI source that ends with a generic review result', () => {
    expect(vatTaxTreatmentRecommendationSchema.safeParse(recommendation({
      recommendation: 'needs_review',
      provisionalJudgment: null,
      judgmentWorkflowStatus: 'judgment_pending',
      source: 'ai_single',
      aiRuntimeStatus: 'completed',
      aiTrace: {
        provider: 'openai',
        modelName: 'test-model',
        promptVersion: 'vat-tax-treatment-v3',
        consensusProviders: [],
      },
    })).success).toBe(false)
  })

  it('keeps AI runtime status consistent with the recommendation source', () => {
    expect(vatTaxTreatmentRecommendationSchema.safeParse(recommendation({
      aiRuntimeStatus: 'completed',
    })).success).toBe(false)

    expect(vatTaxTreatmentRecommendationSchema.safeParse(recommendation({
      recommendation: 'needs_review',
      provisionalJudgment: null,
      judgmentWorkflowStatus: 'ai_temporary_error',
      aiRuntimeStatus: 'manual_fallback',
    })).success).toBe(true)

    expect(vatTaxTreatmentRecommendationSchema.safeParse(recommendation({
      recommendation: 'likely_deductible',
      provisionalJudgment: null,
      judgmentWorkflowStatus: 'ai_temporary_error',
      aiRuntimeStatus: 'manual_fallback',
    })).success).toBe(false)
  })

  it('requires confirmation audit fields together with a final decision', () => {
    expect(vatTaxTreatmentRecommendationSchema.safeParse(recommendation({
      finalDecision: 'deductible',
    })).success).toBe(false)

    expect(vatTaxTreatmentRecommendationSchema.safeParse(recommendation({
      finalDecision: 'deductible',
      judgmentWorkflowStatus: 'user_confirmed',
      confirmedByStaffId: 'staff-1',
      confirmedAt: '2026-07-11T00:00:00.000Z',
    })).success).toBe(true)
  })

  it('validates VAI-4a action inputs and proration requirements', () => {
    const base = {
      periodKey: '2026-H1',
      recommendationFingerprint: 'a'.repeat(64),
    }

    expect(vatTaxTreatmentMutationSchema.safeParse({
      ...base,
      action: 'apply_recommendation',
    }).success).toBe(true)
    expect(vatTaxTreatmentMutationSchema.safeParse({
      ...base,
      action: 'confirm_different',
      finalDecision: 'prorated',
      reason: '과세·면세 공통매입',
    }).success).toBe(false)
    expect(vatTaxTreatmentMutationSchema.safeParse({
      ...base,
      action: 'confirm_different',
      finalDecision: 'prorated',
      reason: '과세·면세 공통매입',
      prorationRateBps: 6_000,
    }).success).toBe(true)
    expect(vatTaxTreatmentMutationSchema.safeParse({
      ...base,
      action: 'confirm_different',
      finalDecision: 'deductible',
      reason: '업무용',
      prorationRateBps: 6_000,
    }).success).toBe(false)
    expect(vatTaxTreatmentMutationSchema.safeParse({
      periodKey: '2026-H1',
      action: 'undo',
      undoToken: 'efb1bd6a-55b0-4e70-b957-7c6a89019422',
    }).success).toBe(true)
    expect(vatTaxTreatmentMutationSchema.safeParse({
      periodKey: '2026-H1',
      action: 'undo',
      undoToken: 'not-a-token',
    }).success).toBe(false)
  })

  it('validates VAI-6b evidence confirmation and revocation inputs', () => {
    const base = {
      periodKey: '2026-H1',
      recommendationFingerprint: 'a'.repeat(64),
      evidenceCode: 'export_or_zero_rate_documents',
    }

    expect(vatTaxTreatmentEvidenceMutationSchema.safeParse({ ...base, action: 'confirm' }).success).toBe(true)
    expect(vatTaxTreatmentEvidenceMutationSchema.safeParse({ ...base, action: 'revoke' }).success).toBe(true)
    expect(vatTaxTreatmentEvidenceMutationSchema.safeParse({
      ...base,
      evidenceCode: 'arbitrary_document',
      action: 'confirm',
    }).success).toBe(false)
    expect(vatTaxTreatmentEvidenceMutationSuccessSchema.safeParse({
      ok: true,
      evidenceCode: 'export_or_zero_rate_documents',
      status: 'present',
      confirmedAt: '2026-07-11 15:00:00',
    }).success).toBe(true)
  })

  it('validates the browser mutation response before the UI consumes it', () => {
    expect(vatTaxTreatmentMutationSuccessSchema.safeParse({
      ok: true,
      status: 'confirmed',
      finalDecision: 'deductible',
      undoToken: 'efb1bd6a-55b0-4e70-b957-7c6a89019422',
    }).success).toBe(true)
    expect(vatTaxTreatmentMutationSuccessSchema.safeParse({
      ok: true,
      status: 'unexpected',
      finalDecision: 'deductible',
      undoToken: null,
    }).success).toBe(false)
  })
})
