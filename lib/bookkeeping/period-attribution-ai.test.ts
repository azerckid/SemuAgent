import { describe, expect, it, vi } from 'vitest'
import {
  enhanceMaterialAttributionWithLlm,
  type PeriodAttributionLlmRunner,
} from './period-attribution-ai'
import { applyMaterialAttributionAiSuggestions } from './period-attribution-ai-merge'
import type { GeneratedAttributionRow } from './period-attribution-service'
import type { MaterialAttributionAiOutput } from './schemas'

const baseRows: GeneratedAttributionRow[] = [
  {
    uploadFileId: 'file-1',
    sourceKind: 'transaction_row',
    sourceLabel: 'ambiguous-row.xlsx',
    evidenceDate: null,
    attributedPeriod: null,
    periodRelation: 'unknown',
    amountKrw: 10000,
    counterparty: '테스트상사',
    description: '날짜 없는 거래 행',
    duplicateStatus: 'none',
    duplicateBasis: null,
    recommendation: 'hold',
  },
  {
    uploadFileId: 'file-2',
    sourceKind: 'transaction_row',
    sourceLabel: 'clear-2026-06.xlsx',
    evidenceDate: '2026-06-02',
    attributedPeriod: '2026-06',
    periodRelation: 'requested',
    amountKrw: 20000,
    counterparty: '명확상사',
    description: '명확한 거래 행',
    duplicateStatus: 'none',
    duplicateBasis: null,
    recommendation: 'include',
  },
]

describe('applyMaterialAttributionAiSuggestions', () => {
  it('merges valid AI period suggestions into the matching row', () => {
    const ai: MaterialAttributionAiOutput = {
      candidates: [{
        index: 0,
        evidenceDate: '2026-05-31',
        attributedPeriod: '2026-05',
        periodRelation: 'prior',
        recommendation: 'include',
        confidence: 'high',
        reason: '행 설명과 파일 맥락상 5월 거래로 보입니다.',
      }],
    }

    const rows = applyMaterialAttributionAiSuggestions({ rows: baseRows, ai })

    expect(rows[0]).toMatchObject({
      evidenceDate: '2026-05-31',
      attributedPeriod: '2026-05',
      periodRelation: 'prior',
      recommendation: 'include',
    })
    expect(rows[1]).toEqual(baseRows[1])
  })

  it('keeps valid period suggestions resolved even when AI confidence is low', () => {
    const ai: MaterialAttributionAiOutput = {
      candidates: [{
        index: 0,
        evidenceDate: '2026-06-01',
        attributedPeriod: '2026-06',
        periodRelation: 'requested',
        recommendation: 'include',
        confidence: 'low',
        reason: '기간 단서가 약합니다.',
      }],
    }

    const rows = applyMaterialAttributionAiSuggestions({ rows: baseRows, ai })

    expect(rows[0]).toMatchObject({
      attributedPeriod: '2026-06',
      periodRelation: 'requested',
      recommendation: 'include',
    })
  })

  it('keeps deterministic rows when AI returns no candidates', () => {
    const rows = applyMaterialAttributionAiSuggestions({
      rows: baseRows,
      ai: { candidates: [] },
    })

    expect(rows).toEqual(baseRows)
  })

  it('ignores suggestions for rows that were not sent to the LLM', () => {
    const ai: MaterialAttributionAiOutput = {
      candidates: [{
        index: 1,
        evidenceDate: '2026-05-31',
        attributedPeriod: '2026-05',
        periodRelation: 'prior',
        recommendation: 'include',
        confidence: 'high',
        reason: '비대상 index 응답입니다.',
      }],
    }

    const rows = applyMaterialAttributionAiSuggestions({
      rows: baseRows,
      ai,
      allowedIndexes: new Set([0]),
    })

    expect(rows).toEqual(baseRows)
  })

  it('rejects invalid AI dates and periods before persistence', () => {
    const ai: MaterialAttributionAiOutput = {
      candidates: [{
        index: 0,
        evidenceDate: '2026-00-00',
        attributedPeriod: '2026-00',
        periodRelation: 'prior',
        recommendation: 'include',
        confidence: 'high',
        reason: '금액값을 날짜처럼 잘못 읽은 응답입니다.',
      }],
    }

    const rows = applyMaterialAttributionAiSuggestions({ rows: baseRows, ai })

    expect(rows[0]).toMatchObject({
      evidenceDate: null,
      attributedPeriod: null,
      periodRelation: 'unknown',
      recommendation: 'hold',
    })
  })
})

describe('enhanceMaterialAttributionWithLlm', () => {
  const requestedPeriodCandidate: MaterialAttributionAiOutput['candidates'][number] = {
    index: 1,
    evidenceDate: '2026-06-02',
    attributedPeriod: '2026-06',
    periodRelation: 'requested',
    recommendation: 'include',
    confidence: 'high',
    reason: '요청월 거래입니다.',
  }
  const mayPeriodCandidate: MaterialAttributionAiOutput['candidates'][number] = {
    index: 0,
    evidenceDate: '2026-05-31',
    attributedPeriod: '2026-05',
    periodRelation: 'prior',
    recommendation: 'include',
    confidence: 'high',
    reason: '5월 거래로 보입니다.',
  }
  const junePeriodCandidate: MaterialAttributionAiOutput['candidates'][number] = {
    index: 0,
    evidenceDate: '2026-06-01',
    attributedPeriod: '2026-06',
    periodRelation: 'requested',
    recommendation: 'include',
    confidence: 'high',
    reason: '6월 거래로 보입니다.',
  }
  const aprilPeriodCandidate: MaterialAttributionAiOutput['candidates'][number] = {
    index: 0,
    evidenceDate: '2026-04-30',
    attributedPeriod: '2026-04',
    periodRelation: 'prior',
    recommendation: 'include',
    confidence: 'high',
    reason: '4월 거래로 보입니다.',
  }
  const mayPeriodJudgment: MaterialAttributionAiOutput = {
    candidates: [mayPeriodCandidate, requestedPeriodCandidate],
  }

  it('runs Gemini and OpenAI, then stops before Claude when both judgments agree', async () => {
    const calls: string[] = []
    const runner: PeriodAttributionLlmRunner = vi.fn(async ({ provider }) => {
      calls.push(provider)
      if (provider === 'gemini' || provider === 'openai') {
        return {
          ok: true as const,
          data: mayPeriodJudgment,
        }
      }
      return { ok: false as const, error: 'Claude should not be called' }
    })

    const rows = await enhanceMaterialAttributionWithLlm({
      clientName: '테스트고객',
      requestedPeriod: '2026-06',
      closePeriod: '2026-04~2026-06',
      rows: baseRows,
    }, {
      providers: ['gemini', 'openai', 'claude'],
      runner,
    })

    expect(calls).toEqual(['gemini', 'openai'])
    expect(rows[0]).toMatchObject({
      evidenceDate: '2026-05-31',
      attributedPeriod: '2026-05',
      periodRelation: 'prior',
    })
  })

  it('treats Gemini and OpenAI as agreeing when only recommendation differs (merge recomputes it)', async () => {
    // 회귀: recommendation은 합의 비교에서 제외해야 한다. 두 모델이 기간 필드는
    // 같고 recommendation만 다를 때(예: include vs reference_only) Claude 없이 합의되어야 한다.
    const calls: string[] = []
    const runner: PeriodAttributionLlmRunner = vi.fn(async ({ provider }) => {
      calls.push(provider)
      if (provider === 'gemini') {
        return {
          ok: true as const,
          data: {
            candidates: [
              { ...mayPeriodCandidate, recommendation: 'include' as const },
              { ...requestedPeriodCandidate, recommendation: 'include' as const },
            ],
          },
        }
      }
      if (provider === 'openai') {
        return {
          ok: true as const,
          data: {
            candidates: [
              { ...mayPeriodCandidate, recommendation: 'reference_only' as const },
              { ...requestedPeriodCandidate, recommendation: 'reference_only' as const },
            ],
          },
        }
      }
      return { ok: false as const, error: 'Claude should not be called' }
    })

    const rows = await enhanceMaterialAttributionWithLlm({
      clientName: '테스트고객',
      requestedPeriod: '2026-06',
      closePeriod: '2026-04~2026-06',
      rows: baseRows,
    }, {
      providers: ['gemini', 'openai', 'claude'],
      runner,
    })

    expect(calls).toEqual(['gemini', 'openai'])
    expect(rows[0]).toMatchObject({
      evidenceDate: '2026-05-31',
      attributedPeriod: '2026-05',
      periodRelation: 'prior',
    })
  })

  it('uses Claude only to form a two-provider majority when Gemini and OpenAI disagree', async () => {
    const calls: string[] = []
    const runner: PeriodAttributionLlmRunner = vi.fn(async ({ provider }) => {
      calls.push(provider)
      if (provider === 'gemini') {
        return {
          ok: true as const,
          data: mayPeriodJudgment,
        }
      }
      if (provider === 'openai') {
        return {
          ok: true as const,
          data: {
            candidates: [junePeriodCandidate, requestedPeriodCandidate],
          },
        }
      }
      return {
        ok: true as const,
        data: mayPeriodJudgment,
      }
    })

    const rows = await enhanceMaterialAttributionWithLlm({
      clientName: '테스트고객',
      requestedPeriod: '2026-06',
      closePeriod: '2026-04~2026-06',
      rows: baseRows,
    }, {
      providers: ['gemini', 'openai', 'claude'],
      runner,
    })

    expect(calls).toEqual(['gemini', 'openai', 'claude'])
    expect(rows[0]).toMatchObject({
      evidenceDate: '2026-05-31',
      attributedPeriod: '2026-05',
      periodRelation: 'prior',
    })
  })

  it('fails closed when no two providers agree', async () => {
    const runner: PeriodAttributionLlmRunner = vi.fn(async ({ provider }) => {
      if (provider === 'gemini') return { ok: true as const, data: mayPeriodJudgment }
      if (provider === 'openai') {
        return {
          ok: true as const,
          data: {
            candidates: [junePeriodCandidate, requestedPeriodCandidate],
          },
        }
      }
      return {
        ok: true as const,
        data: {
          candidates: [aprilPeriodCandidate, requestedPeriodCandidate],
        },
      }
    })

    await expect(enhanceMaterialAttributionWithLlm({
      clientName: '테스트고객',
      requestedPeriod: '2026-06',
      closePeriod: '2026-04~2026-06',
      rows: baseRows,
    }, {
      providers: ['gemini', 'openai', 'claude'],
      runner,
    })).rejects.toThrow('두 provider 합의')
  })

  it('fails closed when providers omit any sent row index', async () => {
    const calls: string[] = []
    const runner: PeriodAttributionLlmRunner = vi.fn(async ({ provider }) => {
      calls.push(provider)
      if (provider === 'claude') return { ok: false as const, error: 'Claude unavailable' }
      return {
        ok: true as const,
        data: { candidates: [mayPeriodCandidate] },
      }
    })

    await expect(enhanceMaterialAttributionWithLlm({
      clientName: '테스트고객',
      requestedPeriod: '2026-06',
      closePeriod: '2026-04~2026-06',
      rows: baseRows,
    }, {
      providers: ['gemini', 'openai', 'claude'],
      runner,
    })).rejects.toThrow('두 provider 합의')
    expect(calls).toEqual(['gemini', 'openai', 'claude'])
  })

  it('sends deterministic rows to the LLM instead of only ambiguous rows', async () => {
    let prompt = ''
    const runner: PeriodAttributionLlmRunner = vi.fn(async ({ provider, prompt: receivedPrompt }) => {
      prompt = receivedPrompt
      if (provider === 'claude') return { ok: false as const, error: 'Claude should not be called' }
      return {
        ok: true as const,
        data: {
          candidates: [mayPeriodCandidate, {
            index: 1,
            evidenceDate: '2026-05-29',
            attributedPeriod: '2026-05',
            periodRelation: 'prior' as const,
            recommendation: 'include' as const,
            confidence: 'high' as const,
            reason: '명확 행도 LLM 재판단 대상입니다.',
          }],
        },
      }
    })

    const rows = await enhanceMaterialAttributionWithLlm({
      clientName: '테스트고객',
      requestedPeriod: '2026-06',
      closePeriod: '2026-04~2026-06',
      rows: baseRows,
    }, {
      providers: ['gemini', 'openai', 'claude'],
      runner,
    })

    expect(prompt).toContain('clear-2026-06.xlsx')
    expect(rows[1]).toMatchObject({
      evidenceDate: '2026-05-29',
      attributedPeriod: '2026-05',
      periodRelation: 'prior',
    })
  })

  it('chunks more than 25 rows while preserving original indexes', async () => {
    const manyRows = Array.from({ length: 26 }, (_, index): GeneratedAttributionRow => ({
      ...baseRows[1]!,
      uploadFileId: `file-${index}`,
      sourceLabel: `row-${index}.xlsx`,
    }))
    const prompts: string[] = []
    const runner: PeriodAttributionLlmRunner = vi.fn(async ({ provider, prompt: receivedPrompt }) => {
      if (provider === 'gemini') prompts.push(receivedPrompt)
      if (provider === 'claude') return { ok: false as const, error: 'Claude should not be called' }
      const indexes = [...receivedPrompt.matchAll(/row-(\d+)\.xlsx/g)]
        .map((match) => Number(match[1]))
      return {
        ok: true as const,
        data: {
          candidates: indexes.map((index) => ({
            index,
            evidenceDate: index === 24 || index === 25 ? '2026-04-30' : '2026-06-02',
            attributedPeriod: index === 24 || index === 25 ? '2026-04' : '2026-06',
            periodRelation: index === 24 || index === 25 ? 'prior' as const : 'requested' as const,
            recommendation: 'include' as const,
            confidence: 'high' as const,
            reason: '청크 index 유지 확인입니다.',
          })),
        },
      }
    })

    const rows = await enhanceMaterialAttributionWithLlm({
      clientName: '테스트고객',
      requestedPeriod: '2026-06',
      closePeriod: '2026-04~2026-06',
      rows: manyRows,
    }, {
      providers: ['gemini', 'openai', 'claude'],
      runner,
    })

    expect(prompts).toHaveLength(2)
    expect(rows[24]?.attributedPeriod).toBe('2026-04')
    expect(rows[25]?.attributedPeriod).toBe('2026-04')
  })
})
