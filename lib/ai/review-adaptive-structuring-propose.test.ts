import { describe, expect, it, vi } from 'vitest'
import {
  buildReviewAdaptiveStructuringProposalPrompt,
  generateReviewAdaptiveStructuringProposal,
  parseReviewAdaptiveStructuringProposalOutput,
  type ReviewAdaptiveSourceText,
  type ReviewAdaptiveStructuringProposalRunner,
} from './review-adaptive-structuring-propose'

const fileTexts: ReviewAdaptiveSourceText[] = [
  { filename: '정산목록.xlsx', sheetName: 'Sheet1', text: '1: 거래일자 | 거래처 | 금액\n2: 2026-06-05 | 거래처A | 320000', summary: null },
]

const readyResponse = {
  status: 'proposal_ready' as const,
  reason: '거래 상세 데이터로 보입니다',
  candidateSheets: [{ sheetName: 'Sheet1', role: 'transaction_detail' as const, confidence: 0.8 }],
  proposedMappings: [{
    sheetName: 'Sheet1',
    sourceColumn: '거래일자',
    targetField: 'transactionDate' as const,
    required: true,
    confidence: 'high' as const,
  }],
  sampleRows: [{ sheetName: 'Sheet1', sourceRowRef: 'row 2', values: { counterparty: '거래처A' } }],
  ignoredRegions: [],
  missingRequiredFields: [],
  warnings: [],
}

describe('generateReviewAdaptiveStructuringProposal', () => {
  it('falls back through providers in order and returns the first success', async () => {
    const runner = vi.fn<ReviewAdaptiveStructuringProposalRunner>(async ({ provider }) => {
      if (provider === 'gemini') return { success: false, provider, error: 'Gemini unavailable' }
      return { success: true, provider, data: readyResponse }
    })

    const result = await generateReviewAdaptiveStructuringProposal(fileTexts, {
      providers: ['gemini', 'openai', 'claude'],
      runner,
    })

    expect(runner).toHaveBeenCalledTimes(2)
    expect(runner.mock.calls.map(([input]) => input.provider)).toEqual(['gemini', 'openai'])
    expect(result.provider).toBe('openai')
    expect(result.data.status).toBe('proposal_ready')
  })

  it('fails closed when every provider fails', async () => {
    const runner = vi.fn<ReviewAdaptiveStructuringProposalRunner>(async ({ provider }) => (
      { success: false, provider, error: 'down' }
    ))

    const result = await generateReviewAdaptiveStructuringProposal(fileTexts, {
      providers: ['gemini', 'openai', 'claude'],
      runner,
    })

    expect(result.provider).toBeNull()
    expect(result.data.status).toBe('needs_more_information')
    expect(result.data.candidateSheets).toEqual([])
    expect(result.data.sampleRows).toEqual([])
    expect(result.data.warnings.length).toBeGreaterThan(0)
  })

  it('does not throw when the runner itself rejects', async () => {
    const runner = vi.fn<ReviewAdaptiveStructuringProposalRunner>(async () => {
      throw new Error('network error')
    })

    const result = await generateReviewAdaptiveStructuringProposal(fileTexts, {
      providers: ['claude'],
      runner,
    })

    expect(result.provider).toBeNull()
    expect(result.data.status).toBe('needs_more_information')
  })
})

describe('buildReviewAdaptiveStructuringProposalPrompt', () => {
  it('masks resident-number/phone/account-number-shaped values in the source workbook text before it is sent to the AI provider', () => {
    const fileTextsWithPii: ReviewAdaptiveSourceText[] = [
      {
        filename: '정산목록.xlsx',
        sheetName: 'Sheet1',
        text: '1: 거래처 | 주민번호 | 휴대폰\n2: 거래처A | 901231-1234567 | 010-1234-5678',
        summary: null,
      },
    ]

    const prompt = buildReviewAdaptiveStructuringProposalPrompt(fileTextsWithPii)

    expect(prompt).not.toContain('901231-1234567')
    expect(prompt).not.toContain('010-1234-5678')
    expect(prompt).toContain('거래처A')
    expect(prompt).toContain('[마스킹됨]')
  })
})

describe('parseReviewAdaptiveStructuringProposalOutput', () => {
  it('parses well-formed JSON output', () => {
    const result = parseReviewAdaptiveStructuringProposalOutput(JSON.stringify(readyResponse))
    expect(result.success).toBe(true)
  })

  it('fails closed on output with no JSON object', () => {
    const result = parseReviewAdaptiveStructuringProposalOutput('이 워크북은 분석할 수 없습니다.')
    expect(result.success).toBe(false)
  })

  it('fails closed on output that violates the schema', () => {
    const result = parseReviewAdaptiveStructuringProposalOutput(JSON.stringify({ status: 'proposal_ready' }))
    expect(result.success).toBe(false)
  })

  it('redacts sensitive-looking sample row values and bounds row count to 5', () => {
    const withSensitiveSamples = {
      ...readyResponse,
      sampleRows: Array.from({ length: 8 }, (_, index) => ({
        sheetName: 'Sheet1',
        sourceRowRef: `row ${index + 2}`,
        values: { counterparty: '거래처A', accountNumber: '1002345678901' },
      })),
    }

    const result = parseReviewAdaptiveStructuringProposalOutput(JSON.stringify(withSensitiveSamples))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sampleRows).toHaveLength(5)
      expect(result.data.sampleRows[0]?.values.accountNumber).toBe('[마스킹됨]')
      expect(result.data.sampleRows[0]?.values.counterparty).toBe('거래처A')
    }
  })
})
