import { describe, expect, it } from 'vitest'
import { createStaffDirectUploadSchema } from './staff-direct-upload'

const baseInput = {
  clientId: 'client-1',
  displayLabel: '솔메이트 테스트',
  workType: 'payroll',
  accountingPeriod: '2021-01',
  analysisNotes: '',
} as const

describe('createStaffDirectUploadSchema', () => {
  it('allows old accounting periods without asking testers for a due date', () => {
    const parsed = createStaffDirectUploadSchema.safeParse(baseInput)

    expect(parsed.success).toBe(true)
  })

  it('ignores legacy dueDate input because staff direct upload expiry is server-calculated', () => {
    const parsed = createStaffDirectUploadSchema.safeParse({
      ...baseInput,
      dueDate: '2021-01-13',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect('dueDate' in parsed.data).toBe(false)
    }
  })

  it('allows bookkeeping period type and yearly period input', () => {
    const parsed = createStaffDirectUploadSchema.safeParse({
      clientId: 'client-1',
      displayLabel: '솔메이트 연간 테스트',
      workType: 'bookkeeping',
      accountingPeriod: '2026',
      bookkeepingPeriodType: 'yearly',
      analysisNotes: '',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.bookkeepingPeriodType).toBe('yearly')
    }
  })

  it('requires a manual display label for staff direct upload sessions', () => {
    const parsed = createStaffDirectUploadSchema.safeParse({
      ...baseInput,
      displayLabel: '   ',
    })

    expect(parsed.success).toBe(false)
  })

  it('trims the manual display label', () => {
    const parsed = createStaffDirectUploadSchema.safeParse({
      ...baseInput,
      displayLabel: '  솔메이트 6월 급여  ',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.displayLabel).toBe('솔메이트 6월 급여')
    }
  })
})
