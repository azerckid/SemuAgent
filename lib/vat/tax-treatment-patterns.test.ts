import { describe, expect, it } from 'vitest'
import {
  applyPriorConfirmedVatPattern,
  findTiedVatPatternDecisionConflict,
  type VatTaxTreatmentPatternRow,
} from './tax-treatment-patterns'
import type { VatTaxTreatmentRuleResult } from './tax-treatment-rules'

const base: VatTaxTreatmentRuleResult = {
  recommendation: 'needs_review',
  source: 'deterministic_rule',
  confidence: 'low',
  basisLabel: '추가 확인 필요',
  ruleReference: 'P-07',
  requiredEvidence: [],
  missingFacts: ['업무 목적'],
  hometaxAction: 'review_deduction',
}

const target = {
  classificationRowId: 'current',
  transactionDate: '2026-06-15',
  counterparty: 'AWS Korea',
  direction: 'purchase' as const,
  finalAccount: 'fees',
}

function prior(overrides: Partial<VatTaxTreatmentPatternRow> = {}): VatTaxTreatmentPatternRow {
  return {
    classificationRowId: 'prior-1',
    transactionDate: '2026-05-15',
    counterparty: 'AWS-Korea',
    direction: 'purchase',
    finalAccount: 'fees',
    finalDecision: 'deductible',
    ...overrides,
  }
}

describe('VAT prior confirmed patterns', () => {
  it('uses only a dominant prior confirmed decision from the same transaction pattern (S-91)', () => {
    expect(applyPriorConfirmedVatPattern({
      target,
      priorRows: [prior(), prior({ classificationRowId: 'prior-2', transactionDate: '2026-04-15' })],
      base,
    })).toMatchObject({
      recommendation: 'likely_deductible',
      source: 'prior_confirmed_pattern',
      confidence: 'high',
      basisLabel: expect.stringContaining('2건'),
    })
  })

  it('does not use another direction, account, future row, or tied history', () => {
    const incompatible = [
      prior({ direction: 'sale', finalDecision: 'taxable' }),
      prior({ finalAccount: 'vehicle' }),
      prior({ transactionDate: '2026-07-01' }),
    ]
    expect(applyPriorConfirmedVatPattern({ target, priorRows: incompatible, base })).toEqual(base)

    expect(applyPriorConfirmedVatPattern({
      target,
      priorRows: [prior(), prior({ classificationRowId: 'prior-2', finalDecision: 'non_deductible' })],
      base,
    })).toEqual(base)
  })

  it('never overrides a deterministic conclusion', () => {
    expect(applyPriorConfirmedVatPattern({
      target,
      priorRows: [prior()],
      base: { ...base, recommendation: 'likely_non_deductible' },
    })).toMatchObject({
      recommendation: 'likely_non_deductible',
      source: 'deterministic_rule',
    })
  })

  it('reports only a top-count tie as a real prior-decision conflict', () => {
    const deductible = prior()
    const nonDeductible = prior({
      classificationRowId: 'prior-2',
      finalDecision: 'non_deductible',
    })
    expect(findTiedVatPatternDecisionConflict([deductible, nonDeductible])).toEqual({
      decisions: ['deductible', 'non_deductible'],
      references: ['classification:prior-1', 'classification:prior-2'],
    })
    expect(findTiedVatPatternDecisionConflict([
      deductible,
      prior({ classificationRowId: 'prior-3' }),
      nonDeductible,
    ])).toBeNull()
  })
})
