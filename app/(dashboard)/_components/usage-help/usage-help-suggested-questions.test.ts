import { describe, expect, it } from 'vitest'
import {
  getStaticAnswer,
  resolveSuggestedQuestions,
} from './usage-help-suggested-questions'

describe('resolveSuggestedQuestions', () => {
  it('includes route-specific questions for reviews', () => {
    const questions = resolveSuggestedQuestions('/dashboard/reviews')
    expect(questions[0]).toBe('제출 자료 현황은 어떻게 보내요?')
    expect(questions).toContain('자료검토에서 제출 없음은 어떻게 처리하나요?')
  })

  it('limits merged suggestions to six items', () => {
    expect(resolveSuggestedQuestions('/dashboard/reviews')).toHaveLength(6)
  })
})

describe('getStaticAnswer', () => {
  it('returns route-aware screen role answer', () => {
    const answer = getStaticAnswer('이 화면에서 무엇을 보면 되나요?', '/dashboard')
    expect(answer?.sourceLabel).toBe('진행 현황 화면')
    expect(answer?.body).toContain('진행 현황')
  })

  it('returns customer-upload scoped recent upload guidance', () => {
    const answer = getStaticAnswer('최근 업로드 숫자는 무엇인가요?', '/dashboard')
    expect(answer?.body).toContain('고객')
    expect(answer?.body).toContain('직접 업로드')
  })

  it('returns null for unknown questions', () => {
    expect(getStaticAnswer('알 수 없는 질문', '/dashboard')).toBeNull()
  })
})
