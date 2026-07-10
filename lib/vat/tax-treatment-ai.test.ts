import { describe, expect, it, vi } from 'vitest'
import { vatTaxTreatmentDisplayRowSchema, type VatTaxTreatmentDisplayRow } from '@/lib/validations/vat-tax-treatment'
import { vatTaxTreatmentAiBatchOutputSchema } from '@/lib/validations/vat-tax-treatment-ai'
import {
  buildVatTaxTreatmentAiPrompt,
  enhanceVatTaxTreatmentRowsWithSingleAi,
  resolveConfiguredVatTaxTreatmentProvider,
  type VatTaxTreatmentAiRunner,
} from './tax-treatment-ai'

function displayRow(overrides: Partial<VatTaxTreatmentDisplayRow> = {}): VatTaxTreatmentDisplayRow {
  return vatTaxTreatmentDisplayRowSchema.parse({
    rowId: 'row-1',
    classificationRowId: 'row-1',
    tenantId: 'tenant-secret',
    businessEntityId: 'client-secret',
    periodKey: '2026-H1',
    direction: 'purchase',
    currentVatFact: {
      taxType: 'taxable',
      supplyAmountKrw: 100_000,
      taxAmountKrw: 10_000,
      grossAmountKrw: 110_000,
      status: 'derived',
    },
    recommendation: 'needs_review',
    source: 'deterministic_rule',
    confidence: 'low',
    basisLabel: '업무 관련성을 확인해야 합니다.',
    ruleReference: 'P-07',
    ruleVersion: 'vat-kr-2026.07-v1',
    requiredEvidence: [{ code: 'business_purpose', label: '업무 목적', status: 'needs_review' }],
    missingFacts: ['업무 목적'],
    hometaxComparisonMode: 'expected_prefill',
    hometaxAction: 'review_deduction',
    aiTrace: null,
    aiRuntimeStatus: 'not_requested',
    finalDecision: null,
    confirmedByStaffId: null,
    confirmedAt: null,
    transactionDate: '2026-06-15',
    counterparty: '테스트 거래처',
    description: '업무용 결제',
    sourceType: 'tax_invoice',
    accountLabel: null,
    ...overrides,
  })
}

function successRunner(overrides: Partial<Parameters<VatTaxTreatmentAiRunner>[0]> = {}) {
  return vi.fn<VatTaxTreatmentAiRunner>(async (input) => {
    expect(input).toMatchObject(overrides)
    return {
      ok: true,
      modelName: 'test-model',
      data: {
        candidates: [{
          index: 0,
          recommendation: 'likely_deductible',
          confidence: 'medium',
          basisLabel: '업무용 거래로 보입니다.',
          missingFacts: [],
          hometaxAction: 'expected_no_change',
        }],
      },
    }
  })
}

describe('VAT single-provider AI enhancement', () => {
  it('sends only unresolved rows and keeps deterministic rows unchanged', async () => {
    const deterministic = displayRow({
      rowId: 'deterministic',
      classificationRowId: 'deterministic',
      recommendation: 'likely_non_deductible',
      confidence: 'high',
    })
    const runner = successRunner({ provider: 'openai' })

    const result = await enhanceVatTaxTreatmentRowsWithSingleAi({
      rows: [deterministic, displayRow()],
      provider: 'openai',
      runner,
    })

    expect(result[0]).toEqual(deterministic)
    expect(result[1]).toMatchObject({
      recommendation: 'likely_deductible',
      source: 'ai_single',
      ruleReference: null,
      aiRuntimeStatus: 'completed',
      aiTrace: {
        provider: 'openai',
        modelName: 'test-model',
        promptVersion: 'vat-tax-treatment-v1',
        consensusProviders: [],
      },
    })
    expect(runner).toHaveBeenCalledOnce()
  })

  it('keeps tenant ids out of the prompt and redacts sensitive-looking text', () => {
    const prompt = buildVatTaxTreatmentAiPrompt([displayRow({
      counterparty: '010-1234-5678',
      description: '901231-1234567 / 1002345678901 / staff@example.com',
    })])

    expect(prompt).not.toContain('tenant-secret')
    expect(prompt).not.toContain('client-secret')
    expect(prompt).not.toContain('010-1234-5678')
    expect(prompt).not.toContain('901231-1234567')
    expect(prompt).not.toContain('1002345678901')
    expect(prompt).not.toContain('staff@example.com')
    expect(prompt).toContain('[마스킹됨]')
  })

  it('redacts sensitive-looking text returned by the provider before display', async () => {
    const runner = vi.fn<VatTaxTreatmentAiRunner>(async () => ({
      ok: true,
      modelName: 'test-model',
      data: {
        candidates: [{
          index: 0,
          recommendation: 'needs_review',
          confidence: 'low',
          basisLabel: '담당자 010-1234-5678에게 확인하세요.',
          missingFacts: ['staff@example.com 확인'],
          hometaxAction: 'review_deduction',
        }],
      },
    }))

    const result = await enhanceVatTaxTreatmentRowsWithSingleAi({
      rows: [displayRow()],
      provider: 'openai',
      runner,
    })

    expect(result[0].basisLabel).toBe('담당자 [마스킹됨]에게 확인하세요.')
    expect(result[0].missingFacts).toEqual(['[마스킹됨] 확인'])
  })

  it('falls back to manual review on timeout without changing the base conclusion', async () => {
    const runner = vi.fn<VatTaxTreatmentAiRunner>(() => new Promise(() => {}))
    const result = await enhanceVatTaxTreatmentRowsWithSingleAi({
      rows: [displayRow()],
      provider: 'openai',
      runner,
      timeoutMs: 5,
    })

    expect(result[0]).toMatchObject({
      recommendation: 'needs_review',
      source: 'deterministic_rule',
      aiTrace: null,
      aiRuntimeStatus: 'manual_fallback',
    })
  })

  it('falls back to manual review on provider or quota failure', async () => {
    const runner = vi.fn<VatTaxTreatmentAiRunner>(async () => ({
      ok: false,
      error: 'quota exceeded',
    }))
    const result = await enhanceVatTaxTreatmentRowsWithSingleAi({
      rows: [displayRow()],
      provider: 'openai',
      runner,
    })

    expect(result[0]).toMatchObject({
      recommendation: 'needs_review',
      aiRuntimeStatus: 'manual_fallback',
      aiTrace: null,
    })
  })

  it('rejects malformed or duplicate structured candidates', () => {
    expect(vatTaxTreatmentAiBatchOutputSchema.safeParse({
      candidates: [{
        index: 0,
        recommendation: 'likely_deductible',
        confidence: 'high',
        basisLabel: '과도한 확신',
        missingFacts: [],
        hometaxAction: 'expected_no_change',
      }],
    }).success).toBe(false)

    const candidate = {
      index: 0,
      recommendation: 'needs_review',
      confidence: 'low',
      basisLabel: '추가 확인 필요',
      missingFacts: [],
      hometaxAction: 'compare_in_hometax',
    }
    expect(vatTaxTreatmentAiBatchOutputSchema.safeParse({
      candidates: [candidate, candidate],
    }).success).toBe(false)
  })

  it('falls back only the row whose AI result is missing or direction-incompatible', async () => {
    const rows = [
      displayRow({ rowId: 'row-1', classificationRowId: 'row-1' }),
      displayRow({ rowId: 'row-2', classificationRowId: 'row-2' }),
    ]
    const runner = vi.fn<VatTaxTreatmentAiRunner>(async () => ({
      ok: true,
      modelName: 'test-model',
      data: {
        candidates: [{
          index: 0,
          recommendation: 'likely_taxable',
          confidence: 'medium',
          basisLabel: '매출 판단',
          missingFacts: [],
          hometaxAction: 'review_sales_tax_type',
        }],
      },
    }))

    const result = await enhanceVatTaxTreatmentRowsWithSingleAi({
      rows,
      provider: 'openai',
      runner,
    })

    expect(result.map((row) => row.aiRuntimeStatus)).toEqual(['manual_fallback', 'manual_fallback'])
  })

  it('limits one request to twelve rows and leaves the remainder for manual review', async () => {
    const rows = Array.from({ length: 13 }, (_, index) => displayRow({
      rowId: `row-${index}`,
      classificationRowId: `row-${index}`,
    }))
    const runner = vi.fn<VatTaxTreatmentAiRunner>(async () => ({
      ok: true,
      modelName: 'test-model',
      data: {
        candidates: rows.slice(0, 12).map((_, index) => ({
          index,
          recommendation: 'needs_review' as const,
          confidence: 'low' as const,
          basisLabel: '추가 확인 필요',
          missingFacts: ['업무 목적'],
          hometaxAction: 'review_deduction' as const,
        })),
      },
    }))

    const result = await enhanceVatTaxTreatmentRowsWithSingleAi({
      rows,
      provider: 'openai',
      runner,
    })

    expect(result.slice(0, 12).every((row) => row.aiRuntimeStatus === 'completed')).toBe(true)
    expect(result[12].aiRuntimeStatus).toBe('deferred')
  })

  it('uses the first configured provider in the existing provider order', () => {
    vi.stubEnv('GEMINI_ENABLED', 'true')
    expect(resolveConfiguredVatTaxTreatmentProvider({
      GOOGLE_AI_API_KEY: 'gemini-key',
      OPENAI_API_KEY: 'openai-key',
      ANTHROPIC_API_KEY: 'claude-key',
    })).toBe('gemini')

    vi.stubEnv('GEMINI_ENABLED', 'false')
    expect(resolveConfiguredVatTaxTreatmentProvider({
      OPENAI_API_KEY: 'openai-key',
      ANTHROPIC_API_KEY: 'claude-key',
    })).toBe('openai')
    vi.unstubAllEnvs()
  })
})
