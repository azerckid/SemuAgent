import { describe, expect, it } from 'vitest'
import { isOutOfCloseScope, parseClosePeriodRange } from './period-scope'

describe('parseClosePeriodRange', () => {
  it('parses quarter range', () => {
    expect(parseClosePeriodRange('2026-04~2026-06')).toEqual({
      start: '2026-04',
      end: '2026-06',
    })
  })

  it('parses single month', () => {
    expect(parseClosePeriodRange('2026-06')).toEqual({
      start: '2026-06',
      end: '2026-06',
    })
  })

  it('returns null for invalid format', () => {
    expect(parseClosePeriodRange('')).toBeNull()
    expect(parseClosePeriodRange('not-a-period')).toBeNull()
    expect(parseClosePeriodRange('2026-06~2026-04')).toBeNull()
  })
})

describe('isOutOfCloseScope', () => {
  const closePeriod = '2026-04~2026-06'

  it('returns false for requested and unknown', () => {
    expect(isOutOfCloseScope({
      attributedPeriod: '2024-01',
      periodRelation: 'requested',
      closePeriod,
    })).toBe(false)
    expect(isOutOfCloseScope({
      attributedPeriod: null,
      periodRelation: 'unknown',
      closePeriod,
    })).toBe(false)
  })

  it('returns false when prior is inside close window (solmate)', () => {
    expect(isOutOfCloseScope({
      attributedPeriod: '2026-04',
      periodRelation: 'prior',
      closePeriod,
    })).toBe(false)
    expect(isOutOfCloseScope({
      attributedPeriod: '2026-05',
      periodRelation: 'prior',
      closePeriod,
    })).toBe(false)
  })

  it('returns true when prior is outside close window (web3people)', () => {
    expect(isOutOfCloseScope({
      attributedPeriod: '2024-01',
      periodRelation: 'prior',
      closePeriod,
    })).toBe(true)
  })

  it('treats month before close start as out of scope', () => {
    expect(isOutOfCloseScope({
      attributedPeriod: '2026-03',
      periodRelation: 'prior',
      closePeriod,
    })).toBe(true)
  })

  it('treats close start month as in scope', () => {
    expect(isOutOfCloseScope({
      attributedPeriod: '2026-04',
      periodRelation: 'prior',
      closePeriod,
    })).toBe(false)
  })
})
