import { describe, expect, it } from 'vitest'
import {
  recentSebiseoHistory,
  sebiseoChatRequestSchema,
  sebiseoChatResponseSchema,
} from './schemas'

describe('sebiseo chat schemas', () => {
  it('limits messages to 2000 characters and history to 8 turns', () => {
    expect(sebiseoChatRequestSchema.safeParse({ message: 'a'.repeat(2001), history: [] }).success).toBe(false)
    expect(sebiseoChatRequestSchema.safeParse({
      message: '질문',
      history: Array.from({ length: 9 }, (_, index) => ({ role: 'user', content: `질문 ${index}` })),
    }).success).toBe(false)
  })

  it('keeps only the most recent 8 turns for the provider', () => {
    const history = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `turn-${index}`,
    }))
    expect(recentSebiseoHistory(history)).toHaveLength(8)
    expect(recentSebiseoHistory(history)[0]?.content).toBe('turn-4')
  })

  it('requires a refusal reason only for refused responses', () => {
    expect(sebiseoChatResponseSchema.safeParse({
      status: 'refused',
      answer: '지원 범위 밖입니다.',
      suggestedActions: [],
    }).success).toBe(false)
    expect(sebiseoChatResponseSchema.safeParse({
      status: 'answered',
      answer: '자료수집에서 확인하세요.',
      suggestedActions: [],
    }).success).toBe(true)
  })
})
