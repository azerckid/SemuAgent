import { beforeEach, describe, expect, it, vi } from 'vitest'
import { planLawQueries } from './plan-query'

const anthropicMocks = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('@/lib/env', () => ({
  requireAnthropicEnv: () => ({ ANTHROPIC_API_KEY: 'test-anthropic-key' }),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function Anthropic() {
    return { messages: { create: anthropicMocks.create } }
  }),
}))

function mockJson(payload: unknown) {
  anthropicMocks.create.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(payload) }] })
}

beforeEach(() => {
  anthropicMocks.create.mockReset()
})

describe('planLawQueries', () => {
  it('returns candidate law names and keywords from the question', async () => {
    mockJson({ lawNames: ['법인세법', '법인세법 시행령'], keywords: ['가지급금', '인정이자'] })

    const plan = await planLawQueries({ question: '대표이사 가지급금 인정이자?' })
    expect(plan.lawNames).toEqual(['법인세법', '법인세법 시행령'])
    expect(plan.keywords).toEqual(['가지급금', '인정이자'])
  })

  it('returns empty arrays when no law can be identified', async () => {
    mockJson({ lawNames: [], keywords: [] })
    const plan = await planLawQueries({ question: '오늘 점심 뭐 먹지' })
    expect(plan.lawNames).toEqual([])
    expect(plan.keywords).toEqual([])
  })

  it('defaults keywords to [] when the field is omitted', async () => {
    mockJson({ lawNames: ['상법'] })
    const plan = await planLawQueries({ question: 'q' })
    expect(plan.keywords).toEqual([])
  })

  it('caps to 3 names and de-duplicates/trims', async () => {
    mockJson({ lawNames: ['소득세법', ' 소득세법 ', '법인세법', '부가가치세법', '상법'], keywords: [] })

    const plan = await planLawQueries({ question: 'q' })
    expect(plan.lawNames).toEqual(['소득세법', '법인세법', '부가가치세법'])
  })

  it('throws when output JSON is missing', async () => {
    anthropicMocks.create.mockResolvedValue({ content: [{ type: 'text', text: 'no json' }] })
    await expect(planLawQueries({ question: 'q' })).rejects.toThrow('JSON not found')
  })

  it('throws when output fails schema validation', async () => {
    mockJson({ lawNames: 'not-an-array' })
    await expect(planLawQueries({ question: 'q' })).rejects.toThrow('validation failed')
  })
})
