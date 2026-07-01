import { describe, expect, it } from 'vitest'
import { deterministicDirectSessionEventId } from './direct-send'

const baseInput = {
  tenantId: 'tenant-1',
  clientId: 'client-1',
  accountingPeriod: '2026-05',
  closingDateISO: '2026-05-31',
  requestEmailSubject: '2026-05 자료 요청',
  requestEmailBody: '자료를 업로드해 주세요.',
  requestEmailGreeting: '안녕하세요.',
  senderPhone: '010-0000-0000',
  requestEmailCc: 'owner@example.com',
  extractedCriteria: '매출 자료',
  additionalCriteria: '통장 사본',
  analysisNotes: '영수증 확인',
}

describe('deterministicDirectSessionEventId', () => {
  it('is stable for the same direct session request payload', () => {
    const first = deterministicDirectSessionEventId(baseInput)
    const second = deterministicDirectSessionEventId(baseInput)

    expect(first).toBe(second)
    expect(first).toMatch(/^direct_[a-f0-9]{32}$/)
  })

  it('changes when the email body changes', () => {
    const first = deterministicDirectSessionEventId(baseInput)
    const second = deterministicDirectSessionEventId({
      ...baseInput,
      requestEmailBody: '다른 자료를 업로드해 주세요.',
    })

    expect(second).not.toBe(first)
  })
})
