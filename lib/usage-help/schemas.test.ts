import { describe, expect, it } from 'vitest'
import {
  usageHelpChatRequestSchema,
  usageHelpChatResponseSchema,
  usageHelpModelOutputSchema,
} from '@/lib/usage-help/schemas'

describe('usageHelpChatRequestSchema', () => {
  it('accepts a valid request', () => {
    const parsed = usageHelpChatRequestSchema.safeParse({
      question: '자료검토 화면은 무엇을 보는 곳인가요?',
      routePath: '/dashboard/reviews',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects empty question', () => {
    const parsed = usageHelpChatRequestSchema.safeParse({ question: '   ' })
    expect(parsed.success).toBe(false)
  })

  it('rejects overly long question', () => {
    const parsed = usageHelpChatRequestSchema.safeParse({
      question: 'a'.repeat(501),
    })
    expect(parsed.success).toBe(false)
  })
})

describe('usageHelpChatResponseSchema', () => {
  it('accepts answered response', () => {
    const parsed = usageHelpChatResponseSchema.safeParse({
      status: 'answered',
      answer: '자료 검토 화면에서 세션별 제출 상태를 확인합니다.',
      sourceLabels: ['자료 검토 화면'],
      suggestedQuestions: ['제출 없음은 어떻게 처리하나요?'],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const parsed = usageHelpChatResponseSchema.safeParse({
      status: 'pending',
      answer: 'test',
      sourceLabels: [],
      suggestedQuestions: [],
    })
    expect(parsed.success).toBe(false)
  })
})

describe('usageHelpModelOutputSchema', () => {
  it('accepts refused model output', () => {
    const parsed = usageHelpModelOutputSchema.safeParse({
      status: 'refused',
      answer: 'JARYO 사용법만 답변합니다.',
      sourceLabels: [],
      suggestedQuestions: ['이 화면에서 무엇을 보면 되나요?'],
    })
    expect(parsed.success).toBe(true)
  })
})
