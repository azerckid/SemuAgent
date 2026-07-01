import { afterEach, describe, expect, it, vi } from 'vitest'
import { AI_PROVIDER_ORDER, getActiveAiProviderOrder, providerPriority } from './provider-order'

describe('AI provider order', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses Gemini, OpenAI, then Claude as the analysis priority', () => {
    expect(AI_PROVIDER_ORDER).toEqual(['gemini', 'openai', 'claude'])
    expect(['claude', 'gemini', 'openai'].sort((a, b) => providerPriority(a) - providerPriority(b))).toEqual([
      'gemini',
      'openai',
      'claude',
    ])
  })

  it('omits Gemini when GEMINI_ENABLED=false', () => {
    vi.stubEnv('GEMINI_ENABLED', 'false')
    expect(getActiveAiProviderOrder()).toEqual(['openai', 'claude'])
  })
})
