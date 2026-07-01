import { describe, expect, it } from 'vitest'
import { formatNumberedSessionDisplayLabel, normalizeSessionDisplayLabel } from './display-labels'

describe('session display labels', () => {
  it('normalizes manual session labels', () => {
    expect(normalizeSessionDisplayLabel('  솔메이트   6월   테스트  ')).toBe('솔메이트 6월 테스트')
  })

  it('formats customer upload labels with a stable two-digit suffix', () => {
    expect(formatNumberedSessionDisplayLabel('솔메이트', 1)).toBe('솔메이트_01')
    expect(formatNumberedSessionDisplayLabel('솔메이트', 12)).toBe('솔메이트_12')
  })

  it('uses a safe fallback when the base name is blank', () => {
    expect(formatNumberedSessionDisplayLabel('   ', 3)).toBe('고객사_03')
  })
})
