import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))
import { sampleStatusLabel } from './summary'

describe('first-run sample banner state', () => {
  it('labels visible sample states for the dashboard banner (S-20/S-61/S-62)', () => {
    expect(sampleStatusLabel('active')).toBe('샘플 데이터')
    expect(sampleStatusLabel('creating')).toBe('샘플 생성 중')
    expect(sampleStatusLabel('delete_pending')).toBe('샘플 삭제 중')
    expect(sampleStatusLabel('failed')).toBe('샘플 생성 실패')
  })
})
