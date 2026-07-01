import { describe, expect, it } from 'vitest'
import { groupRequestEventsByKind, normalizeRequestKind } from './grouping'

describe('normalizeRequestKind', () => {
  it('비어 있는 requestKind는 general로 취급한다', () => {
    expect(normalizeRequestKind(null)).toBe('general')
    expect(normalizeRequestKind(undefined)).toBe('general')
    expect(normalizeRequestKind('')).toBe('general')
    expect(normalizeRequestKind('   ')).toBe('general')
  })
})

describe('groupRequestEventsByKind', () => {
  const events = [
    { id: 'general-old', requestKind: 'general', createdAt: '2026-05-20 10:00:00' },
    { id: 'payroll', requestKind: 'payroll', createdAt: '2026-05-20 11:00:00' },
    { id: 'general-new', requestKind: 'general', createdAt: '2026-05-20 12:00:00' },
    { id: 'legacy', requestKind: null, createdAt: '2026-05-20 09:00:00' },
  ]

  it('같은 requestKind의 이벤트를 최신 대표 1건과 중복 항목으로 묶는다', () => {
    const groups = groupRequestEventsByKind(events)

    const general = groups.find((group) => group.requestKind === 'general')
    expect(general?.primary.id).toBe('general-new')
    expect(general?.duplicates.map((event) => event.id)).toEqual(['general-old', 'legacy'])
  })

  it('requestKind별 대표 그룹은 최신 이벤트 순서로 반환한다', () => {
    const groups = groupRequestEventsByKind(events)

    expect(groups.map((group) => group.requestKind)).toEqual(['general', 'payroll'])
    expect(groups.map((group) => group.primary.id)).toEqual(['general-new', 'payroll'])
  })
})
