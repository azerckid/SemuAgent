import { describe, expect, it } from 'vitest'
import {
  parseMaterialAttributionJsonText,
  parseMaterialAttributionStructuredValue,
} from './period-attribution-ai-structured-schema'

describe('period-attribution-ai structured schema parsing', () => {
  it('accepts structured tool input validated by Zod', () => {
    const result = parseMaterialAttributionStructuredValue({
      candidates: [{
        index: 0,
        evidenceDate: '2024-03-15',
        attributedPeriod: '2024-03',
        periodRelation: 'prior',
        recommendation: 'reference_only',
        confidence: 'high',
        reason: '2024년 거래로 판단됩니다.',
      }],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.candidates[0]?.attributedPeriod).toBe('2024-03')
    }
  })

  it('rejects invalid evidenceDate after structured output', () => {
    const result = parseMaterialAttributionStructuredValue({
      candidates: [{
        index: 0,
        evidenceDate: 'not-a-date',
        attributedPeriod: '2024-03',
        periodRelation: 'prior',
        recommendation: 'reference_only',
        confidence: 'high',
        reason: '잘못된 날짜',
      }],
    })

    expect(result.ok).toBe(false)
  })

  it('parses fenced JSON text as fallback', () => {
    const result = parseMaterialAttributionJsonText([
      '```json',
      JSON.stringify({
        candidates: [{
          index: 1,
          evidenceDate: null,
          attributedPeriod: '2026-06',
          periodRelation: 'requested',
          recommendation: 'include',
          confidence: 'medium',
          reason: '요청월 거래입니다.',
        }],
      }),
      '```',
    ].join('\n'))

    expect(result.ok).toBe(true)
  })
})
