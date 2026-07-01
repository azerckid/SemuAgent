import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateConsultationAnswer, type SourceWithArticles } from './answer'
import { type LawArticle, type NormalizedSource } from './schemas'

const anthropicMocks = vi.hoisted(() => ({
  create: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  requireAnthropicEnv: () => ({ ANTHROPIC_API_KEY: 'test-anthropic-key' }),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function Anthropic() {
    return {
      messages: {
        create: anthropicMocks.create,
      },
    }
  }),
}))

function source(overrides: Partial<NormalizedSource> = {}): NormalizedSource {
  return {
    sourceId: 'law.go.kr/001234',
    sourceType: 'statute',
    title: '소득세법',
    shortName: '소득세법',
    url: 'https://www.law.go.kr/DRF/lawService.do?MST=001234',
    agency: '기획재정부',
    publishedAt: '2023-12-31T00:00:00.000Z',
    effectiveAt: '2024-01-01T00:00:00.000Z',
    status: 'active',
    authorityLevel: 'official_law',
    freshness: 'fresh',
    retrievedAt: '2026-06-18T00:00:00.000Z',
    metadata: { serialNumber: '253527' },
    ...overrides,
  }
}

function article(overrides: Partial<LawArticle> = {}): LawArticle {
  return { articleNo: '52', title: '부당행위계산의 부인', text: '제52조 ...', ...overrides }
}

function withArticles(
  s: NormalizedSource = source(),
  articles: LawArticle[] = [article()],
): SourceWithArticles {
  return { source: s, articles }
}

function mockModelJson(payload: unknown) {
  anthropicMocks.create.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  })
}

beforeEach(() => {
  anthropicMocks.create.mockReset()
})

describe('generateConsultationAnswer', () => {
  it('returns a source-grounded answer with resolved related laws', async () => {
    mockModelJson({
      status: 'answered',
      practicalGuidance: '가중평균차입이자율 또는 국세청장 고시 이자율을 곱해 계산합니다.',
      legalBasis: '법인세법 시행령 제52조에 따른 인정이자 규정입니다.',
      missingInputs: ['가지급금 금액', '차입 이자율 적용 방식'],
      summary: '대표이사 가지급금 인정이자는 ...',
      practicalNote: '적용 전 최신 시행령을 확인하세요.',
      citedSourceIds: ['law.go.kr/001234'],
    })

    const result = await generateConsultationAnswer({
      question: '대표이사 가지급금 인정이자?',
      sources: [withArticles()],
    })

    expect(result.status).toBe('answered')
    expect(result.summary).toContain('인정이자')
    expect(result.practicalGuidance).toContain('가중평균차입이자율')
    expect(result.legalBasis).toContain('시행령 제52조')
    expect(result.missingInputs).toEqual(['가지급금 금액', '차입 이자율 적용 방식'])
    expect(result.relatedLaws).toHaveLength(1)
    expect(result.relatedLaws[0].url).toBe('https://www.law.go.kr/DRF/lawService.do?MST=001234')
    expect(anthropicMocks.create).toHaveBeenCalledTimes(1)
  })

  it('includes the article text in the prompt sent to the model', async () => {
    mockModelJson({
      status: 'answered',
      practicalGuidance: 'g',
      legalBasis: 'l',
      missingInputs: [],
      summary: 's',
      practicalNote: 'p',
      citedSourceIds: ['law.go.kr/001234'],
    })

    await generateConsultationAnswer({
      question: 'q',
      sources: [withArticles(source(), [article({ text: '제52조(부당행위계산의 부인) 본문 텍스트 XYZ' })])],
    })

    const sentPrompt: string = anthropicMocks.create.mock.calls[0][0].messages[0].content
    expect(sentPrompt).toContain('본문 텍스트 XYZ')
  })

  it('short-circuits without calling the model when no source has article text', async () => {
    const result = await generateConsultationAnswer({
      question: '아무 질문',
      sources: [withArticles(source(), [])], // 본문 없음
    })

    expect(result.status).toBe('no_relevant_source')
    expect(result.relatedLaws).toHaveLength(0)
    expect(anthropicMocks.create).not.toHaveBeenCalled()
  })

  it('short-circuits when the sources list is empty', async () => {
    const result = await generateConsultationAnswer({ question: 'q', sources: [] })
    expect(result.status).toBe('no_relevant_source')
    expect(anthropicMocks.create).not.toHaveBeenCalled()
  })

  it('drops cited sourceIds that are not in the provided sources (anti-hallucination)', async () => {
    mockModelJson({
      status: 'answered',
      practicalGuidance: '',
      legalBasis: '',
      missingInputs: [],
      summary: '...',
      practicalNote: '...',
      citedSourceIds: ['law.go.kr/001234', 'law.go.kr/FAKE-9999'],
    })

    const result = await generateConsultationAnswer({ question: 'q', sources: [withArticles()] })

    expect(result.relatedLaws.map((s) => s.sourceId)).toEqual(['law.go.kr/001234'])
  })

  it('downgrades answered to needs_expert when no cited source resolves', async () => {
    mockModelJson({
      status: 'answered',
      practicalGuidance: '일반 계산 방법 안내',
      legalBasis: '근거 없이 주장된 법령 내용',
      missingInputs: ['필요 입력값'],
      summary: '근거 없이 생성된 답',
      practicalNote: '',
      citedSourceIds: ['law.go.kr/FAKE-9999'],
    })

    const result = await generateConsultationAnswer({ question: 'q', sources: [withArticles()] })

    expect(result.status).toBe('needs_expert')
    expect(result.relatedLaws).toHaveLength(0)
    expect(result.practicalNote).toContain('전문가')
    // legalBasis는 근거가 해소되지 않아 비워지지만, practicalGuidance/missingInputs는 유지된다.
    expect(result.legalBasis).toBe('')
    expect(result.practicalGuidance).toBe('일반 계산 방법 안내')
    expect(result.missingInputs).toEqual(['필요 입력값'])
  })

  it('passes through needs_expert for customer-specific questions (no related laws)', async () => {
    mockModelJson({
      status: 'needs_expert',
      practicalGuidance: '',
      legalBasis: '',
      missingInputs: ['퇴직금 지급 규정', '근속연수'],
      summary: '특정 고객사의 신고 판단은 전문가 확인이 필요합니다.',
      practicalNote: '담당 세무사에게 문의하세요.',
      citedSourceIds: ['law.go.kr/001234'],
    })

    const result = await generateConsultationAnswer({
      question: 'A회사 김철수 직원 퇴직금 얼마 신고?',
      sources: [withArticles()],
    })

    expect(result.status).toBe('needs_expert')
    // P2: 비-answered 상태에는 relatedLaws를 붙이지 않는다.
    expect(result.relatedLaws).toHaveLength(0)
    expect(result.missingInputs).toEqual(['퇴직금 지급 규정', '근속연수'])
  })

  it('does not attach related laws on no_relevant_source even if model cites ids (P2)', async () => {
    mockModelJson({
      status: 'no_relevant_source',
      practicalGuidance: '',
      legalBasis: '',
      missingInputs: [],
      summary: '관련 조문이 아닙니다.',
      practicalNote: '',
      citedSourceIds: ['law.go.kr/001234'],
    })

    const result = await generateConsultationAnswer({ question: 'q', sources: [withArticles()] })

    expect(result.status).toBe('no_relevant_source')
    expect(result.relatedLaws).toHaveLength(0)
  })

  it('caps the number of articles sent to the model and flags truncation', async () => {
    mockModelJson({
      status: 'answered',
      practicalGuidance: 'g',
      legalBasis: 'l',
      missingInputs: [],
      summary: 's',
      practicalNote: 'p',
      citedSourceIds: ['law.go.kr/001234'],
    })

    // 20개 조문 → cap(12) 초과
    const manyArticles = Array.from({ length: 20 }, (_, i) =>
      article({ articleNo: String(i + 1), title: `조문${i + 1}`, text: `내용 ${i + 1}` }),
    )

    const result = await generateConsultationAnswer({
      question: '가지급금 인정이자',
      sources: [withArticles(source(), manyArticles)],
    })

    const sentPrompt: string = anthropicMocks.create.mock.calls[0][0].messages[0].content
    const articleHeadingCount = (sentPrompt.match(/제\d+조/g) ?? []).length
    expect(articleHeadingCount).toBeLessThanOrEqual(12)
    expect(result.practicalNote).toContain('일부만 검토')
  })

  it('keeps a rare-keyword article over common-keyword ones when the cap forces a choice (IDF)', async () => {
    mockModelJson({
      status: 'answered',
      practicalGuidance: 'g',
      legalBasis: 'l',
      missingInputs: [],
      summary: 's',
      practicalNote: 'p',
      citedSourceIds: ['law.go.kr/001234'],
    })

    // 흔한 용어(세금계산서)를 가진 13개 + 희귀 용어(가산세) 1개 = 14개 (cap 12 초과)
    const common = Array.from({ length: 13 }, (_, i) =>
      article({ articleNo: String(i + 1), title: `세금계산서 조문${i}`, text: `세금계산서 발급 관련 ${i}` }),
    )
    const rare = article({ articleNo: '60', title: '가산세', text: '세금계산서 지연발급 가산세는 공급가액의 1퍼센트' })

    await generateConsultationAnswer({
      question: '세금계산서 지연발급 가산세',
      sources: [withArticles(source(), [...common, rare])],
      keywords: ['세금계산서', '가산세', '지연발급'],
    })

    const sentPrompt: string = anthropicMocks.create.mock.calls[0][0].messages[0].content
    // 희귀어(가산세) 조문이 흔한어 조문에 밀리지 않고 선택되어야 한다.
    expect(sentPrompt).toContain('지연발급 가산세는 공급가액의 1퍼센트')
  })

  it('throws when model output is not valid JSON', async () => {
    anthropicMocks.create.mockResolvedValue({ content: [{ type: 'text', text: 'no json here' }] })

    await expect(
      generateConsultationAnswer({ question: 'q', sources: [withArticles()] }),
    ).rejects.toThrow('JSON not found')
  })

  it('throws when model output fails schema validation', async () => {
    mockModelJson({ status: 'answered', summary: '...' }) // missing fields

    await expect(
      generateConsultationAnswer({ question: 'q', sources: [withArticles()] }),
    ).rejects.toThrow('validation failed')
  })
})
