import { describe, expect, it } from 'vitest'
import { bookkeepingClassificationAiOutputSchema } from './schemas'

describe('bookkeeping classification AI output schema', () => {
  it('accepts valid structured transaction output', () => {
    const parsed = bookkeepingClassificationAiOutputSchema.safeParse({
      transactions: [{
        sourceFileId: 'file-1',
        sourceType: 'bank',
        transactionDate: '2026-06-02',
        merchantName: '테스트상사',
        description: '소모품 구매',
        amountKrw: 12000,
        direction: 'expense',
        recommendedAccount: 'supplies',
        confidence: 'high',
        reason: '소모품 구매 적요입니다.',
        evidence: { fieldsUsed: ['description'], needsStaffDecision: false },
      }],
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects unknown account categories', () => {
    const parsed = bookkeepingClassificationAiOutputSchema.safeParse({
      transactions: [{
        sourceFileId: 'file-1',
        sourceType: 'bank',
        direction: 'expense',
        recommendedAccount: 'custom_tax_label',
        confidence: 'high',
        reason: '임의 계정항목',
        evidence: { fieldsUsed: [], needsStaffDecision: false },
      }],
    })

    expect(parsed.success).toBe(false)
  })
})
