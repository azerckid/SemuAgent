export const DEFAULT_GEMINI_ANALYSIS_MODEL = 'gemini-3.5-flash'

// gpt-4o가 2026-10-23 API 종료 예정(Deprecated)이라 GPT-5.4 mini로 교체.
// fallback·보조 검증 역할이라 비용·지연 최적화 모델을 사용한다.
export const OPENAI_ANALYSIS_MODEL = 'gpt-5.4-mini'

export function normalizeGeminiAnalysisModel(model: string | null | undefined): string {
  const trimmed = model?.trim()
  return trimmed || DEFAULT_GEMINI_ANALYSIS_MODEL
}
