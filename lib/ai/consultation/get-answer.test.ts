import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type NormalizedSource } from './schemas'

const mocks = vi.hoisted(() => ({
  planLawQueries: vi.fn(),
  getConsultationSources: vi.fn(),
  fetchLawContent: vi.fn(),
  generateConsultationAnswer: vi.fn(),
}))

vi.mock('./plan-query', () => ({ planLawQueries: mocks.planLawQueries }))
vi.mock('./get-sources', () => ({ getConsultationSources: mocks.getConsultationSources }))
vi.mock('./answer', () => ({ generateConsultationAnswer: mocks.generateConsultationAnswer }))
vi.mock('./law-go-kr-client', async (importActual) => {
  const actual = await importActual<typeof import('./law-go-kr-client')>()
  return { ...actual, fetchLawContent: mocks.fetchLawContent }
})

const { getConsultationAnswer } = await import('./get-answer')
const { LawGoKrApiError, LawGoKrRateLimitError } = await import('./law-go-kr-client')
const { STANDING_DISCLAIMER } = await import('./disclaimer')

function source(id: string, serialNumber: string | null = '253527'): NormalizedSource {
  return {
    sourceId: `law.go.kr/${id}`,
    sourceType: 'statute',
    title: `법령 ${id}`,
    shortName: null,
    url: `https://www.law.go.kr/${id}`,
    agency: '기획재정부',
    publishedAt: '2023-12-31T00:00:00.000Z',
    effectiveAt: '2024-01-01T00:00:00.000Z',
    status: 'active',
    authorityLevel: 'official_law',
    freshness: 'fresh',
    retrievedAt: '2026-06-18T00:00:00.000Z',
    metadata: serialNumber === null ? {} : { serialNumber },
  }
}

beforeEach(() => {
  mocks.planLawQueries.mockReset()
  mocks.getConsultationSources.mockReset()
  mocks.fetchLawContent.mockReset()
  mocks.generateConsultationAnswer.mockReset()
  mocks.planLawQueries.mockResolvedValue({ lawNames: ['법인세법'], keywords: ['법인세'] })
  mocks.generateConsultationAnswer.mockResolvedValue({
    status: 'answered',
    summary: 's',
    practicalNote: 'p',
    relatedLaws: [],
  })
})

describe('getConsultationAnswer', () => {
  it('searches, fetches content for the top laws, and attaches the disclaimer', async () => {
    mocks.getConsultationSources.mockResolvedValue({ sources: [source('1')], totalCount: 1, fromCache: false })
    mocks.fetchLawContent.mockResolvedValue([{ articleNo: '1', title: '목적', text: '본문' }])

    const result = await getConsultationAnswer({ tenantId: 't', question: 'q' })

    expect(mocks.fetchLawContent).toHaveBeenCalledWith({ tenantId: 't', serialNumber: '253527' })
    const answerArg = mocks.generateConsultationAnswer.mock.calls[0][0]
    expect(answerArg.sources).toHaveLength(1)
    expect(answerArg.sources[0].articles[0].text).toBe('본문')
    expect(result.disclaimer).toBe(STANDING_DISCLAIMER)
    expect(result.status).toBe('answered')
  })

  it('limits content fetches to maxLaws', async () => {
    mocks.getConsultationSources.mockResolvedValue({
      sources: [source('1'), source('2'), source('3'), source('4'), source('5')],
      totalCount: 5,
      fromCache: false,
    })
    mocks.fetchLawContent.mockResolvedValue([{ articleNo: '1', title: null, text: '본문' }])

    await getConsultationAnswer({ tenantId: 't', question: 'q' }) // default 3

    expect(mocks.fetchLawContent).toHaveBeenCalledTimes(3)
  })

  it('skips laws without a serialNumber', async () => {
    mocks.getConsultationSources.mockResolvedValue({
      sources: [source('1', null), source('2', '999')],
      totalCount: 2,
      fromCache: false,
    })
    mocks.fetchLawContent.mockResolvedValue([{ articleNo: '1', title: null, text: '본문' }])

    await getConsultationAnswer({ tenantId: 't', question: 'q' })

    expect(mocks.fetchLawContent).toHaveBeenCalledTimes(1)
    expect(mocks.fetchLawContent).toHaveBeenCalledWith({ tenantId: 't', serialNumber: '999' })
  })

  it('skips a law whose content fails to parse, keeps the others', async () => {
    mocks.getConsultationSources.mockResolvedValue({
      sources: [source('1', '111'), source('2', '222')],
      totalCount: 2,
      fromCache: false,
    })
    mocks.fetchLawContent
      .mockRejectedValueOnce(new LawGoKrApiError('no articles'))
      .mockResolvedValueOnce([{ articleNo: '1', title: null, text: '본문2' }])

    await getConsultationAnswer({ tenantId: 't', question: 'q' })

    const answerArg = mocks.generateConsultationAnswer.mock.calls[0][0]
    expect(answerArg.sources).toHaveLength(1)
    expect(answerArg.sources[0].source.sourceId).toBe('law.go.kr/2')
  })

  it('returns no_relevant_source without searching when the planner finds no law', async () => {
    mocks.planLawQueries.mockResolvedValue({ lawNames: [], keywords: [] })
    mocks.generateConsultationAnswer.mockResolvedValue({
      status: 'no_relevant_source',
      summary: '관련 법령 조문을 찾지 못했습니다.',
      practicalNote: '',
      relatedLaws: [],
    })

    const result = await getConsultationAnswer({ tenantId: 't', question: '오늘 점심 뭐 먹지' })

    expect(mocks.getConsultationSources).not.toHaveBeenCalled()
    expect(mocks.fetchLawContent).not.toHaveBeenCalled()
    expect(result.status).toBe('no_relevant_source')
    // 답변 서비스는 빈 sources로 호출된다.
    expect(mocks.generateConsultationAnswer.mock.calls[0][0].sources).toEqual([])
  })

  it('searches each planned law name and de-duplicates sources by sourceId', async () => {
    mocks.planLawQueries.mockResolvedValue({ lawNames: ['법인세법', '법인세법 시행령'], keywords: [] })
    // 두 검색이 일부 동일 sourceId를 반환
    mocks.getConsultationSources
      .mockResolvedValueOnce({ sources: [source('1', '111')], totalCount: 1, fromCache: false })
      .mockResolvedValueOnce({
        sources: [source('1', '111'), source('2', '222')],
        totalCount: 2,
        fromCache: false,
      })
    mocks.fetchLawContent.mockResolvedValue([{ articleNo: '1', title: null, text: '본문' }])

    await getConsultationAnswer({ tenantId: 't', question: '법인세 관련' })

    expect(mocks.getConsultationSources).toHaveBeenCalledTimes(2)
    // law.go.kr/1 중복 제거 → 2개 법령만 본문 조회
    expect(mocks.fetchLawContent).toHaveBeenCalledTimes(2)
  })

  it('propagates rate-limit errors', async () => {
    mocks.getConsultationSources.mockResolvedValue({ sources: [source('1')], totalCount: 1, fromCache: false })
    mocks.fetchLawContent.mockRejectedValue(new LawGoKrRateLimitError())

    await expect(getConsultationAnswer({ tenantId: 't', question: 'q' })).rejects.toThrow(LawGoKrRateLimitError)
  })
})
