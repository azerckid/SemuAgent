import { describe, expect, it } from 'vitest'
import {
  evaluateVatTaxTreatmentRule,
  type VatTaxTreatmentDeductionContext,
  type VatTaxTreatmentRuleRow,
} from './tax-treatment-rules'

function row(overrides: Partial<VatTaxTreatmentRuleRow> = {}): VatTaxTreatmentRuleRow {
  return {
    id: 'row-1',
    sourceType: 'tax_invoice',
    merchantName: '클라우드서비스',
    description: '업무용 SaaS 이용료',
    finalAccount: 'fees',
    staffMemo: '업무용 서비스',
    vatDirection: 'purchase',
    vatTaxType: 'taxable',
    ...overrides,
  }
}

function evaluate(
  rowOverrides: Partial<VatTaxTreatmentRuleRow> = {},
  deduction: VatTaxTreatmentDeductionContext = null,
) {
  return evaluateVatTaxTreatmentRule({ row: row(rowOverrides), deduction })
}

describe('VAT deterministic purchase rules', () => {
  it('maps a confirmed business purchase to P-01 without an LLM (VAI-P01)', () => {
    expect(evaluate()).toMatchObject({
      recommendation: 'likely_deductible',
      source: 'deterministic_rule',
      ruleReference: expect.stringContaining('P-01'),
      hometaxAction: 'expected_no_change',
    })
  })

  it('flags likely personal card use for deduction review (VAI-P02)', () => {
    expect(evaluate({
      sourceType: 'card',
      merchantName: 'PC방나라',
      description: 'PC방 이용',
      finalAccount: 'employee_welfare',
      staffMemo: null,
    })).toMatchObject({
      recommendation: 'likely_non_deductible',
      confidence: 'medium',
      ruleReference: expect.stringContaining('P-02'),
      hometaxAction: 'review_deduction',
    })
  })

  it('flags entertainment and holds vehicle expenses for facts (VAI-P03)', () => {
    expect(evaluate({ finalAccount: 'entertainment' })).toMatchObject({
      recommendation: 'likely_non_deductible',
      ruleReference: expect.stringContaining('P-03'),
    })
    expect(evaluate({ finalAccount: 'vehicle' })).toMatchObject({
      recommendation: 'needs_review',
      ruleReference: expect.stringContaining('P-04'),
      missingFacts: ['차량 종류와 영업용 여부'],
    })
  })

  it('requires proration evidence for common taxable/exempt purchases (VAI-P04)', () => {
    expect(evaluate({}, {
      kind: 'proration_required',
      decision: 'pending',
      reason: '공통매입',
      prorationRateBps: null,
    })).toMatchObject({
      recommendation: 'proration_required',
      ruleReference: expect.stringContaining('P-06'),
      hometaxAction: 'review_proration',
    })
  })

  it('prioritizes every confirmed decision over stale kind (P1 regression)', () => {
    expect(evaluate({}, {
      kind: 'deductible',
      decision: 'non_deductible',
      reason: '사용자 불공제 확정',
      prorationRateBps: null,
    })).toMatchObject({
      recommendation: 'likely_non_deductible',
      confidence: 'high',
      basisLabel: '사용자 불공제 확정',
    })

    expect(evaluate({}, {
      kind: 'non_deductible_candidate',
      decision: 'deductible',
      reason: '사용자 공제 확정',
      prorationRateBps: null,
    })).toMatchObject({
      recommendation: 'likely_deductible',
      confidence: 'high',
      basisLabel: '이미 사용자가 매입세액 공제로 확정한 거래입니다.',
    })

    expect(evaluate({}, {
      kind: 'deductible',
      decision: 'prorated',
      reason: '사용자 안분 확정',
      prorationRateBps: 6_000,
    })).toMatchObject({
      recommendation: 'proration_required',
      confidence: 'high',
      basisLabel: '사용자 안분 확정',
      missingFacts: [],
    })
  })
})

describe('VAT deterministic sales rules', () => {
  it('marks exact domestic taxable sales as likely taxable (VAI-S01)', () => {
    expect(evaluate({
      vatDirection: 'sale',
      vatTaxType: 'taxable',
      finalAccount: 'sales',
    })).toMatchObject({
      recommendation: 'likely_taxable',
      confidence: 'high',
      ruleReference: expect.stringContaining('S-01'),
      hometaxAction: 'expected_no_change',
    })
  })

  it('keeps zero-rated and exempt possibilities unconfirmed without legal evidence (VAI-S02, VAI-S03)', () => {
    const zeroRated = evaluate({ vatDirection: 'sale', vatTaxType: 'zero_rated', finalAccount: 'sales' })
    const exempt = evaluate({ vatDirection: 'sale', vatTaxType: 'exempt', finalAccount: 'sales' })

    expect(zeroRated).toMatchObject({
      recommendation: 'likely_zero_rated',
      confidence: 'low',
      hometaxAction: 'review_sales_tax_type',
    })
    expect(zeroRated.requiredEvidence).toContainEqual(expect.objectContaining({
      code: 'export_or_zero_rate_documents',
      status: 'needs_review',
    }))
    expect(exempt.requiredEvidence).toContainEqual(expect.objectContaining({
      code: 'exemption_qualification',
      status: 'needs_review',
    }))
  })
})
