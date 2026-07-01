import { afterEach, describe, expect, it, vi } from 'vitest'

describe('analyzeWithGemini', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('returns a typed provider failure without calling Gemini when disabled', async () => {
    vi.stubEnv('TURSO_DATABASE_URL', 'libsql://test.turso.io')
    vi.stubEnv('TURSO_AUTH_TOKEN', 'test-token')
    vi.stubEnv('BETTER_AUTH_SECRET', 'x'.repeat(32))
    vi.stubEnv('GEMINI_ENABLED', 'false')
    const { analyzeWithGemini } = await import('./gemini')

    const result = await analyzeWithGemini({
      fileBuffer: null,
      contentType: 'text/plain',
      fileType: 'other',
      originalFilename: 'sample.txt',
      extractedText: 'sample',
      extractionSummary: null,
      accountingPeriod: '2026-06',
      checklistItems: [],
    })

    expect(result).toEqual({
      success: false,
      rawOutput: '',
      error: 'Gemini provider is disabled (GEMINI_ENABLED=false)',
    })
  })
})
