import { describe, expect, it } from 'vitest'
import { looksPersonallyUseSuspicious } from './reconciliation-personal-use-detection'

describe('looksPersonallyUseSuspicious', () => {
  it('flags known personal-use categories from counterparty or description', () => {
    expect(looksPersonallyUseSuspicious({ counterparty: 'CGV', description: '영화 관람' })).toBe(true)
    expect(looksPersonallyUseSuspicious({ counterparty: 'PC방나라', description: 'PC방 이용' })).toBe(true)
    expect(looksPersonallyUseSuspicious({ counterparty: '헤어살롱', description: '미용실' })).toBe(true)
    expect(looksPersonallyUseSuspicious({ counterparty: '네일샵', description: '네일샵' })).toBe(true)
    expect(looksPersonallyUseSuspicious({ counterparty: null, description: '코인노래방 결제' })).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(looksPersonallyUseSuspicious({ counterparty: 'cgv', description: '결제' })).toBe(true)
    expect(looksPersonallyUseSuspicious({ counterparty: 'Cgv', description: '결제' })).toBe(true)
  })

  it('does not flag ordinary business spending', () => {
    expect(looksPersonallyUseSuspicious({ counterparty: 'Adobe', description: 'Creative Cloud' })).toBe(false)
    expect(looksPersonallyUseSuspicious({ counterparty: 'KT', description: '모바일 통신' })).toBe(false)
    expect(looksPersonallyUseSuspicious({ counterparty: null, description: '사무용품 구매' })).toBe(false)
  })
})
