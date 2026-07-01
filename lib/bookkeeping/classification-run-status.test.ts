import { describe, expect, it } from 'vitest'
import { fromISO } from '@/lib/time'
import {
  CLASSIFICATION_RUNNING_STALE_MINUTES,
  isClassificationRunningRunStale,
  isFreshClassificationRunningRun,
} from './classification-run-status'

describe('classification run stale detection', () => {
  it('treats running runs older than the stale window as stale', () => {
    const referenceTime = fromISO('2026-06-08T16:30:00.000+09:00')
    const run = {
      status: 'running',
      createdAt: '2026-06-08T15:58:34.000+09:00',
      updatedAt: '2026-06-08T15:58:34.000+09:00',
    }

    expect(isClassificationRunningRunStale(run, referenceTime)).toBe(true)
    expect(isFreshClassificationRunningRun(run, referenceTime)).toBe(false)
  })

  it('keeps recently updated running runs active', () => {
    const referenceTime = fromISO('2026-06-08T16:10:00.000+09:00')
    const run = {
      status: 'running',
      createdAt: '2026-06-08T15:58:34.000+09:00',
      updatedAt: '2026-06-08T16:05:00.000+09:00',
    }

    expect(isClassificationRunningRunStale(run, referenceTime)).toBe(false)
    expect(isFreshClassificationRunningRun(run, referenceTime)).toBe(true)
    expect(CLASSIFICATION_RUNNING_STALE_MINUTES).toBeGreaterThan(0)
  })
})
