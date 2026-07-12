import { describe, expect, it } from 'vitest'
import {
  vatTaxTreatmentDisplayRowSchema,
  type VatTaxTreatmentDisplayRow,
} from '@/lib/validations/vat-tax-treatment'
import { shouldEvaluateVatTaxTreatmentRowWithAi } from './tax-treatment-ai-eligibility'
import {
  applyVatTaxTreatmentDecisiveDefault,
  resolveVatTaxTreatmentDecisiveDefault,
} from './tax-treatment-decisive-default'
import { withVatTaxTreatmentRecommendationFingerprint } from './tax-treatment-fingerprint'

function displayRow(overrides: Partial<VatTaxTreatmentDisplayRow> = {}) {
  return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
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
    recommendation: 'needs_review',
    source: 'deterministic_rule',
    confidence: 'low',
    basisLabel: '판단 근거를 확인합니다.',
    ruleReference: 'P-07',
    ruleVersion: 'vat-kr-2026.07-v1',
    requiredEvidence: [{ code: 'business_purpose', label: '업무 목적', status: 'needs_review' }],
    missingFacts: ['업무 목적'],
    hometaxComparisonMode: 'expected_prefill',
    hometaxAction: 'review_deduction',
    aiTrace: null,
    aiRuntimeStatus: 'not_requested',
    finalDecision: null,
    confirmedByStaffId: null,
    confirmedAt: null,
    transactionDate: '2026-06-15',
    counterparty: '테스트 거래처',
    description: '업무용 결제',
    sourceType: 'tax_invoice',
    accountLabel: null,
    userActionStatus: 'pending',
    userActionReason: null,
    ...overrides,
  }))
}

describe('VAT evidence-backed decisive defaults', () => {
  it('defaults an unresolved purchase to non-deductible', () => {
    expect(applyVatTaxTreatmentDecisiveDefault(displayRow())).toMatchObject({
      recommendation: 'likely_non_deductible',
      provisionalJudgment: 'non_deductible',
      judgmentWorkflowStatus: 'no_evidence_defaulted',
      hometaxAction: 'review_deduction',
    })
  })

  it('requires all purchase evidence before keeping a deductible direction', () => {
    const result = applyVatTaxTreatmentDecisiveDefault(displayRow({
      recommendation: 'likely_deductible',
      confidence: 'high',
      requiredEvidence: [
        { code: 'exact_vat_fact', label: '정확한 VAT fact', status: 'present' },
        { code: 'qualified_purchase_evidence', label: '적격 증빙', status: 'present' },
        { code: 'business_purpose', label: '업무 목적', status: 'needs_review' },
      ],
      missingFacts: [],
    }))

    expect(result).toMatchObject({
      recommendation: 'likely_non_deductible',
      judgmentWorkflowStatus: 'no_evidence_defaulted',
    })
    expect(result.missingFacts).toContain('공제 근거 미확인: 업무 사용 목적')
  })

  it('keeps a deductible direction when every required basis is present', () => {
    const row = displayRow({
      recommendation: 'likely_deductible',
      confidence: 'high',
      requiredEvidence: [
        { code: 'exact_vat_fact', label: '정확한 VAT fact', status: 'present' },
        { code: 'qualified_purchase_evidence', label: '적격 증빙', status: 'present' },
        { code: 'business_purpose', label: '업무 목적', status: 'present' },
      ],
      missingFacts: [],
    })

    expect(resolveVatTaxTreatmentDecisiveDefault(row)).toBeNull()
    expect(applyVatTaxTreatmentDecisiveDefault(row)).toBe(row)
  })

  it.each([
    ['likely_zero_rated', 'export_or_zero_rate_documents'],
    ['likely_exempt', 'exemption_qualification'],
  ] as const)('defaults %s sales to taxable without affirmative evidence', (recommendation, code) => {
    const result = applyVatTaxTreatmentDecisiveDefault(displayRow({
      direction: 'sale',
      recommendation,
      currentVatFact: {
        taxType: recommendation === 'likely_zero_rated' ? 'zero_rated' : 'exempt',
        supplyAmountKrw: 110_000,
        taxAmountKrw: 0,
        grossAmountKrw: 110_000,
        source: 'parser',
        status: 'derived',
      },
      requiredEvidence: [{ code, label: '특례 증빙', status: 'needs_review' }],
      missingFacts: ['특례 증빙'],
      hometaxAction: 'review_sales_tax_type',
    }))

    expect(result).toMatchObject({
      recommendation: 'likely_taxable',
      provisionalJudgment: 'taxable',
      judgmentWorkflowStatus: 'no_evidence_defaulted',
    })
  })

  it.each([
    ['likely_zero_rated', 'zero_rated', 'export_or_zero_rate_documents'],
    ['likely_exempt', 'exempt', 'exemption_qualification'],
  ] as const)('keeps %s sales when affirmative evidence is present', (recommendation, taxType, code) => {
    const row = displayRow({
      direction: 'sale',
      recommendation,
      currentVatFact: {
        taxType,
        supplyAmountKrw: 110_000,
        taxAmountKrw: 0,
        grossAmountKrw: 110_000,
        source: 'parser',
        status: 'derived',
      },
      requiredEvidence: [{ code, label: '특례 증빙', status: 'present' }],
      missingFacts: [],
      hometaxAction: 'review_sales_tax_type',
    })

    expect(applyVatTaxTreatmentDecisiveDefault(row)).toBe(row)
  })

  it('does not invent a proration rate or replace final and fallback states', () => {
    const proration = displayRow({
      recommendation: 'proration_required',
      requiredEvidence: [{ code: 'proration_basis', label: '안분 기준', status: 'needs_review' }],
    })
    const confirmed = displayRow({
      recommendation: 'likely_non_deductible',
      finalDecision: 'non_deductible',
      confirmedByStaffId: 'staff-1',
      confirmedAt: '2026-07-13T00:00:00.000Z',
      userActionStatus: 'confirmed',
    })
    const fallback = displayRow({
      recommendation: 'needs_review',
      aiRuntimeStatus: 'manual_fallback',
    })

    expect(applyVatTaxTreatmentDecisiveDefault(proration)).toBe(proration)
    expect(applyVatTaxTreatmentDecisiveDefault(confirmed)).toBe(confirmed)
    expect(applyVatTaxTreatmentDecisiveDefault(fallback)).toBe(fallback)
  })

  it('keeps an AI trace while rejecting an unsupported special treatment and skips another AI call', () => {
    const result = applyVatTaxTreatmentDecisiveDefault(displayRow({
      direction: 'sale',
      recommendation: 'likely_zero_rated',
      currentVatFact: {
        taxType: 'zero_rated',
        supplyAmountKrw: 110_000,
        taxAmountKrw: 0,
        grossAmountKrw: 110_000,
        source: 'parser',
        status: 'derived',
      },
      source: 'ai_single',
      confidence: 'medium',
      ruleReference: null,
      requiredEvidence: [{
        code: 'export_or_zero_rate_documents',
        label: '영세율 증빙',
        status: 'needs_review',
      }],
      missingFacts: ['영세율 증빙'],
      hometaxAction: 'review_sales_tax_type',
      aiTrace: {
        provider: 'openai',
        modelName: 'test-model',
        promptVersion: 'vat-tax-treatment-v5',
        consensusProviders: [],
      },
      aiRuntimeStatus: 'completed',
    }))

    expect(result).toMatchObject({
      recommendation: 'likely_taxable',
      source: 'ai_single',
      judgmentWorkflowStatus: 'no_evidence_defaulted',
      aiRuntimeStatus: 'completed',
    })
    expect(result.aiTrace).not.toBeNull()
    expect(shouldEvaluateVatTaxTreatmentRowWithAi(result)).toBe(false)
  })
})
