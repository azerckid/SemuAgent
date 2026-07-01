import type { BookkeepingAccountCategoryKey } from './account-categories'
import type { TransactionCandidate } from './schemas'

export type AccountRecommendation = {
  account: BookkeepingAccountCategoryKey
  confidence: 'high' | 'medium' | 'low'
  needsStaffDecision: boolean
  reason: string
}

function candidateText(candidate: TransactionCandidate) {
  return [
    candidate.sourceFilename,
    candidate.merchantName,
    candidate.description,
    ...candidate.rawRow,
  ].filter(Boolean).join(' ').toLowerCase()
}

function recommend(account: BookkeepingAccountCategoryKey, reason: string, confidence: 'high' | 'medium' = 'medium'): AccountRecommendation {
  return { account, confidence, needsStaffDecision: false, reason }
}

export function recommendAccountForCandidate(candidate: TransactionCandidate): AccountRecommendation {
  const text = candidateText(candidate)

  if (/이자수익|이자\s*$|이자입금|결산.*이자/.test(text)) {
    return recommend('interest_income', '예금 이자 또는 결산 이자수익 성격으로 분류합니다.')
  }
  if (/접대|업무추진|거래처.*식대|골프|cc\b|노래타운|장어|짬뽕|한정식|호텔롯데|스카이힐|축의금|조의금|경조사/.test(text)) {
    return recommend('entertainment', '접대비 또는 거래처 업무추진비 성격이 확인됩니다.')
  }
  if (/식대|식사|식당|음식점|카페|커피|복리후생|직원.*식|후생|백반|국밥|순대|훠궈|훠쿼|마라탕|한식|중식|중국식|중국집|중화요리|일식|분식|김밥|치킨|피자|햄버거|맥도날드|버거킹|스타벅스|이디야|메가커피|투썸|파리바게뜨|뚜레쥬르|베이커리|제과|도시락|갈비|삼겹살|족발|보쌈|곱창/.test(text)) {
    return recommend('employee_welfare', '직원 식대 또는 복리후생 성격으로 분류합니다.')
  }
  if (/택시|카카오\s*t|카카오모빌리티|카카오택시|티머니|교통카드|버스|지하철|철도|코레일|srt|ktx|항공권|항공료|공항버스/.test(text)) {
    return recommend('travel_transport', '택시, 대중교통, 철도, 항공 등 여비교통비 성격으로 분류합니다.')
  }
  if (/주유|유류|하이패스|차량|자동차|정비|세차|오토워시|과태료|속도위반|리스|캐피탈|렌터카/.test(text)) {
    return recommend('vehicle', '주유, 차량, 리스, 과태료 등 차량유지비 성격으로 분류합니다.')
  }
  if (/광고|비즈머니|마케팅|marketing|adver|카카오.*결제|네이버.*충전/.test(text)) {
    return recommend('advertising', '광고비 또는 광고 충전 거래로 분류합니다.')
  }
  if (/소모품|문구|비품|쿠팡|다이소|mro/.test(text)) {
    return recommend('supplies', '소모품 또는 비품 구매로 분류합니다.')
  }
  if (/수수료|fee|commission|cms|송금수수료|기타수수료|카드.*수수료|스마트로/.test(text)) {
    return recommend('fees', '수수료 성격이 확인됩니다.')
  }
  if (/세무|세무사|세무대리|기장료|기장대리|기장대행|회계법인|세무조정|세무서비스|법무|법원|용인세무서/.test(text)) {
    return recommend('fees', '세무, 회계, 법무 등 전문용역 수수료 성격으로 분류합니다.')
  }
  if (/통신|전화|인터넷전화|통신요금|인터넷요금|kt|케이티|케이티엠|lg유플러스|엘지유플러스|lgu\+?|유플러스|skt|텔레콤|centrex|sms충전/.test(text)) {
    return recommend('communication', '통신 또는 인터넷 서비스 관련 지출로 분류합니다.')
  }
  if (/관리비|전기요금|전기료|수도요금|수도료|가스요금|난방비|전력|수도광열|공동관리|건물관리|상가관리/.test(text)) {
    return recommend('utilities', '관리비, 전기, 수도, 가스 등 수도광열비 성격으로 분류합니다.')
  }
  if (/도메인|호스팅|사이트연장|사이트\s*연장|클라우드|nhn클라우드|엔에이치엔클라우|엔에이치엔커머스/.test(text)) {
    return recommend('domain_hosting', '도메인, 호스팅, 클라우드 또는 사이트 운영비 성격으로 분류합니다.')
  }
  if (/배송비|택배|운송|운반|퀵|반품.*배송|교환.*배송|왕복\s*배송/.test(text)) {
    return recommend('shipping', '배송, 택배, 반품/교환 운송비 성격으로 분류합니다.')
  }
  if (/국민연금|건강보험|고용보험|산재보험|4대보험/.test(text)) {
    return recommend('taxes_dues', '4대보험 또는 공과 성격으로 분류합니다.')
  }
  if (/보험료|보증보험|화재보험|자동차보험|손해보험|생명보험|보험/.test(text)) {
    return recommend('insurance', '보험료 성격으로 분류합니다.')
  }
  if (/매출\s*세금계산서/.test(text)) {
    return recommend('sales', '매출 세금계산서 성격으로 분류합니다.')
  }
  if (/매입\s*세금계산서/.test(text)) {
    return recommend('purchase_goods', '매입 세금계산서 또는 매입 증빙 성격으로 분류합니다.')
  }
  if (/세금|공과|지방세|지방소득세|법인세|국세|관세|벌금/.test(text)) {
    return recommend('taxes_dues', '세금과공과 성격으로 분류합니다.')
  }
  if (/카드대금|카드결제대금|비씨카드출금|우리카드결제대금|신용카드.*출금|카드기업|기업카드|하나카드|신한카드|삼성카드|현대카드|롯데카드|국민카드|kb국민카드|bc카드|비씨카드/.test(text)) {
    return recommend('card_payment', '카드 사용액 결제 또는 카드미지급금 정산 성격으로 분류합니다.')
  }
  if (/급여|상여|인건|직원|salary|payroll/.test(text)) {
    return recommend('payroll_related', '급여 또는 인건비성 거래로 분류합니다.')
  }
  if (/임차|임대료|월세|렌트|rent/.test(text)) {
    return recommend('rent', '임차료 성격으로 분류합니다.')
  }
  if (/물품대금|상품|원재료|재고|매입|매입\s*세금계산서|스프레이|용기|펌프|캡|금형|미스트|화장품|포장/.test(text)) {
    return recommend('purchase_goods', '상품, 원재료, 포장자재 또는 물품대금 성격으로 분류합니다.')
  }
  if (/정산|kcp|케이씨피|pg|npay|네이버페이|카카오페이|페이코|payco|다날|결제서비스/.test(text)) {
    return recommend('sales', '온라인 결제/PG 정산 관련 거래로 매출 성격으로 분류합니다.')
  }
  if (candidate.direction === 'income') {
    return recommend('sales', '입금 거래 또는 정산 입금으로 매출 성격으로 분류합니다.')
  }

  return {
    account: 'unclassified',
    confidence: 'low',
    needsStaffDecision: true,
    reason: '거래처와 적요만으로 계정항목을 확정하기 어려워 담당자 검토가 필요합니다.',
  }
}

export function selectAiClassificationCandidates(candidates: TransactionCandidate[]) {
  return candidates.filter((candidate) => recommendAccountForCandidate(candidate).needsStaffDecision)
}
