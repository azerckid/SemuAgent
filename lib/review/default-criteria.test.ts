import { describe, expect, it } from 'vitest'
import {
  defaultCriteriaForWorkType,
  formatGeneralDefaultCriteriaForEmail,
  formatGeneralDefaultCriteriaForPrompt,
  GENERAL_BOOKKEEPING_DEFAULT_CRITERIA,
  GENERAL_VAT_DEFAULT_CRITERIA,
  inferGeneralDefaultCriteriaWorkType,
  mergeGeneralDefaultCriteriaRows,
} from './default-criteria'

describe('general bookkeeping default criteria', () => {
  it('keeps the expected default material checklist', () => {
    expect(GENERAL_BOOKKEEPING_DEFAULT_CRITERIA.map((criterion) => criterion.itemName)).toEqual([
      '통장 거래내역',
      '카드 사용내역',
      '매출 세금계산서',
      '매입 세금계산서',
      '현금영수증',
      '온라인 매출/PG 정산자료',
      '전표·입출금 정리',
      '기타 증빙자료',
    ])
  })

  it('marks optional bookkeeping reference items', () => {
    expect(GENERAL_BOOKKEEPING_DEFAULT_CRITERIA.filter((criterion) => criterion.requiredness === 'optional')).toEqual([
      expect.objectContaining({ itemName: '전표·입출금 정리', itemGroup: 'journal_entry_workbook' }),
      expect.objectContaining({ itemName: '기타 증빙자료', itemGroup: 'other_evidence' }),
    ])
  })

  it('marks 기타 증빙자료 as optional', () => {
    expect(GENERAL_BOOKKEEPING_DEFAULT_CRITERIA.at(-1)).toMatchObject({
      itemName: '기타 증빙자료',
      requiredness: 'optional',
    })
  })

  it('formats criteria for the session evaluation prompt', () => {
    const promptText = formatGeneralDefaultCriteriaForPrompt()

    expect(promptText).toContain('통장 거래내역 (요청 항목)')
    expect(promptText).toContain('온라인 매출/PG 정산자료 (요청 항목)')
    expect(promptText).toContain('전표·입출금 정리 (참고 항목)')
    expect(promptText).toContain('기타 증빙자료 (참고 항목)')
  })

  it('formats criteria for customer email body', () => {
    const emailText = formatGeneralDefaultCriteriaForEmail()

    expect(emailText).toContain('요청 자료 기준')
    expect(emailText).toContain('요청 항목\n- 통장 거래내역')
    expect(emailText).toContain('- 온라인 매출/PG 정산자료')
    expect(emailText).toContain('참고 항목\n- 전표·입출금 정리\n- 기타 증빙자료')
  })
})

describe('general VAT default criteria', () => {
  it('keeps VAT criteria separate from bookkeeping criteria', () => {
    expect(GENERAL_VAT_DEFAULT_CRITERIA.map((criterion) => criterion.itemName)).toEqual([
      '매출 세금계산서',
      '매입 세금계산서',
      '신용카드 매출자료',
      '현금영수증 매출자료',
      '사업용 신용카드 사용내역',
      '기타 부가세 증빙자료',
    ])
    expect(defaultCriteriaForWorkType('vat')).toBe(GENERAL_VAT_DEFAULT_CRITERIA)
  })

  it('formats VAT criteria for the session evaluation prompt', () => {
    const promptText = formatGeneralDefaultCriteriaForPrompt('vat')

    expect(promptText).toContain('신용카드 매출자료 (요청 항목)')
    expect(promptText).toContain('기타 부가세 증빙자료 (참고 항목)')
  })

  it('formats VAT criteria for customer email body', () => {
    const emailText = formatGeneralDefaultCriteriaForEmail('vat')

    expect(emailText).toContain('요청 항목\n- 매출 세금계산서')
    expect(emailText).toContain('- 사업용 신용카드 사용내역')
    expect(emailText).toContain('참고 항목\n- 기타 부가세 증빙자료')
  })

  it('infers VAT only from explicit VAT wording', () => {
    expect(inferGeneralDefaultCriteriaWorkType({
      requestEmailSubject: '2026-06 부가세 자료 요청드립니다',
      requestEmailBody: null,
    })).toBe('vat')
    expect(inferGeneralDefaultCriteriaWorkType({
      requestEmailSubject: '2026-06 기장 자료 요청드립니다',
      requestEmailBody: '기장 업무를 위해 자료를 제출해 주세요.',
    })).toBe('bookkeeping')
  })
})

describe('mergeGeneralDefaultCriteriaRows', () => {
  it('adds default criteria missing from an older bookkeeping session', () => {
    const olderRows = GENERAL_BOOKKEEPING_DEFAULT_CRITERIA
      .filter((criterion) => criterion.itemGroup !== 'journal_entry_workbook')
      .map((criterion) => ({
        itemName: criterion.itemName,
        itemGroup: criterion.itemGroup,
        requiredness: criterion.requiredness,
        conditionText: criterion.conditionText,
      }))

    const merged = mergeGeneralDefaultCriteriaRows(olderRows, 'bookkeeping')

    expect(merged).toHaveLength(GENERAL_BOOKKEEPING_DEFAULT_CRITERIA.length)
    expect(merged.map((row) => row.itemName)).toContain('전표·입출금 정리')
    expect(merged.find((row) => row.itemGroup === 'journal_entry_workbook')).toMatchObject({
      itemName: '전표·입출금 정리',
      itemGroup: 'journal_entry_workbook',
      requiredness: 'optional',
    })
  })

  it('does not duplicate existing defaults by item group', () => {
    const merged = mergeGeneralDefaultCriteriaRows(
      GENERAL_BOOKKEEPING_DEFAULT_CRITERIA.map((criterion) => ({
        itemName: criterion.itemName,
        itemGroup: criterion.itemGroup,
        requiredness: criterion.requiredness,
        conditionText: criterion.conditionText,
      })),
      'bookkeeping',
    )

    expect(merged).toHaveLength(GENERAL_BOOKKEEPING_DEFAULT_CRITERIA.length)
    expect(merged.filter((row) => row.itemGroup === 'journal_entry_workbook')).toHaveLength(1)
  })
})
