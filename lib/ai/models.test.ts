import { describe, expect, it } from 'vitest'
import { DEFAULT_GEMINI_ANALYSIS_MODEL, normalizeGeminiAnalysisModel } from './models'

describe('Gemini analysis model config', () => {
  it('defaults to the current Gemini stable flash model', () => {
    expect(DEFAULT_GEMINI_ANALYSIS_MODEL).toBe('gemini-3.5-flash')
  })

  it('keeps an explicit configured model', () => {
    expect(normalizeGeminiAnalysisModel('gemini-2.5-flash')).toBe('gemini-2.5-flash')
  })

  it('falls back to the default for blank values', () => {
    expect(normalizeGeminiAnalysisModel('  ')).toBe(DEFAULT_GEMINI_ANALYSIS_MODEL)
    expect(normalizeGeminiAnalysisModel(null)).toBe(DEFAULT_GEMINI_ANALYSIS_MODEL)
  })
})
