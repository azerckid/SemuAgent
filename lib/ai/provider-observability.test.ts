import { describe, expect, it, vi } from 'vitest'
import {
  buildProviderFailureLog,
  logAiProviderFailures,
  summarizeProviderError,
} from './provider-observability'

describe('summarizeProviderError', () => {
  it('normalizes whitespace and keeps the provider error searchable', () => {
    expect(summarizeProviderError('  model\nnot\tfound  ')).toBe('model not found')
  })

  it('falls back for empty errors', () => {
    expect(summarizeProviderError(undefined)).toBe('unknown provider error')
    expect(summarizeProviderError('   ')).toBe('unknown provider error')
  })
})

describe('buildProviderFailureLog', () => {
  it('builds a structured log without raw model output', () => {
    const log = buildProviderFailureLog({
      uploadFileId: 'file_1',
      uploadSessionId: 'session_1',
      tenantId: 'tenant_1',
      consensusGroup: 'needs_review',
      run: {
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        analysisRunId: 'run_1',
        result: {
          success: false,
          rawOutput: 'sensitive raw response',
          error: '404 model not found',
        },
      },
    })

    expect(log).toEqual({
      event: 'ai_provider_failure',
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      analysisRunId: 'run_1',
      uploadFileId: 'file_1',
      uploadSessionId: 'session_1',
      tenantId: 'tenant_1',
      consensusGroup: 'needs_review',
      error: '404 model not found',
      rawOutputPresent: true,
    })
    expect(JSON.stringify(log)).not.toContain('sensitive raw response')
  })
})

describe('logAiProviderFailures', () => {
  it('logs failed providers only', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    logAiProviderFailures({
      uploadFileId: 'file_1',
      uploadSessionId: 'session_1',
      tenantId: 'tenant_1',
      consensusGroup: 'medium_confidence',
      runs: [
        {
          provider: 'openai',
          model: 'gpt-4o',
          result: { success: true, rawOutput: '{}' },
        },
        {
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          result: { success: false, rawOutput: '', error: 'quota exceeded' },
        },
      ],
    })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toBe('[ai-provider-failure]')
    expect(warn.mock.calls[0][1]).toMatchObject({
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      error: 'quota exceeded',
    })

    warn.mockRestore()
  })
})
