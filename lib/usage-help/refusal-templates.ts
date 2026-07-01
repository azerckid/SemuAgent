import type { UsageHelpChatResponse } from '@/lib/usage-help/schemas'

export type UsageHelpRefusalReason =
  | 'action'
  | 'tax_legal'
  | 'customer_data'
  | 'web_search'
  | 'file_analysis'
  | 'unsafe_answer'

const BASE_REFUSAL =
  '이 안내는 JARYO 사용법만 답변합니다. 세금 계산, 법률 판단, 외부 검색, 고객사 자료 판단은 답할 수 없습니다.'

const REASON_MESSAGES: Record<UsageHelpRefusalReason, string> = {
  action:
    `${BASE_REFUSAL} 대신 해당 작업을 수행하는 JARYO 화면과 버튼 위치는 안내할 수 있습니다.`,
  tax_legal:
    `${BASE_REFUSAL} 일반 세무·노무·법률 지식은 답하지 않습니다. JARYO 화면에서 상태를 확인하거나 기록하는 방법은 안내할 수 있습니다.`,
  customer_data:
    `${BASE_REFUSAL} 특정 고객사 자료나 이메일 내용은 조회·요약하지 않습니다. JARYO 화면 사용법은 안내할 수 있습니다.`,
  web_search:
    `${BASE_REFUSAL} 인터넷 검색이나 외부 양식 찾기는 지원하지 않습니다. JARYO 내부 메뉴와 버튼 안내는 가능합니다.`,
  file_analysis:
    `${BASE_REFUSAL} 업로드 파일 내용 분석은 하지 않습니다. 자료 검토·급여정산 화면에서 파일을 확인하는 방법은 안내할 수 있습니다.`,
  unsafe_answer:
    `${BASE_REFUSAL} 방금 질문은 JARYO 사용 범위 밖으로 판단되어 답변을 제공하지 않습니다.`,
}

export function buildUsageHelpRefusalResponse(params: {
  reason: UsageHelpRefusalReason
  suggestedQuestions: string[]
}): UsageHelpChatResponse {
  return {
    status: 'refused',
    answer: REASON_MESSAGES[params.reason],
    sourceLabels: [],
    suggestedQuestions: params.suggestedQuestions.slice(0, 3),
  }
}

export const USAGE_HELP_NO_DOC_ANSWER =
  '해당 사용법은 아직 문서화되어 있지 않습니다. 현재 화면 이름이나 버튼명을 알려주시면 JARYO 사용 범위 안에서 다시 안내하겠습니다.'

export const USAGE_HELP_ERROR_ANSWER =
  '지금은 AI 답변을 불러올 수 없습니다. 잠시 후 다시 시도하거나 아래 추천 질문을 이용해 주세요.'

export const USAGE_HELP_RATE_LIMIT_ANSWER =
  '잠시 후 다시 질문해 주세요. 아래 추천 질문은 계속 사용할 수 있습니다.'
