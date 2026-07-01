import { describe, expect, it } from 'vitest'
import {
  applyMailConsoleTokens,
  appendDefaultCriteriaSection,
  deterministicBulkEventId,
  duplicateBasicRequestMessage,
  mailConsoleBulkSendRequestSchema,
  unresolvedMailConsoleTokens,
} from './bulk-send'

const baseInput = {
  requestBatchId: '11111111-1111-4111-8111-111111111111',
  clientIds: ['22222222-2222-4222-8222-222222222222'],
  workType: 'payroll',
  frequency: 'monthly',
  accountingPeriod: '2026-05',
  dueDate: '2026-05-23',
  subject: '[[고객명]] [[회계기간]] 자료 요청',
  body: '[[담당자명]]님, [[업로드링크]]로 제출해 주세요.',
  confirmed: true,
} as const

const client = {
  id: '22222222-2222-4222-8222-222222222222',
  name: '가온상사',
  managerName: '김담당',
}

describe('mailConsoleBulkSendRequestSchema', () => {
  it('requires explicit final confirmation', () => {
    expect(mailConsoleBulkSendRequestSchema.safeParse(baseInput).success).toBe(true)
    expect(
      mailConsoleBulkSendRequestSchema.safeParse({ ...baseInput, confirmed: false }).success,
    ).toBe(false)
  })

  it('accepts per-client CC group overrides', () => {
    expect(
      mailConsoleBulkSendRequestSchema.safeParse({
        ...baseInput,
        clientCcSelections: [
          { clientId: client.id, ccGroupId: '33333333-3333-4333-8333-333333333333' },
        ],
      }).success,
    ).toBe(true)
  })

  it('accepts existing text ids for per-client CC group overrides', () => {
    expect(
      mailConsoleBulkSendRequestSchema.safeParse({
        ...baseInput,
        clientCcSelections: [
          { clientId: client.id, ccGroupId: 'internal-report' },
        ],
      }).success,
    ).toBe(true)
  })

  it('normalizes one-digit accounting months before sending', () => {
    const parsed = mailConsoleBulkSendRequestSchema.parse({
      ...baseInput,
      accountingPeriod: '2026-6',
    })

    expect(parsed.accountingPeriod).toBe('2026-06')
  })
})

describe('mail console token helpers', () => {
  it('replaces client and period tokens while preserving upload link by default', () => {
    expect(applyMailConsoleTokens(baseInput.body, baseInput, client)).toBe(
      '김담당님, [[업로드링크]]로 제출해 주세요.',
    )
  })

  it('flags unknown tokens as unresolved', () => {
    expect(
      unresolvedMailConsoleTokens({ ...baseInput, body: '[[고객명]] [[알수없음]]' }, client),
    ).toEqual(['[[알수없음]]'])
  })

  it('appends bookkeeping criteria to customer-facing general request bodies', () => {
    const body = appendDefaultCriteriaSection('자료를 제출해 주세요.', 'bookkeeping')

    expect(body).toContain('요청 자료 기준')
    expect(body).toContain('- 통장 거래내역')
    expect(body).toContain('- 전표·입출금 정리')
    expect(body).toContain('- 기타 증빙자료')
  })

  it('appends VAT criteria and leaves payroll bodies unchanged', () => {
    expect(appendDefaultCriteriaSection('자료를 제출해 주세요.', 'vat')).toContain('- 사업용 신용카드 사용내역')
    expect(appendDefaultCriteriaSection('급여자료를 제출해 주세요.', 'payroll')).toBe('급여자료를 제출해 주세요.')
  })
})

describe('deterministicBulkEventId', () => {
  it('is stable for the same tenant, batch, and client', () => {
    const first = deterministicBulkEventId({
      tenantId: 'tenant-1',
      requestBatchId: baseInput.requestBatchId,
      clientId: client.id,
    })
    const second = deterministicBulkEventId({
      tenantId: 'tenant-1',
      requestBatchId: baseInput.requestBatchId,
      clientId: client.id,
    })

    expect(first).toBe(second)
    expect(first).toMatch(/^bulk_[a-f0-9]{32}$/)
  })
})

describe('duplicateBasicRequestMessage', () => {
  it('builds the duplicate-send toast copy for monthly payroll requests', () => {
    expect(duplicateBasicRequestMessage({
      workType: 'payroll',
      accountingPeriod: '2026-06',
    })).toBe('이미 2026년 6월 급여정산 자료 요청이 발송되었습니다. 기존 요청을 확인하거나, 비정기 요청으로 새로 생성하세요.')
  })
})
