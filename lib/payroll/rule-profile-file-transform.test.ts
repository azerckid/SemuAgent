import { describe, expect, it, vi } from 'vitest'
import { ruleTransformResponseSchema } from './rule-profile-nl-transform'
import { transformPayrollRuleFileToDraft } from './rule-profile-file-transform'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
}))

vi.mock('@/lib/ai/extract', () => ({
  extractDocumentTextChunks: vi.fn(),
}))

import { db } from '@/lib/db'
import { get } from '@vercel/blob'
import { extractDocumentTextChunks } from '@/lib/ai/extract'

function okAi(rules: unknown[]) {
  const data = ruleTransformResponseSchema.parse({ rules, notes: [] })
  return vi.fn(async () => ({ success: true as const, data, model: 'mock' }))
}

function mockDocument(contentType: string) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{
      id: 'doc-1',
      contentType,
      contentHash: 'hash-1',
      originalFilename: 'rules.txt',
      storageKey: 'blob://rules',
    }]),
  }
  vi.mocked(db.select).mockReturnValue(selectChain as never)
}

describe('transformPayrollRuleFileToDraft', () => {
  it('문서를 찾지 못하면 failed', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    vi.mocked(db.select).mockReturnValue(selectChain as never)

    const result = await transformPayrollRuleFileToDraft({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      sourceFileId: 'missing',
      expectedSourceType: 'rule_document',
      effectiveFrom: '2026-06',
    })
    expect(result).toEqual({ status: 'failed', error: '급여 규칙 파일을 찾을 수 없습니다' })
  })

  it('민감정보가 있으면 tee로 차단한다', async () => {
    mockDocument('text/plain')
    vi.mocked(get).mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('직원 871010-1234567 식대'))
          controller.close()
        },
      }),
    } as never)
    vi.mocked(extractDocumentTextChunks).mockResolvedValue([{ text: '직원 871010-1234567 식대', summary: 'ok' }])
    const callAi = okAi([])

    const result = await transformPayrollRuleFileToDraft({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      sourceFileId: 'doc-1',
      expectedSourceType: 'rule_document',
      effectiveFrom: '2026-06',
    }, callAi)

    expect(result.status).toBe('blocked_tee')
    expect(callAi).not.toHaveBeenCalled()
  })

  it('txt 규칙 파일을 draft로 구조화한다', async () => {
    mockDocument('text/plain')
    vi.mocked(get).mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('식대는 월 20만원 비과세'))
          controller.close()
        },
      }),
    } as never)
    vi.mocked(extractDocumentTextChunks).mockResolvedValue([{ text: '식대는 월 20만원 비과세', summary: 'ok' }])

    const result = await transformPayrollRuleFileToDraft({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      sourceFileId: 'doc-1',
      expectedSourceType: 'rule_document',
      effectiveFrom: '2026-06',
    }, okAi([
      { displayName: '식대', category: 'allowance', targetField: '식대(퇴)', formulaKind: 'fixed_amount', taxableTreatment: 'non_taxable', nonTaxableLimit: 200000, requiredInputs: [], sourceQuote: '식대 20만 비과세' },
    ]))

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.profile.sourcePriority).toEqual(['rule_document', 'statutory_default'])
    expect(result.profile.allowanceRules[0].targetField).toBe('meal_allowance')
    expect(result.sourceSummary.sources[0].sourceFileId).toBe('doc-1')
    expect(result.sourceHash).toBe('hash-1')
  })

  it('요청 sourceType과 파일 MIME이 다르면 failed', async () => {
    mockDocument('text/plain')
    const result = await transformPayrollRuleFileToDraft({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      sourceFileId: 'doc-1',
      expectedSourceType: 'excel_embedded',
      effectiveFrom: '2026-06',
    })
    expect(result).toEqual({ status: 'failed', error: '파일 형식과 요청 유형이 일치하지 않습니다' })
  })
})
