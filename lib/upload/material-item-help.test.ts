import { describe, expect, it } from 'vitest'
import { getMaterialItemHelp } from './material-item-help'

describe('getMaterialItemHelp', () => {
  it('통장/카드/세금계산서 등 자주 막히는 항목에 안내를 돌려준다', () => {
    expect(getMaterialItemHelp('통장 거래내역')?.title).toContain('통장')
    expect(getMaterialItemHelp('법인카드 사용내역')?.title).toContain('카드')
    expect(getMaterialItemHelp('매출 세금계산서')?.title).toContain('세금계산서')
    expect(getMaterialItemHelp('현금영수증')?.title).toContain('현금영수증')
    expect(getMaterialItemHelp('네이버페이 정산내역')?.title).toContain('온라인')
  })

  it('각 안내는 단계(steps)를 최소 1개 이상 포함한다', () => {
    const help = getMaterialItemHelp('통장 거래내역')
    expect(help).not.toBeNull()
    expect(help!.steps.length).toBeGreaterThan(0)
  })

  it('매칭되는 자료 종류가 없으면 null을 돌려준다(억지로 붙이지 않는다)', () => {
    expect(getMaterialItemHelp('기타 증빙자료')).toBeNull()
    expect(getMaterialItemHelp('대표자 메모')).toBeNull()
    expect(getMaterialItemHelp('')).toBeNull()
  })

  it('대소문자/영문 키워드도 매칭한다', () => {
    expect(getMaterialItemHelp('PG 정산자료')?.title).toContain('온라인')
  })
})
