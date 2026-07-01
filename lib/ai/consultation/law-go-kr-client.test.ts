import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchLawContent,
  LawGoKrApiError,
  LawGoKrRateLimitError,
  LawGoKrTimeoutError,
  resetRateLimitStoreForTests,
  searchLaws,
} from './law-go-kr-client'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_RESPONSE = {
  LawSearch: {
    law: [
      {
        현행연혁코드: '현행',
        법령일련번호: '253527',
        법령명한글: '개인정보 보호법',
        법령구분명: '법률',
        소관부처명: '개인정보보호위원회',
        공포번호: '19592',
        시행일자: '20230808',
        공포일자: '20230808',
        법령ID: '010719',
        법령상세링크: '/DRF/lawService.do?OC=testoc&target=law&MST=010719&type=HTML',
        제개정구분명: '타법개정',
        소관부처코드: '1371000',
        자법타법여부: '',
        공동부령정보: '',
        법령약칭명: '개인정보법',
        id: '1',
      },
    ],
    resultMsg: 'success',
    resultCode: '00',
    totalCnt: '5588',
    page: '1',
    numOfRows: '20',
    target: 'law',
    키워드: '*',
  },
}

const EMPTY_RESPONSE = {
  LawSearch: {
    law: [],
    resultMsg: 'success',
    resultCode: '00',
    totalCnt: '0',
    page: '1',
    numOfRows: '20',
    target: 'law',
  },
}

const EMPTY_RESPONSE_WITHOUT_LAW = {
  LawSearch: {
    resultMsg: 'success',
    resultCode: '00',
    totalCnt: '0',
    page: '1',
    numOfRows: '20',
    target: 'law',
  },
}

const ERROR_RESPONSE = {
  LawSearch: {
    law: [],
    resultMsg: 'API error',
    resultCode: '99',
    totalCnt: '0',
    page: '1',
    numOfRows: '20',
    target: 'law',
  },
}

// ---------------------------------------------------------------------------
// Setup — inject LAW_OPEN_API_OC env for all tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubEnv('LAW_OPEN_API_OC', 'testoc')
  resetRateLimitStoreForTests()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  resetRateLimitStoreForTests()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('searchLaws', () => {
  it('uses LAW_OPEN_API_OC env (not a hardcoded OC) in the request URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => VALID_RESPONSE,
    })
    vi.stubGlobal('fetch', fetchMock)

    await searchLaws({ tenantId: 'tenant-a' })

    const calledUrl: string = fetchMock.mock.calls[0][0]
    expect(calledUrl).toContain('OC=testoc')
    expect(calledUrl).not.toContain('OC=daumkakao12')
  })

  it('throws when LAW_OPEN_API_OC is missing', async () => {
    vi.unstubAllEnvs()
    delete process.env.LAW_OPEN_API_OC

    await expect(searchLaws({ tenantId: 'tenant-a' })).rejects.toThrow(
      'Law Open API env validation failed',
    )
  })

  it('includes query parameter in the request URL when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => VALID_RESPONSE,
    })
    vi.stubGlobal('fetch', fetchMock)

    await searchLaws({ tenantId: 'tenant-a', query: '개인소득세' })

    const calledUrl: string = fetchMock.mock.calls[0][0]
    expect(calledUrl).toContain('query=%EA%B0%9C%EC%9D%B8%EC%86%8C%EB%93%9D%EC%84%B8')
  })

  it('omits query parameter from URL when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => VALID_RESPONSE,
    })
    vi.stubGlobal('fetch', fetchMock)

    await searchLaws({ tenantId: 'tenant-a' })

    const calledUrl: string = fetchMock.mock.calls[0][0]
    expect(calledUrl).not.toContain('query=')
  })

  it('returns normalized sources on successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => VALID_RESPONSE,
    }))

    const result = await searchLaws({ tenantId: 'tenant-a' })

    expect(result.sources).toHaveLength(1)
    expect(result.totalCount).toBe(5588)

    const source = result.sources[0]
    expect(source.sourceId).toBe('law.go.kr/010719')
    expect(source.title).toBe('개인정보 보호법')
    expect(source.shortName).toBe('개인정보법')
    expect(source.sourceType).toBe('statute')
    expect(source.authorityLevel).toBe('official_law')
    expect(source.status).toBe('active')
    expect(source.freshness).toBe('fresh')
    expect(source.url).toContain('https://www.law.go.kr')
    expect(source.publishedAt).toBe('2023-08-08T00:00:00.000Z')
    expect(source.effectiveAt).toBe('2023-08-08T00:00:00.000Z')
  })

  it('returns empty sources array when no results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => EMPTY_RESPONSE,
    }))

    const result = await searchLaws({ tenantId: 'tenant-a' })

    expect(result.sources).toHaveLength(0)
    expect(result.totalCount).toBe(0)
  })

  it('returns empty sources array when law.go.kr omits law on no results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => EMPTY_RESPONSE_WITHOUT_LAW,
    }))

    const result = await searchLaws({ tenantId: 'tenant-a' })

    expect(result.sources).toHaveLength(0)
    expect(result.totalCount).toBe(0)
  })

  it('throws LawGoKrApiError on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }))

    await expect(searchLaws({ tenantId: 'tenant-a' })).rejects.toThrow(LawGoKrApiError)
  })

  it('throws LawGoKrApiError when API resultCode is not 00', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ERROR_RESPONSE,
    }))

    await expect(searchLaws({ tenantId: 'tenant-a' })).rejects.toThrow(LawGoKrApiError)
  })

  it('throws LawGoKrApiError when response schema is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: 'shape' }),
    }))

    await expect(searchLaws({ tenantId: 'tenant-a' })).rejects.toThrow(LawGoKrApiError)
  })

  it('throws LawGoKrTimeoutError when fetch is aborted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    ))

    await expect(searchLaws({ tenantId: 'tenant-a' })).rejects.toThrow(LawGoKrTimeoutError)
  })

  it('throws LawGoKrRateLimitError when rate limit is exceeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => VALID_RESPONSE,
    }))

    for (let i = 0; i < 20; i++) {
      await searchLaws({ tenantId: 'tenant-rl' })
    }

    await expect(searchLaws({ tenantId: 'tenant-rl' })).rejects.toThrow(LawGoKrRateLimitError)
  })

  it('tracks rate limits separately per tenant', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => VALID_RESPONSE,
    }))

    for (let i = 0; i < 20; i++) {
      await searchLaws({ tenantId: 'tenant-a' })
    }

    await expect(searchLaws({ tenantId: 'tenant-b' })).resolves.toBeDefined()
  })

  it('maps 대통령령 to enforcement_decree sourceType', async () => {
    const decree = {
      ...VALID_RESPONSE.LawSearch.law[0],
      법령구분명: '대통령령',
      법령ID: '999999',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        LawSearch: { ...VALID_RESPONSE.LawSearch, law: [decree] },
      }),
    }))

    const result = await searchLaws({ tenantId: 'tenant-a' })
    expect(result.sources[0].sourceType).toBe('enforcement_decree')
    expect(result.sources[0].authorityLevel).toBe('official_law')
  })

  it('maps 행정규칙 to administrative_rule with official_guidance level', async () => {
    const rule = {
      ...VALID_RESPONSE.LawSearch.law[0],
      법령구분명: '행정규칙',
      법령ID: '888888',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        LawSearch: { ...VALID_RESPONSE.LawSearch, law: [rule] },
      }),
    }))

    const result = await searchLaws({ tenantId: 'tenant-a' })
    expect(result.sources[0].sourceType).toBe('administrative_rule')
    expect(result.sources[0].authorityLevel).toBe('official_guidance')
  })

  it('maps 폐지 현행연혁코드 to abolished status', async () => {
    const abolished = {
      ...VALID_RESPONSE.LawSearch.law[0],
      현행연혁코드: '폐지' as const,
      법령ID: '777777',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        LawSearch: { ...VALID_RESPONSE.LawSearch, law: [abolished] },
      }),
    }))

    const result = await searchLaws({ tenantId: 'tenant-a' })
    expect(result.sources[0].status).toBe('abolished')
  })
})

// ---------------------------------------------------------------------------
// fetchLawContent (lawService.do — 현행법령 본문 조회)
//   NOTE: 아래 fixture는 문서화된 구조 기준 가정이며, 실제 lawService.do 응답으로
//   QA 단계에서 검증/보정한다 (Slice 1과 동일 절차).
// ---------------------------------------------------------------------------

const CONTENT_RESPONSE_ARRAY = {
  법령: {
    조문: {
      조문단위: [
        { 조문번호: '1', 조문제목: '목적', 조문내용: '제1조(목적) 이 법은 ...', 조문여부: '조문' },
        { 조문번호: '52', 조문제목: '부당행위계산의 부인', 조문내용: '제52조(부당행위계산의 부인) ...' },
      ],
    },
  },
}

const CONTENT_RESPONSE_SINGLE = {
  법령: {
    조문: {
      조문단위: { 조문번호: '1', 조문제목: '목적', 조문내용: '제1조(목적) 단일 조문 ...' },
    },
  },
}

describe('fetchLawContent', () => {
  it('uses lawService.do with MST and OC in the request URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => CONTENT_RESPONSE_ARRAY })
    vi.stubGlobal('fetch', fetchMock)

    await fetchLawContent({ tenantId: 'tenant-a', serialNumber: '253527' })

    const calledUrl: string = fetchMock.mock.calls[0][0]
    expect(calledUrl).toContain('lawService.do')
    expect(calledUrl).toContain('MST=253527')
    expect(calledUrl).toContain('OC=testoc')
  })

  it('parses an array of 조문단위 into articles', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => CONTENT_RESPONSE_ARRAY }))

    const articles = await fetchLawContent({ tenantId: 'tenant-a', serialNumber: '253527' })

    expect(articles).toHaveLength(2)
    expect(articles[0]).toEqual({ articleNo: '1', title: '목적', text: '제1조(목적) 이 법은 ...' })
    expect(articles[1].articleNo).toBe('52')
  })

  it('parses a single 조문단위 object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => CONTENT_RESPONSE_SINGLE }))

    const articles = await fetchLawContent({ tenantId: 'tenant-a', serialNumber: '1' })
    expect(articles).toHaveLength(1)
    expect(articles[0].text).toContain('단일 조문')
  })

  it('flattens nested 항/호/목 into the article text', async () => {
    const nested = {
      법령: {
        조문: {
          조문단위: {
            조문번호: '2',
            조문제목: '정의',
            조문내용: '제2조(정의)', // 제목 수준
            조문여부: '조문',
            항: [
              {
                항내용: '① 이 법에서 사용하는 용어의 뜻은 다음과 같다.',
                호: [
                  { 호내용: '1. "거주자"란 ...', 목: [{ 목내용: '가. 세부 목 내용' }] },
                  { 호내용: '2. "비거주자"란 ...' },
                ],
              },
            ],
          },
        },
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => nested }))

    const [article] = await fetchLawContent({ tenantId: 'tenant-a', serialNumber: '2' })
    expect(article.text).toContain('용어의 뜻')
    expect(article.text).toContain('"거주자"란')
    expect(article.text).toContain('"비거주자"란')
    expect(article.text).toContain('세부 목 내용')
  })

  it('excludes structural headings (조문여부 !== "조문")', async () => {
    const withHeading = {
      법령: {
        조문: {
          조문단위: [
            { 조문제목: '제1장 총칙', 조문내용: '제1장 총칙', 조문여부: '전문' },
            { 조문번호: '1', 조문제목: '목적', 조문내용: '제1조(목적) 실제 조문', 조문여부: '조문' },
          ],
        },
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => withHeading }))

    const articles = await fetchLawContent({ tenantId: 'tenant-a', serialNumber: '3' })
    expect(articles).toHaveLength(1)
    expect(articles[0].title).toBe('목적')
  })

  it('throws LawGoKrApiError when no parseable articles (loud fail)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ 법령: {} }) }))

    await expect(
      fetchLawContent({ tenantId: 'tenant-a', serialNumber: '1' }),
    ).rejects.toThrow(LawGoKrApiError)
  })

  it('throws LawGoKrApiError on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    await expect(
      fetchLawContent({ tenantId: 'tenant-a', serialNumber: '1' }),
    ).rejects.toThrow(LawGoKrApiError)
  })

  it('counts against the per-tenant rate limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => CONTENT_RESPONSE_ARRAY }))

    for (let i = 0; i < 20; i++) {
      await fetchLawContent({ tenantId: 'tenant-rl-content', serialNumber: String(i) })
    }

    await expect(
      fetchLawContent({ tenantId: 'tenant-rl-content', serialNumber: 'over' }),
    ).rejects.toThrow(LawGoKrRateLimitError)
  })
})
