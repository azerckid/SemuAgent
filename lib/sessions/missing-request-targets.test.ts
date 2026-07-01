import { describe, expect, it } from 'vitest'
import {
  selectGenuineMissingTargets,
  selectUndeclaredMissingTargets,
} from './missing-request-targets'

const target = (itemName: string) => ({ itemName })
const validation = (id: string, itemName: string) => ({ id, itemName })

describe('selectUndeclaredMissingTargets', () => {
  it('keeps targets that are not declared', () => {
    const result = selectUndeclaredMissingTargets(
      [target('통장 거래내역'), target('카드 사용내역')],
      ['통장 거래내역'],
    )

    expect(result.map((item) => item.itemName)).toEqual(['카드 사용내역'])
  })

  it('returns empty when every missing target is declared', () => {
    const result = selectUndeclaredMissingTargets(
      [target('카드 사용내역'), target('매출 세금계산서'), target('현금영수증')],
      ['카드 사용내역', '매출 세금계산서', '현금영수증'],
    )

    expect(result).toEqual([])
  })

  it('matches ignoring trailing descriptions and whitespace', () => {
    const result = selectUndeclaredMissingTargets(
      [target('카드 사용내역: 해당 회계기간의 카드 사용내역 제출')],
      ['  카드 사용내역  '],
    )

    expect(result).toEqual([])
  })
})

describe('selectGenuineMissingTargets', () => {
  it('excludes presentation-submitted items by validation id', () => {
    const result = selectGenuineMissingTargets(
      [validation('card', '카드 사용내역'), validation('bank', '통장 거래내역')],
      new Set(['card']),
      [],
    )

    expect(result.map((item) => item.itemName)).toEqual(['통장 거래내역'])
  })

  it('excludes declared items by normalized name', () => {
    const result = selectGenuineMissingTargets(
      [validation('card', '카드 사용내역 (요청 항목)'), validation('sales', '매출 세금계산서 (요청 항목)')],
      new Set(),
      ['매출 세금계산서'],
    )

    expect(result.map((item) => item.itemName)).toEqual(['카드 사용내역 (요청 항목)'])
  })

  it('returns empty when every item is submitted or declared', () => {
    const result = selectGenuineMissingTargets(
      [
        validation('card', '카드 사용내역 (요청 항목)'),
        validation('sales', '매출 세금계산서 (요청 항목)'),
        validation('purchase', '매입 세금계산서 (요청 항목)'),
        validation('cash', '현금영수증 (요청 항목)'),
      ],
      new Set(['card']),
      ['매출 세금계산서', '매입 세금계산서', '현금영수증'],
    )

    expect(result).toEqual([])
  })
})
