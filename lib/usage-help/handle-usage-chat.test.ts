import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleUsageHelpChat, UsageHelpRateLimitError } from '@/lib/usage-help/handle-usage-chat'
import { resetUsageHelpRateLimitStoreForTests } from '@/lib/usage-help/rate-limit'
import { USAGE_HELP_ERROR_ANSWER, USAGE_HELP_NO_DOC_ANSWER } from '@/lib/usage-help/refusal-templates'

vi.mock('@/lib/usage-help/docs-retrieval', () => ({
  retrieveUsageHelpDocSnippets: vi.fn(),
}))

vi.mock('@/lib/usage-help/generate-answer', () => ({
  generateUsageHelpAnswer: vi.fn(),
}))

import { retrieveUsageHelpDocSnippets } from '@/lib/usage-help/docs-retrieval'
import { generateUsageHelpAnswer } from '@/lib/usage-help/generate-answer'

const requestContext = {
  tenantId: 'tenant-test',
  userId: 'user-test',
}

describe('handleUsageHelpChat hardening', () => {
  beforeEach(() => {
    resetUsageHelpRateLimitStoreForTests()
    vi.mocked(retrieveUsageHelpDocSnippets).mockReset()
    vi.mocked(generateUsageHelpAnswer).mockReset()
  })

  afterEach(() => {
    resetUsageHelpRateLimitStoreForTests()
  })

  it('does not rate limit scope refusals', async () => {
    vi.mocked(retrieveUsageHelpDocSnippets).mockResolvedValue([
      {
        sourceLabel: '자료 검토 · 제출 자료 현황',
        heading: 'test',
        body: 'test body',
        score: 1,
      },
    ])

    for (let index = 0; index < 12; index += 1) {
      const response = await handleUsageHelpChat(
        { question: '2026년 국민연금 요율 알려줘' },
        requestContext,
      )
      expect(response.status).toBe('refused')
    }

    expect(generateUsageHelpAnswer).not.toHaveBeenCalled()
  })

  it('does not rate limit UI term answers', async () => {
    vi.mocked(retrieveUsageHelpDocSnippets).mockResolvedValue([
      {
        sourceLabel: '자료 검토 · 제출 자료 현황',
        heading: 'test',
        body: 'test body',
        score: 1,
      },
    ])

    for (let index = 0; index < 12; index += 1) {
      const response = await handleUsageHelpChat(
        { question: '사유입력은 무엇인가?' },
        requestContext,
      )
      expect(response.status).toBe('answered')
    }

    expect(generateUsageHelpAnswer).not.toHaveBeenCalled()
  })

  it('does not rate limit no-doc template answers', async () => {
    vi.mocked(retrieveUsageHelpDocSnippets).mockResolvedValue([])

    for (let index = 0; index < 12; index += 1) {
      const response = await handleUsageHelpChat(
        { question: '자료검토 화면은 무엇을 보는 곳인가요?' },
        requestContext,
      )
      expect(response.status).toBe('answered')
      expect(response.answer).toBe(USAGE_HELP_NO_DOC_ANSWER)
    }

    expect(generateUsageHelpAnswer).not.toHaveBeenCalled()
  })

  it('throws when LLM path exceeds the rate limit', async () => {
    vi.mocked(retrieveUsageHelpDocSnippets).mockResolvedValue([
      {
        sourceLabel: '자료 검토 · 제출 자료 현황',
        heading: 'test',
        body: 'test body',
        score: 1,
      },
    ])
    vi.mocked(generateUsageHelpAnswer).mockResolvedValue({
      status: 'answered',
      answer: '자료 검토 화면에서는 제출 자료 현황을 확인합니다.',
      sourceLabels: ['자료 검토 · 제출 자료 현황'],
      suggestedQuestions: [],
    })

    for (let index = 0; index < 10; index += 1) {
      await handleUsageHelpChat(
        { question: '자료검토 화면은 무엇을 보는 곳인가요?' },
        requestContext,
      )
    }

    await expect(
      handleUsageHelpChat(
        { question: '자료검토 화면은 무엇을 보는 곳인가요?' },
        requestContext,
      ),
    ).rejects.toThrow(UsageHelpRateLimitError)
  })

  it('redacts sensitive content from LLM answers', async () => {
    vi.mocked(retrieveUsageHelpDocSnippets).mockResolvedValue([
      {
        sourceLabel: '자료 검토 · 제출 자료 현황',
        heading: 'test',
        body: 'test body',
        score: 1,
      },
    ])
    vi.mocked(generateUsageHelpAnswer).mockResolvedValue({
      status: 'answered',
      answer: '담당자 이메일은 client@example.com 입니다.',
      sourceLabels: ['자료 검토 · 제출 자료 현황'],
      suggestedQuestions: [],
    })

    const response = await handleUsageHelpChat(
      { question: '자료검토 화면은 무엇을 보는 곳인가요?' },
      requestContext,
    )

    expect(response.status).toBe('answered')
    expect(response.answer).not.toContain('client@example.com')
  })

  it('returns unavailable response when provider fails', async () => {
    vi.mocked(retrieveUsageHelpDocSnippets).mockResolvedValue([
      {
        sourceLabel: '자료 검토 · 제출 자료 현황',
        heading: 'test',
        body: 'test body',
        score: 1,
      },
    ])
    vi.mocked(generateUsageHelpAnswer).mockRejectedValue(new Error('provider unavailable'))

    const response = await handleUsageHelpChat(
      { question: '자료검토 화면은 무엇을 보는 곳인가요?' },
      requestContext,
    )

    expect(response.status).toBe('error')
    expect(response.answer).toBe(USAGE_HELP_ERROR_ANSWER)
    expect(response.suggestedQuestions.length).toBeGreaterThan(0)
  })
})
