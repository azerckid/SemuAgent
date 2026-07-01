import type { ProviderResult } from '@/lib/validations/analysis'

type AiProvider = 'claude' | 'openai' | 'gemini'

type ProviderRun = {
  provider: AiProvider
  model: string
  result: ProviderResult
  analysisRunId?: string
}

type LogAiProviderFailuresParams = {
  uploadFileId: string
  uploadSessionId: string
  tenantId: string
  consensusGroup: string
  runs: ProviderRun[]
}

const MAX_ERROR_LENGTH = 500

export function summarizeProviderError(error: string | undefined): string {
  const normalized = error?.replace(/\s+/g, ' ').trim()
  if (!normalized) return 'unknown provider error'
  return normalized.length > MAX_ERROR_LENGTH
    ? `${normalized.slice(0, MAX_ERROR_LENGTH)}...`
    : normalized
}

export function buildProviderFailureLog(params: {
  uploadFileId: string
  uploadSessionId: string
  tenantId: string
  consensusGroup: string
  run: ProviderRun
}) {
  return {
    event: 'ai_provider_failure',
    provider: params.run.provider,
    model: params.run.model,
    analysisRunId: params.run.analysisRunId ?? null,
    uploadFileId: params.uploadFileId,
    uploadSessionId: params.uploadSessionId,
    tenantId: params.tenantId,
    consensusGroup: params.consensusGroup,
    error: summarizeProviderError(params.run.result.error),
    rawOutputPresent: Boolean(params.run.result.rawOutput),
  }
}

export function logAiProviderFailures(params: LogAiProviderFailuresParams): void {
  for (const run of params.runs) {
    if (run.result.success) continue

    console.warn('[ai-provider-failure]', buildProviderFailureLog({
      uploadFileId: params.uploadFileId,
      uploadSessionId: params.uploadSessionId,
      tenantId: params.tenantId,
      consensusGroup: params.consensusGroup,
      run,
    }))
  }
}
