import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  vatTaxTreatmentDisplayRowSchema,
  type VatTaxTreatmentDisplayRow,
} from '@/lib/validations/vat-tax-treatment'
import { withVatTaxTreatmentRecommendationFingerprint } from './tax-treatment-fingerprint'
import { buildVatTaxTreatmentGate } from './tax-treatment-gate'

function row(overrides: Partial<VatTaxTreatmentDisplayRow> = {}): VatTaxTreatmentDisplayRow {
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
    recommendation: 'likely_deductible',
    source: 'deterministic_rule',
    confidence: 'medium',
    basisLabel: '사용자 확인 대상입니다.',
    ruleReference: 'P-01',
    ruleVersion: 'vat-kr-2026.07-v1',
    requiredEvidence: [
      { code: 'exact_vat_fact', label: '정확한 VAT fact', status: 'present' },
    ],
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

describe('VAT tax-treatment downstream gate', () => {
  it('blocks a recommendation until the user confirms a canonical decision', () => {
    expect(buildVatTaxTreatmentGate([row()])).toMatchObject({
      isReady: false,
      blockerCount: 1,
      unconfirmedCount: 1,
    })
  })

  it('treats held and expert-review rows as unresolved user decisions', () => {
    const result = buildVatTaxTreatmentGate([
      row({ rowId: 'held', classificationRowId: 'held', userActionStatus: 'held' }),
      row({ rowId: 'expert', classificationRowId: 'expert', userActionStatus: 'expert_review' }),
    ])

    expect(result).toMatchObject({
      isReady: false,
      blockerCount: 2,
      unconfirmedCount: 2,
      heldCount: 1,
      expertReviewCount: 1,
    })
  })

  it('allows only rows with a user-confirmed canonical decision', () => {
    expect(buildVatTaxTreatmentGate([row({
      finalDecision: 'deductible',
      confirmedByStaffId: 'staff-1',
      confirmedAt: '2026-07-11T00:00:00.000Z',
      userActionStatus: 'confirmed',
    })])).toMatchObject({
      isReady: true,
      blockerCount: 0,
      unconfirmedCount: 0,
    })
  })

  it('keeps missing required evidence blocked even if a malformed upstream state says confirmed', () => {
    expect(buildVatTaxTreatmentGate([row({
      direction: 'sale',
      currentVatFact: {
        taxType: 'zero_rated',
        supplyAmountKrw: 100_000,
        taxAmountKrw: 0,
        grossAmountKrw: 100_000,
        source: 'manual',
        status: 'confirmed',
      },
      recommendation: 'likely_zero_rated',
      confidence: 'low',
      requiredEvidence: [
        { code: 'exact_vat_fact', label: '정확한 VAT fact', status: 'present' },
        { code: 'export_or_zero_rate_documents', label: '영세율 증빙', status: 'needs_review' },
      ],
      hometaxAction: 'review_sales_tax_type',
      finalDecision: 'zero_rated',
      confirmedByStaffId: 'staff-1',
      confirmedAt: '2026-07-11T00:00:00.000Z',
      userActionStatus: 'confirmed',
    })])).toMatchObject({
      isReady: false,
      blockerCount: 1,
      unconfirmedCount: 0,
      evidenceIncompleteCount: 1,
    })
  })

  it('counts one row once when both user decision and proration basis are incomplete', () => {
    expect(buildVatTaxTreatmentGate([row({
      recommendation: 'proration_required',
      requiredEvidence: [
        { code: 'exact_vat_fact', label: '정확한 VAT fact', status: 'present' },
        { code: 'proration_basis', label: '안분 근거', status: 'needs_review' },
      ],
      hometaxAction: 'review_proration',
    })])).toMatchObject({
      blockerCount: 1,
      unconfirmedCount: 1,
      evidenceIncompleteCount: 1,
      prorationIncompleteCount: 1,
    })
  })

  it('allows a user-confirmed proration only when its basis is present', () => {
    expect(buildVatTaxTreatmentGate([row({
      recommendation: 'proration_required',
      requiredEvidence: [
        { code: 'exact_vat_fact', label: '정확한 VAT fact', status: 'present' },
        { code: 'proration_basis', label: '안분 근거', status: 'present' },
      ],
      hometaxAction: 'review_proration',
      finalDecision: 'prorated',
      confirmedByStaffId: 'staff-1',
      confirmedAt: '2026-07-11T00:00:00.000Z',
      userActionStatus: 'confirmed',
    })])).toMatchObject({
      isReady: true,
      blockerCount: 0,
      prorationIncompleteCount: 0,
    })
  })

  it('treats an empty exact-VAT scope as ready and leaves source validity to provenance', () => {
    expect(buildVatTaxTreatmentGate([])).toMatchObject({
      isReady: true,
      blockerCount: 0,
    })
  })

  it('loads the server gate without invoking AI providers', () => {
    const source = readFileSync(new URL('./tax-treatment-gate.ts', import.meta.url), 'utf8')

    expect(source).not.toContain('includeAi')
    expect(source).toContain('includeStoredAi: false')
    expect(source).not.toContain('enhanceVatTaxTreatmentRowsWithAi')
  })
})
