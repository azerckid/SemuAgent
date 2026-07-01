import { isGeminiEnabled } from '@/lib/ai/gemini-enabled'

export const AI_PROVIDER_ORDER = ['gemini', 'openai', 'claude'] as const

export type AiProvider = (typeof AI_PROVIDER_ORDER)[number]

export const AI_PROVIDER_PRIORITY: Record<AiProvider, number> = {
  gemini: 0,
  openai: 1,
  claude: 2,
}

export function getActiveAiProviderOrder(): AiProvider[] {
  if (isGeminiEnabled()) return [...AI_PROVIDER_ORDER]
  return AI_PROVIDER_ORDER.filter((provider) => provider !== 'gemini')
}

export function providerPriority(provider: string): number {
  return AI_PROVIDER_PRIORITY[provider as AiProvider] ?? 99
}
