import { describe, expect, it } from 'vitest'
import { reviewAdaptiveStructuringProposalResponseSchema } from './adaptive-structuring-proposal-schema'

describe('reviewAdaptiveStructuringProposalResponseSchema', () => {
  it('accepts a well-formed proposal', () => {
    const result = reviewAdaptiveStructuringProposalResponseSchema.safeParse({
      status: 'proposal_ready',
      reason: '거래 상세 데이터로 보입니다',
      candidateSheets: [{ sheetName: 'Sheet1', role: 'transaction_detail', confidence: 0.8 }],
      proposedMappings: [{
        sheetName: 'Sheet1',
        sourceColumn: '거래일자',
        targetField: 'transactionDate',
        required: true,
        confidence: 'high',
      }],
      sampleRows: [{ sheetName: 'Sheet1', sourceRowRef: 'row 2', values: { counterparty: '거래처A' } }],
      ignoredRegions: [{ sheetName: 'Sheet1', sourceColumnOrRegion: 'A1:C1', reason: 'metadata' }],
      missingRequiredFields: [],
      warnings: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a missing required top-level field (fail closed)', () => {
    const result = reviewAdaptiveStructuringProposalResponseSchema.safeParse({
      status: 'proposal_ready',
      // reason missing
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown status enum value', () => {
    const result = reviewAdaptiveStructuringProposalResponseSchema.safeParse({
      status: 'auto_applied',
      reason: '자동 적용했습니다',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a field mapping with a targetField outside the allowed list', () => {
    const result = reviewAdaptiveStructuringProposalResponseSchema.safeParse({
      status: 'proposal_ready',
      reason: '테스트',
      proposedMappings: [{
        sheetName: 'Sheet1',
        sourceColumn: '주민번호',
        targetField: 'residentNumber',
        confidence: 'high',
      }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an ignored region with an unknown reason', () => {
    const result = reviewAdaptiveStructuringProposalResponseSchema.safeParse({
      status: 'proposal_ready',
      reason: '테스트',
      ignoredRegions: [{ sheetName: 'Sheet1', sourceColumnOrRegion: 'A1', reason: 'irrelevant_made_up_reason' }],
    })
    expect(result.success).toBe(false)
  })

  it('defaults optional array fields to empty arrays', () => {
    const result = reviewAdaptiveStructuringProposalResponseSchema.safeParse({
      status: 'not_eligible',
      reason: '기존 자료검토 로직으로 처리 가능합니다',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.candidateSheets).toEqual([])
      expect(result.data.proposedMappings).toEqual([])
      expect(result.data.sampleRows).toEqual([])
      expect(result.data.ignoredRegions).toEqual([])
      expect(result.data.missingRequiredFields).toEqual([])
      expect(result.data.warnings).toEqual([])
    }
  })
})
