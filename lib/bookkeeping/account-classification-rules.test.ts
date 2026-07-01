import { describe, expect, it } from 'vitest'
import {
  recommendAccountForCandidate,
  selectAiClassificationCandidates,
} from './account-classification-rules'
import type { TransactionCandidate } from './schemas'

function candidate(params: Partial<TransactionCandidate>): TransactionCandidate {
  return {
    sourceFileId: 'file-1',
    sourceFilename: '우리은행 거래내역조회(102)-4~6월.xlsx',
    sourceType: 'bank',
    transactionDate: '2026-04-01',
    merchantName: params.merchantName ?? '테스트',
    description: params.description ?? '',
    amountKrw: params.amountKrw ?? 10000,
    direction: params.direction ?? 'expense',
    rawRow: params.rawRow ?? [],
    ...params,
  }
}

describe('recommendAccountForCandidate', () => {
  it('classifies sample settlement deposits as sales', () => {
    expect(recommendAccountForCandidate(candidate({
      merchantName: 'Npay정산',
      description: '네이버파이낸셜주식회사 결제서비스',
      direction: 'income',
    })).account).toBe('sales')
  })

  it('classifies fuel and vehicle transactions as vehicle maintenance', () => {
    expect(recommendAccountForCandidate(candidate({
      merchantName: '농협김경숙',
      description: '3월 주유비',
    })).account).toBe('vehicle')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '경찰청_디와이인',
      description: '속도위반과태료 160누9295',
    })).account).toBe('vehicle')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '인터넷',
      description: '우리은행 4월 시트 5행 · 인터넷 · 농협김경숙 · 4월 주유비',
      rawRow: ['5', '2026.04.02 11:57:47', '인터넷', '농협김경숙', '1,059,500', '0', '3월 주유비'],
    })).account).toBe('vehicle')
  })

  it('classifies professional service and banking fees as fees', () => {
    expect(recommendAccountForCandidate(candidate({
      merchantName: '동성회계법인',
      description: '세무서비스 기장대리',
    })).account).toBe('fees')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '김기동(세무사김기동',
      description: '2024-07 세무대리 기장료',
    })).account).toBe('fees')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '우리은행',
      description: '송금수수료',
    })).account).toBe('fees')
  })

  it('classifies file-summary evidence for utilities, telecommunication, and purchase invoices', () => {
    expect(recommendAccountForCandidate(candidate({
      sourceFilename: '2024.7월납부.jpg',
      sourceType: 'receipt',
      merchantName: '분당풍림아이원플러스',
      description: '관리비 납부확인서 고지년월 2024-07 수납금액 351,510원',
    })).account).toBe('utilities')
    expect(recommendAccountForCandidate(candidate({
      sourceFilename: '2024.07월분 도현우.jpg',
      sourceType: 'receipt',
      merchantName: 'LGU+신영화',
      description: '통신비 영수증 고객보관용 2024-07 수납금액 62,190원',
    })).account).toBe('communication')
    expect(recommendAccountForCandidate(candidate({
      merchantName: 'LGU+신영화',
      description: '하나은행 2024-07 시트 212행',
    })).account).toBe('communication')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '거래처 미확인',
      description: '김영수증 2024년 7월 31일 발행된 (주)LG유플러스의 통신요금 카드 결제 영수증입니다.',
      direction: 'income',
    })).account).toBe('communication')
    expect(recommendAccountForCandidate(candidate({
      sourceFilename: '2024.07.jpg',
      sourceType: 'tax_invoice',
      description: '매입 세금계산서 공급가액 1,200,000원',
    })).account).toBe('purchase_goods')
  })

  it('keeps insurance separate from public dues', () => {
    expect(recommendAccountForCandidate(candidate({
      merchantName: '서울보증보험',
      description: '보증보험료 납부',
    })).account).toBe('insurance')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '국민건강보험공단',
      description: '4대보험 건강보험 납부',
    })).account).toBe('taxes_dues')
  })

  it('classifies ad, welfare, entertainment, supplies, and purchase patterns', () => {
    expect(recommendAccountForCandidate(candidate({
      merchantName: '네이버 주식회사',
      description: '네이버광고 비즈머니 충전',
    })).account).toBe('advertising')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '식당',
      description: '법인카드-식대',
    })).account).toBe('employee_welfare')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '행복국밥',
      description: '점심 식사',
    })).account).toBe('employee_welfare')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '스타벅스',
      description: '직원 커피',
    })).account).toBe('employee_welfare')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '호오탕훠쿼',
      description: '저녁 식사',
    })).account).toBe('employee_welfare')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '서현순대분당본',
      description: '점심 식대',
    })).account).toBe('employee_welfare')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '서현순대분당본',
      description: '과거거래내역조회20250327 시트 10행',
    })).account).toBe('employee_welfare')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '호오탕훠궈',
      description: '과거거래내역조회20250327 시트 11행',
    })).account).toBe('employee_welfare')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '보경이네중국식',
      description: '과거거래내역조회20250327 시트 12행',
    })).account).toBe('employee_welfare')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '장덕장어',
      description: '거래처 접대비',
    })).account).toBe('entertainment')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '황동현',
      description: '씨앤텍_부사장 자녀 축의금',
    })).account).toBe('entertainment')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '주식회사스마트로',
      description: '법인카드-소모품비',
    })).account).toBe('supplies')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '거래처',
      description: '스프레이 용기 물품대금',
    })).account).toBe('purchase_goods')
  })

  it('classifies remaining field-test unclassified patterns with explicit evidence', () => {
    expect(recommendAccountForCandidate(candidate({
      merchantName: '이엠텍',
      description: '기업은행 4월 시트 9행 · 이엠텍 · 임대료',
      rawRow: ['6', '2026-04-02 09:35:05', '2,750,000', '0', '6,794,329', '이엠텍', '인터넷', '임대료'],
    })).account).toBe('rent')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '용인처인구（주식회사',
      description: '기업은행 4월 시트 60행 · 법인지방소득세',
      rawRow: ['57', '2026-04-24 15:57:52', '1,045,980', '0', '용인처인구（주식회사', '법인지방소득세'],
    })).account).toBe('taxes_dues')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '엔에이치엔클라우',
      description: '우리은행 4월 시트 10행 · 도메인 연장',
      rawRow: ['6', '2026.04.02 14:27:35', '인터넷', '엔에이치엔클라우', '49,500', '0', '도메인 연장'],
    })).account).toBe('domain_hosting')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '엔에이치엔커머스',
      description: '우리은행 5월 시트 27행 · 사이트연장',
      rawRow: ['23', '2026.05.18 11:13:51', '인터넷', '엔에이치엔커머스', '33,000', '0', '사이트연장'],
    })).account).toBe('domain_hosting')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '박진숙(Park·진',
      description: '우리은행 5월 시트 16행 · 반품 왕복 배송비',
      rawRow: ['12', '2026.05.11 15:55:48', '모바일', '박진숙(Park·진', '0', '100,000', '반품 왕복 배송비'],
    })).account).toBe('shipping')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '2026년결산',
      description: '기업은행 4월 시트 43행 · 이자',
      rawRow: ['40', '2026-04-20 08:11:47', '0', '1,258', '2026년결산', '이자'],
    })).account).toBe('interest_income')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '2026년결산',
      description: '이자입금',
      direction: 'income',
      rawRow: ['25', '2026-05-18 08:28:37', '0', '1,486', '2026년결산', '이자'],
    })).account).toBe('interest_income')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '2026년결산',
      description: '결산 조정 입금',
      direction: 'income',
      rawRow: ['25', '2026-05-18 08:28:37', '0', '1,486', '2026년결산'],
    })).account).toBe('sales')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '비씨카드출금',
      description: '기업은행 4월 시트 64행 · 카드대금',
      rawRow: ['61', '2026-04-27 08:09:52', '2,693,966', '0', '비씨카드출금', 'BC', '카드대금'],
    })).account).toBe('card_payment')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '하나카드기업',
      description: '하나카드 기업카드 결제대금',
      rawRow: ['1', '2024-01-02 04:52', '하나카드기업', '0', '400'],
    })).account).toBe('card_payment')
  })

  it('classifies taxi and public transport patterns as travel transport', () => {
    expect(recommendAccountForCandidate(candidate({
      merchantName: '카카오T택시',
      description: '업무 이동 택시비',
    })).account).toBe('travel_transport')
    expect(recommendAccountForCandidate(candidate({
      merchantName: '티머니',
      description: '교통카드 충전',
    })).account).toBe('travel_transport')
  })

  it('leaves truly vague transfer rows for staff review', () => {
    const recommendation = recommendAccountForCandidate(candidate({
      merchantName: '이체',
      description: '이체',
      rawRow: ['이체'],
    }))
    expect(recommendation.account).toBe('unclassified')
    expect(recommendation.needsStaffDecision).toBe(true)
  })

  it('does not cap unresolved candidates before AI classification', () => {
    const candidates = Array.from({ length: 25 }, (_, index) => candidate({
      sourceFileId: `file-${index}`,
      merchantName: `거래처${index}`,
      description: `이체 ${index}`,
      rawRow: [`${index}`, '2024-07-01', `거래처${index}`, '0', String(1000 + index)],
    }))

    expect(selectAiClassificationCandidates(candidates)).toHaveLength(25)
  })
})
