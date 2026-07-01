import { describe, expect, it } from 'vitest'
import { payrollAdaptiveStructuringProposalResponseSchema } from './adaptive-structuring-proposal-schema'

describe('payrollAdaptiveStructuringProposalResponseSchema', () => {
  it('accepts a well-formed proposal', () => {
    const result = payrollAdaptiveStructuringProposalResponseSchema.safeParse({
      status: 'proposal_ready',
      reason: '급여 지급 데이터로 보입니다',
      candidateSheets: [{ sheetName: 'Sheet1', role: 'payroll_period_payments', confidence: 0.8 }],
      proposedMappings: [{
        sheetName: 'Sheet1',
        sourceColumn: '성명',
        targetField: 'employeeName',
        required: true,
        confidence: 'high',
      }],
      sampleRows: [{ sheetName: 'Sheet1', sourceRowRef: 'row 2', values: { employeeName: '홍길동' } }],
      ignoredRegions: [{ sheetName: 'Sheet1', sourceColumnOrRegion: 'A1:C1', reason: 'metadata' }],
      missingRequiredFields: [],
      warnings: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a missing required top-level field (fail closed)', () => {
    const result = payrollAdaptiveStructuringProposalResponseSchema.safeParse({
      status: 'proposal_ready',
      // reason missing
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown status enum value', () => {
    const result = payrollAdaptiveStructuringProposalResponseSchema.safeParse({
      status: 'auto_applied',
      reason: '자동 적용했습니다',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a field mapping with a targetField outside the allowed list', () => {
    const result = payrollAdaptiveStructuringProposalResponseSchema.safeParse({
      status: 'proposal_ready',
      reason: '테스트',
      proposedMappings: [{
        sheetName: 'Sheet1',
        sourceColumn: '비밀번호',
        targetField: 'employeePassword',
        confidence: 'high',
      }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an ignored region with an unknown reason', () => {
    const result = payrollAdaptiveStructuringProposalResponseSchema.safeParse({
      status: 'proposal_ready',
      reason: '테스트',
      ignoredRegions: [{ sheetName: 'Sheet1', sourceColumnOrRegion: 'A1', reason: 'irrelevant_made_up_reason' }],
    })
    expect(result.success).toBe(false)
  })

  it('defaults optional array fields to empty arrays', () => {
    const result = payrollAdaptiveStructuringProposalResponseSchema.safeParse({
      status: 'not_eligible',
      reason: '기존 추출기가 이미 처리했습니다',
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
