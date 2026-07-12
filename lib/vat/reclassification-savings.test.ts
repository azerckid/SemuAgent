import { describe, expect, it } from 'vitest'
import {
  buildReclassificationSavingsCandidate,
  reclassificationSavingsCandidateSchema,
} from './reclassification-savings'

const evaluation = {
  confidence: 'medium' as const,
  suggestedCategory: 'meeting_expense' as const,
  factors: [{
    type: 'internal_event_keyword' as const,
    direction: 'supports' as const,
    summary: '적요에 내부 행사를 특정하는 표현이 있습니다.',
  }],
  missingToConfirm: ['적격증빙 확인 및 사용자 최종 확정'],
}
const eligibleEvidence = { present: true, label: '카드 내역' }

describe('reclassification savings contract (JC-041 VAI-9c)', () => {
  it('uses the exact stored input tax as the maximum additional deduction possibility', () => {
    const result = buildReclassificationSavingsCandidate({
      reviewRowId: 'review-1',
      description: '팀 회식',
      counterparty: '○○한정식',
      supplyAmountKrw: 1_200_000,
      inputTaxKrw: 120_000,
      evaluation,
      eligibleEvidence,
    })

    expect(result.potentialSavingsKrw).toBe(120_000)
    expect(result.savingsBasis).toBe('maximum_additional_input_tax_if_fully_reclassified')
    expect(result.userDecision).toBe('pending')
    expect(result.decisionRowId).toBeNull()
    expect(result.candidateFingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('does not estimate tax from supply or gross amounts', () => {
    const result = buildReclassificationSavingsCandidate({
      reviewRowId: 'review-2',
      description: '팀 미팅',
      counterparty: null,
      supplyAmountKrw: 9_999_999,
      inputTaxKrw: 37_000,
      evaluation,
      eligibleEvidence,
    })

    expect(result.potentialSavingsKrw).toBe(37_000)
  })

  it('rejects a contract whose potential amount differs from the exact input tax', () => {
    const result = reclassificationSavingsCandidateSchema.safeParse({
      reviewRowId: 'review-3',
      description: '팀 회식',
      counterparty: null,
      supplyAmountKrw: 100_000,
      inputTaxKrw: 10_000,
      currentCategory: 'entertainment_expense',
      evaluation,
      potentialSavingsKrw: 9_091,
      savingsBasis: 'maximum_additional_input_tax_if_fully_reclassified',
      eligibleEvidence,
      userDecision: 'pending',
      decisionRowId: null,
      candidateFingerprint: 'a'.repeat(64),
    })

    expect(result.success).toBe(false)
  })

  it('keeps zero input tax as zero possibility instead of inventing a benefit', () => {
    const result = buildReclassificationSavingsCandidate({
      reviewRowId: 'review-4',
      description: '면세 매입',
      counterparty: null,
      supplyAmountKrw: 100_000,
      inputTaxKrw: 0,
      evaluation,
      eligibleEvidence,
    })

    expect(result.potentialSavingsKrw).toBe(0)
  })

  it('keeps a candidate whose optional ledger description is empty', () => {
    const result = buildReclassificationSavingsCandidate({
      reviewRowId: 'review-5',
      description: '',
      counterparty: null,
      supplyAmountKrw: 100_000,
      inputTaxKrw: 10_000,
      evaluation,
      eligibleEvidence,
    })

    expect(result.description).toBe('')
    expect(result.potentialSavingsKrw).toBe(10_000)
  })

  it('stores a prior user decision without changing the exact savings amount', () => {
    const result = buildReclassificationSavingsCandidate({
      reviewRowId: 'review-6',
      description: '외부 거래처 식사',
      counterparty: '거래처',
      supplyAmountKrw: 200_000,
      inputTaxKrw: 20_000,
      evaluation,
      eligibleEvidence,
      userDecision: 'kept_as_is',
      decisionRowId: 'review-6',
    })

    expect(result.userDecision).toBe('kept_as_is')
    expect(result.decisionRowId).toBe('review-6')
    expect(result.potentialSavingsKrw).toBe(20_000)
  })
})
