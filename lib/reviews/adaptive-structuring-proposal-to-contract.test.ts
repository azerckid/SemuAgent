import { describe, expect, it } from 'vitest'
import { deriveReviewAdaptiveModelContractFromProposal } from './adaptive-structuring-proposal-to-contract'
import type { ReviewAdaptiveStructuringProposalResponse } from './adaptive-structuring-proposal-schema'

function readyProposal(
  overrides: Partial<ReviewAdaptiveStructuringProposalResponse> = {},
): ReviewAdaptiveStructuringProposalResponse {
  return {
    status: 'proposal_ready',
    reason: '거래 상세 데이터로 보입니다',
    candidateSheets: [{ sheetName: 'Sheet1', role: 'transaction_detail', confidence: 0.8 }],
    proposedMappings: [
      { sheetName: 'Sheet1', sourceColumn: '거래일자', targetField: 'transactionDate', required: true, confidence: 'high' },
      { sheetName: 'Sheet1', sourceColumn: '거래처', targetField: 'counterparty', required: false, confidence: 'high' },
      { sheetName: 'Sheet1', sourceColumn: '금액', targetField: 'amountKrw', required: false, confidence: 'medium' },
    ],
    sampleRows: [],
    ignoredRegions: [],
    missingRequiredFields: [],
    warnings: [],
    ...overrides,
  }
}

describe('deriveReviewAdaptiveModelContractFromProposal', () => {
  it('builds an executable contract from a proposal_ready proposal', () => {
    const contract = deriveReviewAdaptiveModelContractFromProposal(readyProposal())

    expect(contract).not.toBeNull()
    expect(contract?.targetWorkflow).toBe('bookkeeping')
    expect(contract?.outputMode).toBe('preview_only')
    expect(contract?.workbookSignature.requiredHeaderLabels).toEqual(['거래일자', '금액'])
    expect(contract?.workbookSignature.optionalHeaderLabels).toEqual(['거래처'])
    expect(contract?.fieldMappings).toHaveLength(3)
    expect(contract?.fieldMappings.find((m) => m.targetField === 'amountKrw')?.dataType).toBe('amount')
  })

  it('returns null for a not_eligible proposal', () => {
    const contract = deriveReviewAdaptiveModelContractFromProposal(readyProposal({
      status: 'not_eligible',
      candidateSheets: [],
      proposedMappings: [],
    }))
    expect(contract).toBeNull()
  })

  it('returns null when there are no candidate sheets or mappings', () => {
    const contract = deriveReviewAdaptiveModelContractFromProposal(readyProposal({
      proposedMappings: [],
    }))
    expect(contract).toBeNull()
  })

  it('returns null when no date or amount field was mapped', () => {
    const contract = deriveReviewAdaptiveModelContractFromProposal(readyProposal({
      proposedMappings: [
        { sheetName: 'Sheet1', sourceColumn: '거래처', targetField: 'counterparty', required: false, confidence: 'medium' },
      ],
    }))
    expect(contract).toBeNull()
  })

  it('carries over ignored regions from the proposal', () => {
    const contract = deriveReviewAdaptiveModelContractFromProposal(readyProposal({
      ignoredRegions: [{ sheetName: 'Sheet1', sourceColumnOrRegion: '합계', reason: 'footer_or_total' }],
    }))
    expect(contract?.ignoredRegions).toEqual([
      { sheetName: 'Sheet1', sourceColumnOrRegion: '합계', reason: 'footer_or_total' },
    ])
  })
})
