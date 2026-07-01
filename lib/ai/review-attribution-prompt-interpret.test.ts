import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewAttributionFilterSpecV1 } from '@/lib/reviews/attribution-saved-prompt-filter-schema'

const anthropicMocks = vi.hoisted(() => ({
  create: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  requireAnthropicEnv: () => ({ ANTHROPIC_API_KEY: 'test-anthropic-key' }),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function Anthropic() {
    return {
      messages: {
        create: anthropicMocks.create,
      },
    }
  }),
}))

const { interpretReviewAttributionPrompt } = await import('./review-attribution-prompt-interpret')

function mockModelText(text: string) {
  anthropicMocks.create.mockResolvedValue({
    content: [{ type: 'text', text }],
  })
}

function mockModelJson(payload: unknown) {
  mockModelText(JSON.stringify(payload))
}

beforeEach(() => {
  anthropicMocks.create.mockReset()
})

// 기존 3개: claude 경로만 강제(providers:['claude'])해 단일 provider 동작·fail-closed를 검증한다.
describe('interpretReviewAttributionPrompt (claude path)', () => {
  it('returns a validated filter spec and sends only prompt/schema context', async () => {
    mockModelJson({
      version: 1,
      amountKrw: { min: 2_000_000 },
      explanationKo: '금액이 2,000,000원 이상인 항목만 표시합니다.',
    })

    const result = await interpretReviewAttributionPrompt(
      {
        promptText: '200만원 이상만 뽑아서 확인해줘',
        requestedPeriod: '2026-05',
        closePeriod: '2026-06',
      },
      { providers: ['claude'] },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.spec.amountKrw?.min).toBe(2_000_000)
    expect(result.provider).toBe('claude')

    const sentPrompt: string = anthropicMocks.create.mock.calls[0][0].messages[0].content
    expect(sentPrompt).toContain('실제 거래 row나 고객 데이터는 제공되지 않습니다')
    expect(sentPrompt).toContain('담당자 프롬프트:\n200만원 이상만 뽑아서 확인해줘')
    expect(sentPrompt).not.toContain('ABC상사')
  })

  it('fails closed when the model does not return JSON', async () => {
    mockModelText('조건을 판단할 수 없습니다')

    const result = await interpretReviewAttributionPrompt({ promptText: '큰 금액만' }, { providers: ['claude'] })

    expect(result).toEqual({ ok: false, error: 'AI 응답을 JSON으로 파싱하지 못했습니다.' })
  })

  it('fails closed when the model returns fields outside the allow-list', async () => {
    mockModelJson({
      version: 1,
      rawSql: 'amount_krw > 2000000',
      explanationKo: 'SQL로 필터링합니다.',
    })

    const result = await interpretReviewAttributionPrompt({ promptText: '200만원 이상만' }, { providers: ['claude'] })

    expect(result).toEqual({ ok: false, error: 'AI가 생성한 필터 스펙이 검증에 실패했습니다.' })
  })
})

// 비용 최적화 fallback: gemini -> openai -> claude. runner 주입으로 순서/단락을 검증한다.
describe('interpretReviewAttributionPrompt (provider fallback)', () => {
  const validSpec: ReviewAttributionFilterSpecV1 = {
    version: 1,
    amountKrw: { min: 1_000_000 },
    explanationKo: '금액이 1,000,000원 이상인 항목만 표시합니다.',
  }

  it('uses gemini first and does not call later providers when it succeeds', async () => {
    const calls: string[] = []
    const result = await interpretReviewAttributionPrompt(
      { promptText: '100만원 이상만' },
      {
        providers: ['gemini', 'openai', 'claude'],
        runner: async ({ provider }) => {
          calls.push(provider)
          return { ok: true, spec: validSpec }
        },
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.provider).toBe('gemini')
    expect(calls).toEqual(['gemini'])
  })

  it('falls back gemini -> openai when gemini fails', async () => {
    const calls: string[] = []
    const result = await interpretReviewAttributionPrompt(
      { promptText: '100만원 이상만' },
      {
        providers: ['gemini', 'openai', 'claude'],
        runner: async ({ provider }) => {
          calls.push(provider)
          if (provider === 'gemini') return { ok: false, error: 'gemini 실패' }
          return { ok: true, spec: validSpec }
        },
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.provider).toBe('openai')
    expect(calls).toEqual(['gemini', 'openai'])
  })

  it('returns the last error when all providers fail', async () => {
    const result = await interpretReviewAttributionPrompt(
      { promptText: '100만원 이상만' },
      {
        providers: ['gemini', 'openai', 'claude'],
        runner: async ({ provider }) => ({ ok: false, error: `${provider} 실패` }),
      },
    )

    expect(result).toEqual({ ok: false, error: 'claude 실패' })
  })
})
