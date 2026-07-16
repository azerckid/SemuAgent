import { describe, expect, it, vi } from 'vitest'
import {
  handleSebiseoChat,
  SebiseoRateLimitError,
  type SebiseoChatDependencies,
} from './handle-chat'
import type { SebiseoChatRequest } from './schemas'

const context = { tenantId: 'tenant-a', userId: 'user-a' }
const snippet = [{
  sourceLabel: '자료수집',
  heading: '자료수집',
  body: '파일은 자료수집 화면에서 올립니다.',
  score: 3,
}]

function request(overrides: Partial<SebiseoChatRequest> = {}): SebiseoChatRequest {
  return {
    message: '자료수집에서 통장 파일 어떻게 올려요?',
    history: [],
    routePath: '/dashboard/sebiseo',
    ...overrides,
  }
}

describe('handleSebiseoChat', () => {
  it('refuses out-of-scope questions without retrieval, rate limit, or provider calls', async () => {
    const retrieve = vi.fn(async () => snippet)
    const generate = vi.fn()
    const consumeRateLimit = vi.fn()

    const response = await handleSebiseoChat(request({ message: '오늘 날씨 어때?' }), context, {
      retrieve,
      generate,
      consumeRateLimit,
    })

    expect(response.status).toBe('refused')
    expect(retrieve).not.toHaveBeenCalled()
    expect(generate).not.toHaveBeenCalled()
    expect(consumeRateLimit).not.toHaveBeenCalled()
  })

  it('redacts message and history before retrieval and provider invocation', async () => {
    const retrieve = vi.fn(async (message: string) => {
      void message
      return snippet
    })
    const generate = vi.fn(async (params: Parameters<SebiseoChatDependencies['generate']>[0]) => {
      void params
      return {
        status: 'answered' as const,
        answer: '자료수집에서 첨부 버튼을 누르세요.',
      }
    })
    const consumeRateLimit = vi.fn()

    await handleSebiseoChat(request({
      message: '자료수집에서 900101-1234567 파일은 어떻게 올려요?',
      history: [{ role: 'user', content: '이메일 client@example.com' }],
    }), context, { retrieve, generate, consumeRateLimit })

    expect(retrieve.mock.calls[0]?.[0]).not.toContain('900101-1234567')
    const generated = generate.mock.calls[0]?.[0]
    expect(generated?.message).not.toContain('900101-1234567')
    expect(generated?.history[0]?.content).not.toContain('client@example.com')
    expect(consumeRateLimit).toHaveBeenCalledWith(context)
  })

  it('does not call the provider when no matching product documentation exists', async () => {
    const generate = vi.fn()
    const consumeRateLimit = vi.fn()
    const response = await handleSebiseoChat(request(), context, {
      retrieve: vi.fn(async () => []),
      generate,
      consumeRateLimit,
    })

    expect(response.status).toBe('answered')
    expect(response.answer).toContain('화면 이름이나 버튼명')
    expect(generate).not.toHaveBeenCalled()
    expect(consumeRateLimit).not.toHaveBeenCalled()
  })

  it('redacts provider output and blocks false mutation claims', async () => {
    const base = {
      retrieve: vi.fn(async () => snippet),
      consumeRateLimit: vi.fn(),
    }
    const redacted = await handleSebiseoChat(request(), context, {
      ...base,
      generate: vi.fn(async () => ({ status: 'answered' as const, answer: 'client@example.com로 안내합니다.' })),
    })
    expect(redacted.answer).not.toContain('client@example.com')

    const blocked = await handleSebiseoChat(request(), context, {
      ...base,
      generate: vi.fn(async () => ({ status: 'answered' as const, answer: '부가세 신고를 완료했습니다.' })),
    })
    expect(blocked.status).toBe('refused')
    expect(blocked.refusal).toBe('unsafe_answer')
  })

  it('attaches server-derived screen actions to allowed answers only', async () => {
    const base = {
      retrieve: vi.fn(async () => snippet),
      consumeRateLimit: vi.fn(),
    }

    const answered = await handleSebiseoChat(
      request({ message: '부가세 공제는 어디서 확인해요?' }),
      context,
      { ...base, generate: vi.fn(async () => ({ status: 'answered' as const, answer: '부가세 화면에서 확인합니다.' })) },
    )
    expect(answered.status).toBe('answered')
    expect(answered.suggestedActions).toEqual([
      { id: 'vat', label: '부가세 열기', href: '/dashboard/vat' },
    ])

    const refused = await handleSebiseoChat(request({ message: '오늘 날씨 어때?' }), context, {
      ...base,
      generate: vi.fn(),
    })
    expect(refused.status).toBe('refused')
    expect(refused.suggestedActions).toEqual([])

    const noDoc = await handleSebiseoChat(request(), context, {
      retrieve: vi.fn(async () => []),
      generate: vi.fn(),
      consumeRateLimit: vi.fn(),
    })
    expect(noDoc.suggestedActions).toEqual([])
  })

  it('returns a safe error on provider failure and preserves rate-limit errors', async () => {
    const failed = await handleSebiseoChat(request(), context, {
      retrieve: vi.fn(async () => snippet),
      generate: vi.fn(async () => {
        throw new Error('provider secret detail')
      }),
      consumeRateLimit: vi.fn(),
    })
    expect(failed.status).toBe('error')
    expect(failed.answer).not.toContain('provider secret detail')

    await expect(handleSebiseoChat(request(), context, {
      retrieve: vi.fn(async () => snippet),
      generate: vi.fn(),
      consumeRateLimit: vi.fn(() => {
        throw new SebiseoRateLimitError()
      }),
    })).rejects.toBeInstanceOf(SebiseoRateLimitError)
  })
})
