import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))
import { hasPendingFirstRunSampleCleanup, sampleStatusLabel } from './summary'
import { shouldBlockDashboardForSampleCleanup } from './shared'

describe('first-run sample banner state', () => {
  it('labels visible sample states for the dashboard banner (S-20/S-61/S-62)', () => {
    expect(sampleStatusLabel('active')).toBe('샘플 데이터')
    expect(sampleStatusLabel('creating')).toBe('샘플 생성 중')
    expect(sampleStatusLabel('delete_pending')).toBe('샘플 삭제 중')
    expect(sampleStatusLabel('failed')).toBe('샘플 생성 실패')
  })

  it('keeps every dashboard workspace blocked while a deleted dataset still has registry rows', () => {
    expect(hasPendingFirstRunSampleCleanup(1)).toBe(true)
    expect(hasPendingFirstRunSampleCleanup(0)).toBe(false)
    expect(shouldBlockDashboardForSampleCleanup({
      status: 'deleted', visible: false, datasetId: 'sample', clientId: 'client', cleanupPending: true,
    })).toBe(true)
    expect(shouldBlockDashboardForSampleCleanup({
      status: 'deleted', visible: false, datasetId: 'sample', clientId: 'client', cleanupPending: false,
    })).toBe(false)
  })
})
