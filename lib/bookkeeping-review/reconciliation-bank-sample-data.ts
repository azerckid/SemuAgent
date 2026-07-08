export const RECONCILIATION_BANK_SAMPLE_COUNT = 50
export const RECONCILIATION_BANK_MATCHED_COUNT = 48
export const RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT = 6

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

export type OrphanTaxInvoiceDefinition = {
  suffix: string
  transactionDate: string
  counterparty: string
  description: string
  amountKrw: number
  direction: 'income' | 'expense'
  recommendedAccount: string
}

const AI_MATCHED_EVIDENCE_JSON = JSON.stringify({
  fieldsUsed: ['amount', 'date', 'counterparty', 'merchant_pattern'],
  needsStaffDecision: false,
})

const AI_UNMATCHED_EVIDENCE_JSON = JSON.stringify({
  fieldsUsed: ['amount', 'date', 'counterparty'],
  needsStaffDecision: true,
})

/**
 * Clobe-style bank ledger samples for reconciliation demo.
 * 48/50 bank rows have a paired tax_invoice with the same date and amount (96% match rate).
 */
export const BANK_SAMPLE_DEFINITIONS: BankSampleDefinition[] = [
  { suffix: '001', transactionDate: '2026-07-08', accountLabel: '주거래 계좌 신한 8706', counterparty: '무신사페이먼츠', description: '타행IB 무신사페이먼츠(우리)', amountKrw: 62_140, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '의류 판매 정산', taxCounterparty: '(주)무신사페이먼츠' },
  { suffix: '002', transactionDate: '2026-07-08', accountLabel: '운영비 계좌 국민 9012', counterparty: '이서준', description: '빵집 이서준', amountKrw: 93_500, direction: 'expense', recommendedAccount: '복리후생비', matched: true, taxItem: '간식 구매', taxCounterparty: '이서준' },
  { suffix: '003', transactionDate: '2026-07-07', accountLabel: '운영비 계좌 국민 9012', counterparty: '(주)데모컴퍼니', description: '현금영수증 (주)데모컴퍼니', amountKrw: 186_450, direction: 'expense', recommendedAccount: '소모품비', matched: true, taxItem: '사무용품', taxCounterparty: '(주)데모컴퍼니' },
  { suffix: '004', transactionDate: '2026-07-07', accountLabel: '달러 계좌 국민 4597', counterparty: '해외수취', description: '싱가포르고객 결제', amountKrw: 3_849_250, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '해외 SaaS 라이선스 매출', taxCounterparty: 'SINGAPORE CLIENT PTE' },
  { suffix: '005', transactionDate: '2026-07-06', accountLabel: '주거래 계좌 신한 8706', counterparty: '원아이지넥스원', description: '용역대금 원아이지넥스원', amountKrw: 27_393_300, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '클라우드 용역', taxCounterparty: '원아이지넥스원' },
  { suffix: '006', transactionDate: '2026-07-06', accountLabel: '운영비 계좌 국민 9012', counterparty: '페이즈 주식회사', description: '외주비 페이즈', amountKrw: 48_400, direction: 'expense', recommendedAccount: '지급수수료', matched: true, taxItem: '디자인 외주', taxCounterparty: '페이즈 주식회사' },
  { suffix: '007', transactionDate: '2026-07-05', accountLabel: '주거래 계좌 신한 8706', counterparty: '쿠팡페이', description: '타행IB 쿠팡페이 (우리은행)', amountKrw: 59_000, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '온라인몰 정산', taxCounterparty: '쿠팡페이' },
  { suffix: '008', transactionDate: '2026-07-05', accountLabel: '주거래 계좌 신한 8706', counterparty: '주식회사 이노텔레콤', description: '이노텔레콤 매출', amountKrw: 186_450, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '통신장비 납품', taxCounterparty: '주식회사 이노텔레콤' },
  { suffix: '009', transactionDate: '2026-07-04', accountLabel: '운영비 계좌 국민 9012', counterparty: 'KY테크솔루션', description: '개발비 KY테크솔루션', amountKrw: 5_654_000, direction: 'expense', recommendedAccount: '지급수수료', matched: true, taxItem: '스타일판매 정산', taxCounterparty: 'KY테크솔루션' },
  { suffix: '010', transactionDate: '2026-07-04', accountLabel: '운영비 계좌 국민 9012', counterparty: '신성에스디에이치하늘', description: '임차료 신성에스디에스', amountKrw: 65_165_100, direction: 'expense', recommendedAccount: '지급임차료', matched: true, taxItem: '사무실 임대료', taxCounterparty: '신성에스디에이치하늘' },
  { suffix: '011', transactionDate: '2026-07-03', accountLabel: '운영비 계좌 국민 9012', counterparty: '박도윤', description: '박도윤 카페결제', amountKrw: 17_600, direction: 'expense', recommendedAccount: '복리후생비', matched: true, taxItem: '음료 구매', taxCounterparty: '박도윤' },
  { suffix: '012', transactionDate: '2026-07-03', accountLabel: '주거래 계좌 신한 8706', counterparty: '네이버페이', description: '네이버페이 정산 입금', amountKrw: 128_900, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '스마트스토어 정산', taxCounterparty: '네이버페이' },
  { suffix: '013', transactionDate: '2026-07-02', accountLabel: '운영비 계좌 국민 9012', counterparty: '회계법인 스톤브릿지', description: '회계법인 스톤브릿지 라이선스', amountKrw: 550_000, direction: 'expense', recommendedAccount: '지급수수료', matched: true, taxItem: '기장 자문료', taxCounterparty: '회계법인 스톤브릿지' },
  { suffix: '014', transactionDate: '2026-07-02', accountLabel: '운영비 계좌 국민 9012', counterparty: '사이오닉에이아이', description: '브루셀 MLOPS Platform', amountKrw: 21_000_000, direction: 'expense', recommendedAccount: '도메인/호스팅비', matched: true, taxItem: '브루셀 MLOPS Platform', taxCounterparty: '주식회사 사이오닉에이아이' },
  { suffix: '015', transactionDate: '2026-07-01', accountLabel: '운영비 계좌 국민 9012', counterparty: '주식회사 하드슨에이아이', description: 'Managed Cloud_NAS 추가', amountKrw: 6_303_000, direction: 'expense', recommendedAccount: '도메인/호스팅비', matched: true, taxItem: 'Managed Cloud_NAS 추가', taxCounterparty: '주식회사 하드슨에이아이' },
  { suffix: '016', transactionDate: '2026-07-01', accountLabel: '운영비 계좌 국민 9012', counterparty: '코리아생명보험(주)', description: '드림플러스 AI 세미나 연수료', amountKrw: 1_553_200, direction: 'expense', recommendedAccount: '보험료', matched: true, taxItem: '드림플러스 AI 세미나 연수료', taxCounterparty: '코리아생명보험(주)' },
  { suffix: '017', transactionDate: '2026-06-30', accountLabel: '운영비 계좌 국민 9012', counterparty: '엔아이지씨에스(주)', description: '브루셀 AI MLOPS PLATFORM LICENSE', amountKrw: 25_300_000, direction: 'expense', recommendedAccount: '도메인/호스팅비', matched: true, taxItem: '브루셀 AI MLOPS PLATFORM LICENSE', taxCounterparty: '엔아이지씨에스(주)' },
  { suffix: '018', transactionDate: '2026-06-30', accountLabel: '운영비 계좌 국민 9012', counterparty: '주식회사 마스데로프', description: 'NAS 추가 계약', amountKrw: 8_732_900, direction: 'expense', recommendedAccount: '도메인/호스팅비', matched: true, taxItem: 'NAS 추가 계약', taxCounterparty: '주식회사 마스데로프' },
  { suffix: '019', transactionDate: '2026-06-29', accountLabel: '주거래 계좌 신한 8706', counterparty: '장면우', description: '장면우 서비스', amountKrw: 220_000, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '컨설팅 용역', taxCounterparty: '장면우' },
  { suffix: '020', transactionDate: '2026-06-29', accountLabel: '운영비 계좌 국민 9012', counterparty: '조건우', description: '조건우 편의점', amountKrw: 14_200, direction: 'expense', recommendedAccount: '복리후생비', matched: true, taxItem: '간식 구매', taxCounterparty: '조건우' },
  { suffix: '021', transactionDate: '2026-06-28', accountLabel: '운영비 계좌 국민 9012', counterparty: '최지민', description: '치킨 최지민', amountKrw: 31_000, direction: 'expense', recommendedAccount: '복리후생비', matched: true, taxItem: '야근 식대', taxCounterparty: '최지민' },
  { suffix: '022', transactionDate: '2026-06-28', accountLabel: '주거래 계좌 신한 8706', counterparty: '윤우진', description: '윤우진 편의점', amountKrw: 9_800, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '소액 용역', taxCounterparty: '윤우진' },
  { suffix: '023', transactionDate: '2026-06-27', accountLabel: '운영비 계좌 국민 9012', counterparty: '디앤티크인', description: 'NFT 인증서 납품', amountKrw: 4_900_000, direction: 'expense', recommendedAccount: '지급수수료', matched: true, taxItem: 'NFT 인증서 납품', taxCounterparty: '디앤티크인' },
  { suffix: '024', transactionDate: '2026-06-27', accountLabel: '주거래 계좌 신한 8706', counterparty: '신의현', description: '용역대금 신의현', amountKrw: 1_250_000, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '프로젝트 용역', taxCounterparty: '신의현' },
  { suffix: '025', transactionDate: '2026-06-26', accountLabel: '운영비 계좌 국민 9012', counterparty: '강남타워임대(주)', description: '6월 사무실 임대료', amountKrw: 1_650_000, direction: 'expense', recommendedAccount: '지급임차료', matched: true, taxItem: '사무실 임대료', taxCounterparty: '강남타워임대(주)' },
  { suffix: '026', transactionDate: '2026-06-26', accountLabel: '주거래 계좌 신한 8706', counterparty: '특허법인 신원', description: '특허 출원 수수료 환급', amountKrw: 880_000, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '특허 대리 수수료', taxCounterparty: '특허법인 신원' },
  { suffix: '027', transactionDate: '2026-06-25', accountLabel: '운영비 계좌 국민 9012', counterparty: '오피스디포코리아', description: '사무용품 구매', amountKrw: 128_500, direction: 'expense', recommendedAccount: '소모품비', matched: true, taxItem: '사무용품', taxCounterparty: '오피스디포코리아' },
  { suffix: '028', transactionDate: '2026-06-25', accountLabel: '주거래 계좌 신한 8706', counterparty: '무신사페이먼츠', description: '매출 정산 입금', amountKrw: 3_829_500, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '의류 판매 정산', taxCounterparty: '(주)무신사페이먼츠' },
  { suffix: '029', transactionDate: '2026-06-24', accountLabel: '운영비 계좌 국민 9012', counterparty: '김세무사무소', description: '기장 자문료 이체', amountKrw: 550_000, direction: 'expense', recommendedAccount: '지급수수료', matched: true, taxItem: '세무 자문료', taxCounterparty: '김세무사무소' },
  { suffix: '030', transactionDate: '2026-06-24', accountLabel: '주거래 계좌 신한 8706', counterparty: '엘아이티넥스원', description: '매출 입금', amountKrw: 1_100_000, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '소프트웨어 라이선스', taxCounterparty: '엘아이티넥스원' },
  { suffix: '031', transactionDate: '2026-06-23', accountLabel: '운영비 계좌 국민 9012', counterparty: 'KT', description: '인터넷 이용료', amountKrw: 88_000, direction: 'expense', recommendedAccount: '통신비', matched: true, taxItem: '인터넷 회선', taxCounterparty: 'KT' },
  { suffix: '032', transactionDate: '2026-06-23', accountLabel: '주거래 계좌 신한 8706', counterparty: '박서윤', description: '박서윤 치킨', amountKrw: 27_000, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '케이터링 용역', taxCounterparty: '박서윤' },
  { suffix: '033', transactionDate: '2026-06-22', accountLabel: '운영비 계좌 국민 9012', counterparty: '정예원', description: '피자 정예원', amountKrw: 42_000, direction: 'expense', recommendedAccount: '복리후생비', matched: true, taxItem: '회의 식대', taxCounterparty: '정예원' },
  { suffix: '034', transactionDate: '2026-06-22', accountLabel: '주거래 계좌 신한 8706', counterparty: '국민은행', description: '보통예금 이자 입금', amountKrw: 3_420, direction: 'income', recommendedAccount: '이자수익', matched: true, taxItem: '이자소득 원천', taxCounterparty: '국민은행' },
  { suffix: '035', transactionDate: '2026-06-21', accountLabel: '운영비 계좌 국민 9012', counterparty: '우리동네치과', description: '센터플로우 설치비', amountKrw: 39_000_000, direction: 'expense', recommendedAccount: '지급수수료', matched: true, taxItem: '센터플로우 설치비', taxCounterparty: '우리동네치과' },
  { suffix: '036', transactionDate: '2026-06-21', accountLabel: '주거래 계좌 신한 8706', counterparty: '주식회사 이노텔레콤', description: '개발 인건비', amountKrw: 23_710_500, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '개발 인건비', taxCounterparty: '주식회사 이노텔레콤' },
  { suffix: '037', transactionDate: '2026-06-20', accountLabel: '운영비 계좌 국민 9012', counterparty: '천사치과', description: '센터플로우 설치비 2차', amountKrw: 77_000_000, direction: 'expense', recommendedAccount: '지급수수료', matched: true, taxItem: '센터플로우 설치비', taxCounterparty: '천사치과' },
  { suffix: '038', transactionDate: '2026-06-20', accountLabel: '주거래 계좌 신한 8706', counterparty: '해외수취', description: 'USD 2,500 입금', amountKrw: 3_853_750, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '해외 라이선스 매출', taxCounterparty: 'GLOBAL TECH INC' },
  { suffix: '039', transactionDate: '2026-06-19', accountLabel: '운영비 계좌 국민 9012', counterparty: '롯데렌탈', description: '복합기 렌탈료', amountKrw: 95_000, direction: 'expense', recommendedAccount: '지급임차료', matched: true, taxItem: '복합기 렌탈', taxCounterparty: '롯데렌탈' },
  { suffix: '040', transactionDate: '2026-06-19', accountLabel: '주거래 계좌 신한 8706', counterparty: '쿠팡페이', description: '쿠팡 정산', amountKrw: 412_300, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '온라인몰 정산', taxCounterparty: '쿠팡페이' },
  { suffix: '041', transactionDate: '2026-06-18', accountLabel: '운영비 계좌 국민 9012', counterparty: 'SK에너지', description: '법인차량 주유', amountKrw: 76_000, direction: 'expense', recommendedAccount: '차량유지비', matched: true, taxItem: '유류대', taxCounterparty: 'SK에너지' },
  { suffix: '042', transactionDate: '2026-06-18', accountLabel: '주거래 계좌 신한 8706', counterparty: '원아이지넥스원', description: '유지보수료', amountKrw: 2_200_000, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '유지보수 용역', taxCounterparty: '원아이지넥스원' },
  { suffix: '043', transactionDate: '2026-06-17', accountLabel: '운영비 계좌 국민 9012', counterparty: '카카오모빌리티', description: '업무 택시비', amountKrw: 24_500, direction: 'expense', recommendedAccount: '여비교통비', matched: true, taxItem: '택시 이용', taxCounterparty: '카카오모빌리티' },
  { suffix: '044', transactionDate: '2026-06-17', accountLabel: '주거래 계좌 신한 8706', counterparty: '네이버클라우드', description: '클라우드 크레딧 환급', amountKrw: 150_000, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '클라우드 용역', taxCounterparty: '네이버클라우드' },
  { suffix: '045', transactionDate: '2026-06-16', accountLabel: '운영비 계좌 국민 9012', counterparty: '우체국택배', description: '택배비', amountKrw: 18_900, direction: 'expense', recommendedAccount: '운반비 / 배송비', matched: true, taxItem: '택배 발송', taxCounterparty: '우체국택배' },
  { suffix: '046', transactionDate: '2026-06-16', accountLabel: '주거래 계좌 신한 8706', counterparty: '백은서', description: '프리랜서 용역비', amountKrw: 660_000, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: '디자인 용역', taxCounterparty: '백은서' },
  { suffix: '047', transactionDate: '2026-06-15', accountLabel: '운영비 계좌 국민 9012', counterparty: '개인이체', description: '개인송금 김데모', amountKrw: 500_000, direction: 'expense', recommendedAccount: '미분류', matched: false },
  { suffix: '048', transactionDate: '2026-06-15', accountLabel: '마이너스 한도 계좌 우리 5432', counterparty: '정기적금', description: '월적립', amountKrw: 1_000_000, direction: 'expense', recommendedAccount: '미분류', matched: false },
  { suffix: '049', transactionDate: '2026-06-14', accountLabel: '운영비 계좌 국민 9012', counterparty: '광고플랫폼', description: '네이버 검색광고', amountKrw: 320_000, direction: 'expense', recommendedAccount: '광고선전비', matched: true, taxItem: '검색광고', taxCounterparty: '네이버' },
  { suffix: '050', transactionDate: '2026-06-14', accountLabel: '주거래 계좌 신한 8706', counterparty: '토스페이먼츠', description: 'PG 정산 입금', amountKrw: 945_200, direction: 'income', recommendedAccount: '매출', matched: true, taxItem: 'PG 정산', taxCounterparty: '토스페이먼츠' },
]

export const ORPHAN_TAX_INVOICE_DEFINITIONS: OrphanTaxInvoiceDefinition[] = [
  { suffix: 'orphan_01', transactionDate: '2026-06-13', counterparty: '주식회사 하드슨에이아이', description: 'Managed Cloud_NAS 추가 (미입금)', amountKrw: 6_933_300, direction: 'expense', recommendedAccount: '도메인/호스팅비' },
  { suffix: 'orphan_02', transactionDate: '2026-06-12', counterparty: '엔아이지씨에스(주)', description: '브루셀 AI LICENSE 2차 (미입금)', amountKrw: 31_000_000, direction: 'expense', recommendedAccount: '도메인/호스팅비' },
  { suffix: 'orphan_03', transactionDate: '2026-06-11', counterparty: '코리아생명보험(주)', description: 'AI 세미나 연수료 2차 (미입금)', amountKrw: 1_889_800, direction: 'expense', recommendedAccount: '보험료' },
  { suffix: 'orphan_04', transactionDate: '2026-06-10', counterparty: '디앤티크인', description: 'NFT 인증서 추가 (미입금)', amountKrw: 27_000_000, direction: 'expense', recommendedAccount: '지급수수료' },
  { suffix: 'orphan_05', transactionDate: '2026-06-09', counterparty: '글로벌테크코리아', description: '해외 라이선스 매출 (미수금)', amountKrw: 4_200_000, direction: 'income', recommendedAccount: '매출' },
  { suffix: 'orphan_06', transactionDate: '2026-06-08', counterparty: '스타트업벤처스', description: '컨설팅 매출 (미수금)', amountKrw: 2_750_000, direction: 'income', recommendedAccount: '매출' },
]
