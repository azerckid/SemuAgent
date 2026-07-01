import { describe, expect, it } from 'vitest'
import { fromISO } from '@/lib/time'
import {
  isPayrollExtractionFinalStatus,
  isPayrollRunningBatchStale,
} from './extraction-status'

describe('isPayrollExtractionFinalStatus', () => {
  it('treats completed, failed, and needs_review as final states', () => {
    expect(isPayrollExtractionFinalStatus('completed')).toBe(true)
    expect(isPayrollExtractionFinalStatus('failed')).toBe(true)
    expect(isPayrollExtractionFinalStatus('needs_review')).toBe(true)
  })

  it('does not treat pending, running, or missing status as final', () => {
    expect(isPayrollExtractionFinalStatus('pending')).toBe(false)
    expect(isPayrollExtractionFinalStatus('running')).toBe(false)
    expect(isPayrollExtractionFinalStatus(null)).toBe(false)
  })
})

describe('isPayrollRunningBatchStale', () => {
  const referenceTime = fromISO('2026-06-06T19:30:00.000+09:00')

  it('marks only old running batches as stale', () => {
    expect(isPayrollRunningBatchStale({
      status: 'running',
      createdAt: '2026-06-06T19:19:59.000+09:00',
    }, referenceTime)).toBe(true)

    expect(isPayrollRunningBatchStale({
      status: 'running',
      createdAt: '2026-06-06T19:20:01.000+09:00',
    }, referenceTime)).toBe(false)
  })

  it('ignores final or invalid batch states', () => {
    expect(isPayrollRunningBatchStale({
      status: 'completed',
      createdAt: '2026-06-06T19:00:00.000+09:00',
    }, referenceTime)).toBe(false)

    expect(isPayrollRunningBatchStale({
      status: 'running',
      createdAt: 'not-a-date',
    }, referenceTime)).toBe(false)
  })
})
