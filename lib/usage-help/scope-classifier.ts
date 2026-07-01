export type UsageHelpScopeResult =
  | { kind: 'usage' }
  | { kind: 'usage_cautious' }
  | {
      kind: 'refused'
      reason: 'action' | 'tax_legal' | 'customer_data' | 'web_search' | 'file_analysis'
    }

const ACTION_PATTERNS = [
  /삭제\s*해/,
  /삭제해\s*줘/,
  /발송\s*해/,
  /보내\s*줘/,
  /승인\s*해/,
  /업로드\s*해/,
  /다운로드\s*해\s*줘/,
  /변경\s*해\s*줘/,
  /처리\s*해\s*줘/,
  /이\s*파일을\s*삭제/,
  /메일\s*보내/,
  /메일\s*발송/,
]

const TAX_LEGAL_PATTERNS = [
  /세금\s*계산/,
  /부가세/,
  /법인세/,
  /소득세/,
  /국민연금\s*요율/,
  /건강보험\s*요율/,
  /4\s*대\s*보험/,
  /노무\s*판단/,
  /법률\s*판단/,
  /세무\s*판단/,
  /회계\s*판단/,
  /\d{4}년.*요율/,
  /요율\s*알려/,
  /세금계산서.*안\s*내도/,
  /납부\s*해야/,
]

const CUSTOMER_DATA_PATTERNS = [
  /이\s*고객/,
  /고객사\s*이메일/,
  /고객\s*이메일/,
  /고객사\s*자료/,
  /업로드\s*된\s*파일\s*내용/,
  /파일\s*내용\s*요약/,
  /이메일\s*내용/,
  /거래\s*내역/,
  /급여\s*금액/,
  /임금\s*금액/,
  /사번/,
  /직원\s*이름/,
  /특정\s*고객/,
]

const WEB_SEARCH_PATTERNS = [
  /인터넷/,
  /웹\s*검색/,
  /검색\s*해\s*줘/,
  /찾아\s*줘/,
  /더존\s*양식/,
  /최신\s*법/,
  /최근\s*개정/,
  /외부\s*자료/,
]

const FILE_ANALYSIS_PATTERNS = [
  /파일\s*분석/,
  /업로드\s*파일\s*분석/,
  /이\s*파일\s*내용/,
  /pdf\s*내용/,
  /엑셀\s*내용\s*읽/,
  /ocr/i,
]

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
}

export function classifyUsageHelpScope(question: string): UsageHelpScopeResult {
  const normalized = question.trim()
  if (!normalized) {
    return { kind: 'refused', reason: 'customer_data' }
  }

  if (matchesAny(normalized, ACTION_PATTERNS)) {
    return { kind: 'refused', reason: 'action' }
  }
  if (matchesAny(normalized, WEB_SEARCH_PATTERNS)) {
    return { kind: 'refused', reason: 'web_search' }
  }
  if (matchesAny(normalized, CUSTOMER_DATA_PATTERNS)) {
    return { kind: 'refused', reason: 'customer_data' }
  }
  if (matchesAny(normalized, FILE_ANALYSIS_PATTERNS)) {
    return { kind: 'refused', reason: 'file_analysis' }
  }
  if (matchesAny(normalized, TAX_LEGAL_PATTERNS)) {
    return { kind: 'refused', reason: 'tax_legal' }
  }

  const cautiousHints = ['이거', '이게', '맞나요', '해도 되', '괜찮', '판단']
  if (cautiousHints.some((hint) => normalized.includes(hint))) {
    return { kind: 'usage_cautious' }
  }

  return { kind: 'usage' }
}
