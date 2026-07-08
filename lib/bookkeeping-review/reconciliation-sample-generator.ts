import { DateTime } from 'luxon'

export const RECONCILIATION_SAMPLE_MONTHS = [
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
] as const

export const BANK_PER_MONTH = 35
export const MATCHED_BANK_PER_MONTH = 34
export const CARD_PER_MONTH = 15
export const MATCHED_CARD_PER_MONTH = 14
export const ORPHAN_TAX_PER_MONTH = 2

export const RECONCILIATION_BANK_SAMPLE_COUNT = BANK_PER_MONTH * RECONCILIATION_SAMPLE_MONTHS.length
export const RECONCILIATION_CARD_SAMPLE_COUNT = CARD_PER_MONTH * RECONCILIATION_SAMPLE_MONTHS.length
export const RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT = ORPHAN_TAX_PER_MONTH * RECONCILIATION_SAMPLE_MONTHS.length
export const RECONCILIATION_BANK_MATCHED_COUNT = MATCHED_BANK_PER_MONTH * RECONCILIATION_SAMPLE_MONTHS.length
export const RECONCILIATION_CARD_MATCHED_COUNT = MATCHED_CARD_PER_MONTH * RECONCILIATION_SAMPLE_MONTHS.length
export const RECONCILIATION_PRIMARY_SAMPLE_COUNT =
  RECONCILIATION_BANK_SAMPLE_COUNT + RECONCILIATION_CARD_SAMPLE_COUNT
export const RECONCILIATION_MATCHED_PRIMARY_COUNT =
  RECONCILIATION_BANK_MATCHED_COUNT + RECONCILIATION_CARD_MATCHED_COUNT

export type BankSampleDefinition = {
  suffix: string
  transactionDate: string
  accountLabel: string
  counterparty: string
  description: string
  amountKrw: number
  direction: 'income' | 'expense'
  recommendedAccount: string
  matched: boolean
  taxItem?: string
  taxCounterparty?: string
}

export type CardSampleDefinition = {
  suffix: string
  transactionDate: string
  cardLabel: string
  counterparty: string
  description: string
  amountKrw: number
  direction: 'income' | 'expense'
  recommendedAccount: string
  matched: boolean
  personalUse?: boolean
  taxItem?: string
  taxCounterparty?: string
}

export type OrphanTaxInvoiceDefinition = {
  suffix: string
  transactionDate: string
  counterparty: string
  description: string
  amountKrw: number
  direction: 'income' | 'expense'
  recommendedAccount: string
}

type BankTemplate = {
  accountLabel: string
  counterparty: string
  description: string
  direction: 'income' | 'expense'
  recommendedAccount: string
  taxItem: string
  taxCounterparty?: string
  baseAmount: number
}

type CardTemplate = {
  cardLabel: string
  counterparty: string
  description: string
  direction: 'expense'
  recommendedAccount: string
  taxItem: string
  taxCounterparty?: string
  baseAmount: number
  personalUse?: boolean
}

const BANK_ACCOUNT_LABELS = [
  '주거래 계좌 신한 8706',
  '운영비 계좌 국민 9012',
  '달러 계좌 국민 4597',
  '마이너스 한도 계좌 우리 5432',
] as const

const CARD_LABELS = [
  '신한카드 법인 1234',
  '국민카드 법인 5678',
] as const

const BANK_TEMPLATES: BankTemplate[] = [
  { accountLabel: '주거래 계좌 신한 8706', counterparty: '무신사페이먼츠', description: '타행IB 무신사페이먼츠(우리)', direction: 'income', recommendedAccount: '매출', taxItem: '의류 판매 정산', taxCounterparty: '(주)무신사페이먼츠', baseAmount: 62_140 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '이서준', description: '빵집 이서준', direction: 'expense', recommendedAccount: '복리후생비', taxItem: '간식 구매', baseAmount: 93_500 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '(주)데모컴퍼니', description: '현금영수증 (주)데모컴퍼니', direction: 'expense', recommendedAccount: '소모품비', taxItem: '사무용품', taxCounterparty: '(주)데모컴퍼니', baseAmount: 186_450 },
  { accountLabel: '주거래 계좌 신한 8706', counterparty: '쿠팡페이', description: '타행IB 쿠팡페이 (우리은행)', direction: 'income', recommendedAccount: '매출', taxItem: '온라인몰 정산', taxCounterparty: '쿠팡페이', baseAmount: 59_000 },
  { accountLabel: '주거래 계좌 신한 8706', counterparty: '원아이지넥스원', description: '용역대금 원아이지넥스원', direction: 'income', recommendedAccount: '매출', taxItem: '클라우드 용역', taxCounterparty: '원아이지넥스원', baseAmount: 2_739_300 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '페이즈 주식회사', description: '외주비 페이즈', direction: 'expense', recommendedAccount: '지급수수료', taxItem: '디자인 외주', taxCounterparty: '페이즈 주식회사', baseAmount: 484_000 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '신성에스디에이치하늘', description: '임차료 신성에스디에스', direction: 'expense', recommendedAccount: '지급임차료', taxItem: '사무실 임대료', taxCounterparty: '신성에스디에이치하늘', baseAmount: 1_650_000 },
  { accountLabel: '주거래 계좌 신한 8706', counterparty: '네이버페이', description: '네이버페이 정산 입금', direction: 'income', recommendedAccount: '매출', taxItem: '스마트스토어 정산', taxCounterparty: '네이버페이', baseAmount: 128_900 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '회계법인 스톤브릿지', description: '회계법인 스톤브릿지 자문료', direction: 'expense', recommendedAccount: '지급수수료', taxItem: '기장 자문료', taxCounterparty: '회계법인 스톤브릿지', baseAmount: 550_000 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '주식회사 사이오닉에이아이', description: '브루셀 MLOPS Platform', direction: 'expense', recommendedAccount: '도메인/호스팅비', taxItem: '브루셀 MLOPS Platform', taxCounterparty: '주식회사 사이오닉에이아이', baseAmount: 2_100_000 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '주식회사 하드슨에이아이', description: 'Managed Cloud_NAS 추가', direction: 'expense', recommendedAccount: '도메인/호스팅비', taxItem: 'Managed Cloud_NAS 추가', taxCounterparty: '주식회사 하드슨에이아이', baseAmount: 630_300 },
  { accountLabel: '주거래 계좌 신한 8706', counterparty: '장면우', description: '장면우 서비스', direction: 'income', recommendedAccount: '매출', taxItem: '컨설팅 용역', taxCounterparty: '장면우', baseAmount: 220_000 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: 'KT', description: '인터넷 이용료', direction: 'expense', recommendedAccount: '통신비', taxItem: '인터넷 회선', taxCounterparty: 'KT', baseAmount: 88_000 },
  { accountLabel: '주거래 계좌 신한 8706', counterparty: '국민은행', description: '보통예금 이자 입금', direction: 'income', recommendedAccount: '이자수익', taxItem: '이자소득 원천', taxCounterparty: '국민은행', baseAmount: 3_420 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '강남타워임대(주)', description: '사무실 임대료', direction: 'expense', recommendedAccount: '지급임차료', taxItem: '사무실 임대료', taxCounterparty: '강남타워임대(주)', baseAmount: 1_650_000 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '오피스디포코리아', description: '사무용품 구매', direction: 'expense', recommendedAccount: '소모품비', taxItem: '사무용품', taxCounterparty: '오피스디포코리아', baseAmount: 128_500 },
  { accountLabel: '주거래 계좌 신한 8706', counterparty: '토스페이먼츠', description: 'PG 정산 입금', direction: 'income', recommendedAccount: '매출', taxItem: 'PG 정산', taxCounterparty: '토스페이먼츠', baseAmount: 945_200 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: 'SK에너지', description: '법인차량 주유', direction: 'expense', recommendedAccount: '차량유지비', taxItem: '유류대', taxCounterparty: 'SK에너지', baseAmount: 76_000 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '카카오모빌리티', description: '업무 택시비', direction: 'expense', recommendedAccount: '여비교통비', taxItem: '택시 이용', taxCounterparty: '카카오모빌리티', baseAmount: 24_500 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '우체국택배', description: '택배비', direction: 'expense', recommendedAccount: '운반비 / 배송비', taxItem: '택배 발송', taxCounterparty: '우체국택배', baseAmount: 18_900 },
  { accountLabel: '주거래 계좌 신한 8706', counterparty: '엘아이티넥스원', description: '매출 입금', direction: 'income', recommendedAccount: '매출', taxItem: '소프트웨어 라이선스', taxCounterparty: '엘아이티넥스원', baseAmount: 1_100_000 },
  { accountLabel: '달러 계좌 국민 4597', counterparty: '해외수취', description: '해외 고객 결제', direction: 'income', recommendedAccount: '매출', taxItem: '해외 SaaS 라이선스 매출', taxCounterparty: 'GLOBAL TECH INC', baseAmount: 3_849_250 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '김세무사무소', description: '세무 자문료 이체', direction: 'expense', recommendedAccount: '지급수수료', taxItem: '세무 자문료', taxCounterparty: '김세무사무소', baseAmount: 550_000 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '네이버', description: '네이버 검색광고', direction: 'expense', recommendedAccount: '광고선전비', taxItem: '검색광고', taxCounterparty: '네이버', baseAmount: 320_000 },
  { accountLabel: '주거래 계좌 신한 8706', counterparty: '백은서', description: '프리랜서 용역비', direction: 'income', recommendedAccount: '매출', taxItem: '디자인 용역', taxCounterparty: '백은서', baseAmount: 660_000 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '롯데렌탈', description: '복합기 렌탈료', direction: 'expense', recommendedAccount: '지급임차료', taxItem: '복합기 렌탈', taxCounterparty: '롯데렌탈', baseAmount: 95_000 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '코리아생명보험(주)', description: '4대보험 연수료', direction: 'expense', recommendedAccount: '보험료', taxItem: '보험 연수', taxCounterparty: '코리아생명보험(주)', baseAmount: 155_320 },
  { accountLabel: '주거래 계좌 신한 8706', counterparty: '주식회사 이노텔레콤', description: '이노텔레콤 매출', direction: 'income', recommendedAccount: '매출', taxItem: '통신장비 납품', taxCounterparty: '주식회사 이노텔레콤', baseAmount: 186_450 },
  { accountLabel: '운영비 계좌 국민 9012', counterparty: '개인이체', description: '개인송금', direction: 'expense', recommendedAccount: '미분류', taxItem: '개인송금', baseAmount: 500_000 },
  { accountLabel: '마이너스 한도 계좌 우리 5432', counterparty: '정기적금', description: '월적립', direction: 'expense', recommendedAccount: '미분류', taxItem: '정기적금', baseAmount: 1_000_000 },
]

const BUSINESS_CARD_TEMPLATES: CardTemplate[] = [
  { cardLabel: '신한카드 법인 1234', counterparty: '스타벅스 강남점', description: '회의 커피', direction: 'expense', recommendedAccount: '복리후생비', taxItem: '음료 구매', baseAmount: 18_500 },
  { cardLabel: '신한카드 법인 1234', counterparty: 'AWS', description: '클라우드 이용료', direction: 'expense', recommendedAccount: '도메인/호스팅비', taxItem: 'AWS 클라우드', taxCounterparty: 'Amazon Web Services', baseAmount: 412_000 },
  { cardLabel: '국민카드 법인 5678', counterparty: '오피스디포코리아', description: '사무용품 카드결제', direction: 'expense', recommendedAccount: '소모품비', taxItem: '사무용품', taxCounterparty: '오피스디포코리아', baseAmount: 87_300 },
  { cardLabel: '신한카드 법인 1234', counterparty: 'GS칼텍스', description: '법인차량 주유', direction: 'expense', recommendedAccount: '차량유지비', taxItem: '유류대', taxCounterparty: 'GS칼텍스', baseAmount: 68_000 },
  { cardLabel: '국민카드 법인 5678', counterparty: '배달의민족', description: '야근 식대', direction: 'expense', recommendedAccount: '복리후생비', taxItem: '야근 식대', baseAmount: 42_000 },
  { cardLabel: '신한카드 법인 1234', counterparty: 'Notion Labs', description: '해외 SaaS 결제', direction: 'expense', recommendedAccount: '소프트웨어비', taxItem: '협업툴 구독', taxCounterparty: 'Notion Labs', baseAmount: 112_000 },
  { cardLabel: '국민카드 법인 5678', counterparty: '카카오T', description: '업무 택시', direction: 'expense', recommendedAccount: '여비교통비', taxItem: '택시 이용', taxCounterparty: '카카오모빌리티', baseAmount: 19_800 },
  { cardLabel: '신한카드 법인 1234', counterparty: '쿠팡', description: '사무실 비품', direction: 'expense', recommendedAccount: '소모품비', taxItem: '사무용품', taxCounterparty: '쿠팡', baseAmount: 54_900 },
  { cardLabel: '국민카드 법인 5678', counterparty: 'Microsoft', description: 'Office 365', direction: 'expense', recommendedAccount: '소프트웨어비', taxItem: '오피스 구독', taxCounterparty: 'Microsoft', baseAmount: 156_000 },
  { cardLabel: '신한카드 법인 1234', counterparty: '우아한형제들', description: '팀 회식', direction: 'expense', recommendedAccount: '복리후생비', taxItem: '회식비', baseAmount: 238_000 },
  { cardLabel: '국민카드 법인 5678', counterparty: '우체국택배', description: '택배 발송', direction: 'expense', recommendedAccount: '운반비 / 배송비', taxItem: '택배 발송', taxCounterparty: '우체국택배', baseAmount: 21_500 },
  { cardLabel: '신한카드 법인 1234', counterparty: '네이버', description: '검색광고', direction: 'expense', recommendedAccount: '광고선전비', taxItem: '검색광고', taxCounterparty: '네이버', baseAmount: 310_000 },
  { cardLabel: '국민카드 법인 5678', counterparty: 'KT', description: '모바일 통신', direction: 'expense', recommendedAccount: '통신비', taxItem: '모바일 회선', taxCounterparty: 'KT', baseAmount: 66_000 },
  { cardLabel: '신한카드 법인 1234', counterparty: 'Adobe', description: 'Creative Cloud', direction: 'expense', recommendedAccount: '소프트웨어비', taxItem: '디자인툴 구독', taxCounterparty: 'Adobe', baseAmount: 78_000 },
]

const PERSONAL_CARD_TEMPLATES: CardTemplate[] = [
  { cardLabel: '국민카드 법인 5678', counterparty: 'CGV', description: '영화 관람', direction: 'expense', recommendedAccount: '미분류', taxItem: '영화 관람', baseAmount: 28_000, personalUse: true },
  { cardLabel: '신한카드 법인 1234', counterparty: 'PC방나라', description: 'PC방 이용', direction: 'expense', recommendedAccount: '미분류', taxItem: 'PC방 이용', baseAmount: 12_000, personalUse: true },
  { cardLabel: '국민카드 법인 5678', counterparty: '헤어살롱', description: '미용실', direction: 'expense', recommendedAccount: '미분류', taxItem: '미용실', baseAmount: 45_000, personalUse: true },
  { cardLabel: '신한카드 법인 1234', counterparty: '네일샵', description: '네일샵', direction: 'expense', recommendedAccount: '미분류', taxItem: '네일샵', baseAmount: 65_000, personalUse: true },
]

const ORPHAN_TEMPLATES: Array<Omit<OrphanTaxInvoiceDefinition, 'suffix' | 'transactionDate' | 'amountKrw'>> = [
  { counterparty: '주식회사 하드슨에이아이', description: 'Managed Cloud_NAS 추가 (미입금)', direction: 'expense', recommendedAccount: '도메인/호스팅비' },
  { counterparty: '글로벌테크코리아', description: '해외 라이선스 매출 (미수금)', direction: 'income', recommendedAccount: '매출' },
  { counterparty: '엔아이지씨에스(주)', description: '브루셀 AI LICENSE (미입금)', direction: 'expense', recommendedAccount: '도메인/호스팅비' },
  { counterparty: '스타트업벤처스', description: '컨설팅 매출 (미수금)', direction: 'income', recommendedAccount: '매출' },
  { counterparty: '디앤티크인', description: 'NFT 인증서 추가 (미입금)', direction: 'expense', recommendedAccount: '지급수수료' },
  { counterparty: '코리아생명보험(주)', description: 'AI 세미나 연수료 (미입금)', direction: 'expense', recommendedAccount: '보험료' },
]

function monthKeyToYyyymm(monthKey: string) {
  return monthKey.replace('-', '')
}

function buildTransactionDate(monthKey: string, dayOfMonth: number) {
  const monthStart = DateTime.fromISO(`${monthKey}-01`, { zone: 'Asia/Seoul' })
  const safeDay = Math.min(dayOfMonth, monthStart.daysInMonth ?? 28)
  return monthStart.set({ day: safeDay }).toISODate()!
}

function buildAmountKrw(baseAmount: number, monthIndex: number, rowIndex: number) {
  return baseAmount + monthIndex * 11_371 + rowIndex * 1_009
}

function rotateTemplate<T>(templates: T[], monthIndex: number, rowIndex: number) {
  return templates[(monthIndex * 7 + rowIndex) % templates.length]
}

function buildBankDefinitions(): BankSampleDefinition[] {
  const rows: BankSampleDefinition[] = []

  for (let monthIndex = 0; monthIndex < RECONCILIATION_SAMPLE_MONTHS.length; monthIndex += 1) {
    const monthKey = RECONCILIATION_SAMPLE_MONTHS[monthIndex]
    const yyyymm = monthKeyToYyyymm(monthKey)

    for (let rowIndex = 0; rowIndex < BANK_PER_MONTH; rowIndex += 1) {
      const template = rotateTemplate(BANK_TEMPLATES, monthIndex, rowIndex)
      const isUnmatchedSlot = rowIndex >= MATCHED_BANK_PER_MONTH
      const matched = !isUnmatchedSlot
      const suffix = `${yyyymm}_b${String(rowIndex + 1).padStart(2, '0')}`
      const dayOfMonth = Math.min(28, 2 + ((rowIndex * 2 + monthIndex) % 27))
      const amountKrw = buildAmountKrw(template.baseAmount, monthIndex, rowIndex)
      const accountLabel = BANK_ACCOUNT_LABELS[rowIndex % BANK_ACCOUNT_LABELS.length]

      rows.push({
        suffix,
        transactionDate: buildTransactionDate(monthKey, dayOfMonth),
        accountLabel: template.accountLabel || accountLabel,
        counterparty: template.counterparty,
        description: template.description,
        amountKrw,
        direction: template.direction,
        recommendedAccount: matched ? template.recommendedAccount : '미분류',
        matched,
        taxItem: matched ? template.taxItem : undefined,
        taxCounterparty: matched ? (template.taxCounterparty ?? template.counterparty) : undefined,
      })
    }
  }

  return rows
}

function buildCardDefinitions(): CardSampleDefinition[] {
  const rows: CardSampleDefinition[] = []

  for (let monthIndex = 0; monthIndex < RECONCILIATION_SAMPLE_MONTHS.length; monthIndex += 1) {
    const monthKey = RECONCILIATION_SAMPLE_MONTHS[monthIndex]
    const yyyymm = monthKeyToYyyymm(monthKey)

    for (let rowIndex = 0; rowIndex < CARD_PER_MONTH; rowIndex += 1) {
      const isPersonalSlot = rowIndex >= MATCHED_CARD_PER_MONTH
      const template = isPersonalSlot
        ? PERSONAL_CARD_TEMPLATES[monthIndex % PERSONAL_CARD_TEMPLATES.length]
        : rotateTemplate(BUSINESS_CARD_TEMPLATES, monthIndex, rowIndex)
      const matched = !isPersonalSlot
      const suffix = `${yyyymm}_c${String(rowIndex + 1).padStart(2, '0')}`
      const dayOfMonth = Math.min(28, 3 + ((rowIndex * 2 + monthIndex + 1) % 26))
      const amountKrw = buildAmountKrw(template.baseAmount, monthIndex, rowIndex + 100)

      rows.push({
        suffix,
        transactionDate: buildTransactionDate(monthKey, dayOfMonth),
        cardLabel: template.cardLabel || CARD_LABELS[rowIndex % CARD_LABELS.length],
        counterparty: template.counterparty,
        description: template.description,
        amountKrw,
        direction: template.direction,
        recommendedAccount: matched ? template.recommendedAccount : '미분류',
        matched,
        personalUse: isPersonalSlot,
        taxItem: matched ? template.taxItem : undefined,
        taxCounterparty: matched ? (template.taxCounterparty ?? template.counterparty) : undefined,
      })
    }
  }

  return rows
}

function buildOrphanTaxDefinitions(): OrphanTaxInvoiceDefinition[] {
  const rows: OrphanTaxInvoiceDefinition[] = []

  for (let monthIndex = 0; monthIndex < RECONCILIATION_SAMPLE_MONTHS.length; monthIndex += 1) {
    const monthKey = RECONCILIATION_SAMPLE_MONTHS[monthIndex]
    const yyyymm = monthKeyToYyyymm(monthKey)

    for (let orphanIndex = 0; orphanIndex < ORPHAN_TAX_PER_MONTH; orphanIndex += 1) {
      const template = ORPHAN_TEMPLATES[(monthIndex * ORPHAN_TAX_PER_MONTH + orphanIndex) % ORPHAN_TEMPLATES.length]
      const suffix = `${yyyymm}_orphan_${String(orphanIndex + 1).padStart(2, '0')}`
      const dayOfMonth = Math.max(1, 28 - orphanIndex)
      const amountKrw = buildAmountKrw(1_200_000, monthIndex, orphanIndex + 200)

      rows.push({
        suffix,
        transactionDate: buildTransactionDate(monthKey, dayOfMonth),
        counterparty: template.counterparty,
        description: template.description,
        amountKrw,
        direction: template.direction,
        recommendedAccount: template.recommendedAccount,
      })
    }
  }

  return rows
}

export const BANK_SAMPLE_DEFINITIONS = buildBankDefinitions()
export const CARD_SAMPLE_DEFINITIONS = buildCardDefinitions()
export const ORPHAN_TAX_INVOICE_DEFINITIONS = buildOrphanTaxDefinitions()

export const RECONCILIATION_TAX_INVOICE_SAMPLE_COUNT =
  BANK_SAMPLE_DEFINITIONS.filter((sample) => sample.matched).length
  + CARD_SAMPLE_DEFINITIONS.filter((sample) => sample.matched).length
  + ORPHAN_TAX_INVOICE_DEFINITIONS.length
