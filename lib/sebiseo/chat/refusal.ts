import {
  sebiseoChatResponseSchema,
  type SebiseoChatResponse,
} from './schemas'

const REFUSAL_MESSAGE =
  '세비서는 SemuAgent의 자료수집·검토·신고 준비 화면과 사용법만 안내합니다. 일반 세무상담이나 신고·확정 대행은 답변하지 않습니다.'

export function buildSebiseoRefusal(
  reason: 'off_topic' | 'tax_advice' | 'action' | 'out_of_scope' | 'unsafe_answer',
): SebiseoChatResponse {
  return sebiseoChatResponseSchema.parse({
    status: 'refused',
    answer: REFUSAL_MESSAGE,
    suggestedActions: [],
    refusal: reason,
  })
}

export const SEBISEO_CHAT_NO_DOC_ANSWER =
  '현재 질문과 연결되는 제품 안내를 찾지 못했습니다. 화면 이름이나 버튼명을 함께 적어 다시 질문해 주세요.'

export const SEBISEO_CHAT_ERROR_ANSWER =
  '지금은 답변을 불러올 수 없습니다. 잠시 후 다시 시도하거나 왼쪽 메뉴에서 해당 화면을 직접 열어 주세요.'

export const SEBISEO_CHAT_RATE_LIMIT_ANSWER =
  '질문이 잠시 많았습니다. 잠시 후 다시 시도해 주세요.'
