import { describe, expect, it } from 'vitest'
import { buildMaterialAttributionGate } from './attribution-gate'
import type { TransactionCandidate } from './schemas'

const duplicateCandidate: TransactionCandidate = {
  sourceFileId: 'file-1',
  sourceFilename: 'mixed-2026-06.xlsx',
  sourceType: 'bank',
  transactionDate: '2026-06-02',
  merchantName: '테스트상사',
  description: '입금 · 테스트상사 · 10000',
  amountKrw: 10000,
  direction: 'income',
  rawRow: ['2026-06-02', '테스트상사', '10000'],
}

describe('buildMaterialAttributionGate', () => {
  it('passes only the included count for duplicate transaction signatures', () => {
    const gate = buildMaterialAttributionGate({
      files: [{ id: 'file-1' }],
      requestedPeriod: '2026-06',
      attributionRows: [
        {
          uploadFileId: 'file-1',
          sourceKind: 'transaction_row',
          sourceLabel: 'mixed-2026-06.xlsx',
          evidenceDate: '2026-06-02',
          attributedPeriod: '2026-06',
          amountKrw: 10000,
          counterparty: '테스트상사',
          description: '입금 · 테스트상사 · 10000',
          recommendation: 'include',
          staffDecision: null,
        },
        {
          uploadFileId: 'file-1',
          sourceKind: 'transaction_row',
          sourceLabel: 'mixed-2026-06.xlsx',
          evidenceDate: '2026-06-02',
          attributedPeriod: '2026-06',
          amountKrw: 10000,
          counterparty: '테스트상사',
          description: '입금 · 테스트상사 · 10000',
          recommendation: 'exclude_duplicate',
          staffDecision: null,
        },
      ],
    })

    expect(gate).not.toBeNull()
    const filtered = gate?.filterCandidates([
      duplicateCandidate,
      { ...duplicateCandidate },
    ])

    expect(filtered).toHaveLength(1)
  })

  it('allows file-summary inclusion only when no transaction rows exist for that file', () => {
    const gate = buildMaterialAttributionGate({
      files: [{ id: 'file-1' }],
      requestedPeriod: '2026-06',
      attributionRows: [{
        uploadFileId: 'file-1',
        sourceKind: 'file_summary',
        sourceLabel: 'unparsed-2026-06.xlsx',
        evidenceDate: null,
        attributedPeriod: '2026-06',
        amountKrw: null,
        counterparty: null,
        description: '거래 행을 자동 추출하지 못해 파일 단위로 검토합니다.',
        recommendation: 'include',
        staffDecision: null,
      }],
    })

    expect(gate?.sourceFiles.map((file) => file.id)).toEqual(['file-1'])
    expect(gate?.filterCandidates([duplicateCandidate])).toHaveLength(1)
  })

  it('filters included attribution rows to the requested bookkeeping period', () => {
    const gate = buildMaterialAttributionGate({
      files: [{ id: 'file-1' }],
      requestedPeriod: '2026-06',
      attributionRows: [
        {
          uploadFileId: 'file-1',
          sourceKind: 'transaction_row',
          sourceLabel: 'mixed-year.xlsx',
          evidenceDate: '2026-05-31',
          attributedPeriod: '2026-05',
          amountKrw: 50000,
          counterparty: '이전월상사',
          description: '5월 거래',
          recommendation: 'include',
          staffDecision: null,
        },
        {
          uploadFileId: 'file-1',
          sourceKind: 'transaction_row',
          sourceLabel: 'mixed-year.xlsx',
          evidenceDate: '2026-06-02',
          attributedPeriod: '2026-06',
          amountKrw: 10000,
          counterparty: '테스트상사',
          description: '입금 · 테스트상사 · 10000',
          recommendation: 'include',
          staffDecision: null,
        },
        {
          uploadFileId: 'file-1',
          sourceKind: 'transaction_row',
          sourceLabel: 'mixed-year.xlsx',
          evidenceDate: '2026-07-01',
          attributedPeriod: '2026-07',
          amountKrw: 70000,
          counterparty: '다음월상사',
          description: '7월 거래',
          recommendation: 'include',
          staffDecision: null,
        },
      ],
    })

    const filtered = gate?.filterCandidates([
      {
        ...duplicateCandidate,
        transactionDate: '2026-05-31',
        merchantName: '이전월상사',
        description: '5월 거래',
        amountKrw: 50000,
      },
      duplicateCandidate,
      {
        ...duplicateCandidate,
        transactionDate: '2026-07-01',
        merchantName: '다음월상사',
        description: '7월 거래',
        amountKrw: 70000,
      },
    ])

    expect(filtered).toEqual([duplicateCandidate])
  })
})
