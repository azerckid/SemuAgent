import { describe, expect, it } from 'vitest'
import { derivePayrollAdaptiveModelContractFromProposal } from './adaptive-structuring-proposal-to-contract'
import type { PayrollAdaptiveStructuringProposalResponse } from './adaptive-structuring-proposal-schema'

function readyProposal(
  overrides: Partial<PayrollAdaptiveStructuringProposalResponse> = {},
): PayrollAdaptiveStructuringProposalResponse {
  return {
    status: 'proposal_ready',
    reason: '급여 지급 데이터로 보입니다',
    candidateSheets: [{ sheetName: 'Sheet1', role: 'payroll_period_payments', confidence: 0.8 }],
    proposedMappings: [
      { sheetName: 'Sheet1', sourceColumn: '성명', targetField: 'employeeName', required: true, confidence: 'high' },
      { sheetName: 'Sheet1', sourceColumn: '지급월', targetField: 'payrollMonth', required: true, confidence: 'high' },
      { sheetName: 'Sheet1', sourceColumn: '기본급', targetField: 'baseSalary', required: false, confidence: 'medium' },
    ],
    sampleRows: [],
    ignoredRegions: [],
    missingRequiredFields: [],
    warnings: [],
    ...overrides,
  }
}

describe('derivePayrollAdaptiveModelContractFromProposal', () => {
  it('builds an executable contract from a proposal_ready proposal', () => {
    const contract = derivePayrollAdaptiveModelContractFromProposal(readyProposal())

    expect(contract).not.toBeNull()
    expect(contract?.outputMode).toBe('preview_only')
    expect(contract?.workbookSignature.requiredHeaderLabels).toEqual(['성명', '지급월'])
    expect(contract?.workbookSignature.optionalHeaderLabels).toEqual(['기본급'])
    expect(contract?.fieldMappings).toHaveLength(3)
    expect(contract?.fieldMappings.find((m) => m.targetField === 'baseSalary')?.dataType).toBe('amount')
  })

  it('returns null for a not_eligible proposal', () => {
    const contract = derivePayrollAdaptiveModelContractFromProposal(readyProposal({
      status: 'not_eligible',
      candidateSheets: [],
      proposedMappings: [],
    }))
    expect(contract).toBeNull()
  })

  it('returns null when there are no candidate sheets or mappings', () => {
    const contract = derivePayrollAdaptiveModelContractFromProposal(readyProposal({
      proposedMappings: [],
    }))
    expect(contract).toBeNull()
  })

  it('returns null when no identity or period field was mapped', () => {
    const contract = derivePayrollAdaptiveModelContractFromProposal(readyProposal({
      proposedMappings: [
        { sheetName: 'Sheet1', sourceColumn: '기본급', targetField: 'baseSalary', required: false, confidence: 'medium' },
      ],
    }))
    expect(contract).toBeNull()
  })

  it('carries over ignored regions from the proposal', () => {
    const contract = derivePayrollAdaptiveModelContractFromProposal(readyProposal({
      ignoredRegions: [{ sheetName: 'Sheet1', sourceColumnOrRegion: '합계', reason: 'footer_or_total' }],
    }))
    expect(contract?.ignoredRegions).toEqual([
      { sheetName: 'Sheet1', sourceColumnOrRegion: '합계', reason: 'footer_or_total' },
    ])
  })
})
