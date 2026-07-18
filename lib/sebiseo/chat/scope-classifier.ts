export type SebiseoScopeResult =
  | { kind: 'allowed' }
  | { kind: 'schedule' }
  | {
      kind: 'refused'
      reason: 'off_topic' | 'tax_advice' | 'action' | 'out_of_scope'
    }

const PRODUCT_TERMS = [
  '세비서',
  'SemuAgent',
  '세무에이전트',
  '자료수집',
  '기장검토',
  '자료대조원장',
  '급여',
  '원천세',
  '지급명세서',
  '연말정산',
  '지방소득세',
  '부가세',
  '연간신고',
  '법인세',
  '종합소득세',
  '사업장현황신고',
  '홈택스',
  '위택스',
  '파일',
  '업로드',
  '첨부',
  '화면',
  '메뉴',
  '버튼',
  '확인 필요',
  '추가 공제 가능성',
] as const

const ACTION_PATTERNS = [
  /세무사처럼/,
  /대신\s*(신고|제출|납부|확정)/,
  /(신고|제출|납부|확정)\s*해\s*줘/,
  /공제로\s*(바꿔|변경)/,
  /거래.*(삭제|변경)\s*해/,
] as const

const OFF_TOPIC_PATTERNS = [
  /날씨/,
  /맛집/,
  /여행/,
  /코딩/,
  /프로그램\s*작성/,
  /번역\s*해/,
  /주식\s*추천/,
  /연애/,
] as const

const TAX_ADVICE_PATTERNS = [
  /(?:이|이게|이것이|접대비|비용).*(?:공제|면세|영세율).*(?:가능|해당)/,
  /세금(?:을|이)?\s*(?:얼마|계산)/,
  /(?:신고|납부)해야\s*(?:하나|하나요|돼)/,
  /세무\s*판단/,
  /절세\s*방법/,
] as const

const PRODUCT_CONTEXT_PATTERNS = [
  /(?:화면|메뉴|버튼|앱|세비서|세무에이전트|SemuAgent)/i,
  /(?:어디|어떻게|무슨\s*뜻|보려면|올리려면|입력)/,
] as const

const CURRENT_MONTH_SCHEDULE_PATTERNS = [
  /(?:이번\s*달|이번달|이달|당월).*(?:세무\s*)?(?:일정|신고\s*일정|마감)/,
  /(?:세무\s*일정|신고\s*일정).*(?:이번\s*달|이번달|이달|당월)/,
] as const

function matchesAny(text: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
}

export function classifySebiseoScope(message: string): SebiseoScopeResult {
  const normalized = message.trim()
  if (!normalized) return { kind: 'refused', reason: 'out_of_scope' }
  if (matchesAny(normalized, ACTION_PATTERNS)) return { kind: 'refused', reason: 'action' }
  if (matchesAny(normalized, OFF_TOPIC_PATTERNS)) return { kind: 'refused', reason: 'off_topic' }
  if (matchesAny(normalized, CURRENT_MONTH_SCHEDULE_PATTERNS)) return { kind: 'schedule' }

  const hasProductTerm = PRODUCT_TERMS.some((term) => normalized.includes(term))
  const hasProductContext = matchesAny(normalized, PRODUCT_CONTEXT_PATTERNS)
  if (matchesAny(normalized, TAX_ADVICE_PATTERNS) && !hasProductContext) {
    return { kind: 'refused', reason: 'tax_advice' }
  }
  if (!hasProductTerm && !hasProductContext) {
    return { kind: 'refused', reason: 'out_of_scope' }
  }
  return { kind: 'allowed' }
}
