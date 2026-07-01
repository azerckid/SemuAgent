import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  getConsultationAnswer: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireTenantSession: mocks.requireTenantSession }))
vi.mock('@/lib/ai/consultation/get-answer', () => ({ getConsultationAnswer: mocks.getConsultationAnswer }))

const { POST } = await import('./route')
const { LawGoKrApiError, LawGoKrRateLimitError, LawGoKrTimeoutError } = await import(
  '@/lib/ai/consultation/law-go-kr-client'
)

function postRequest(body: unknown) {
  return new Request('http://localhost/api/ai/consultation/answer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.getConsultationAnswer.mockReset()
  mocks.requireTenantSession.mockResolvedValue({ tenantId: 'tenant-1' })
})

describe('POST /api/ai/consultation/answer', () => {
  it('returns the grounded answer with related laws and disclaimer', async () => {
    mocks.getConsultationAnswer.mockResolvedValue({
      status: 'answered',
      practicalGuidance: '일반 실무 안내',
      legalBasis: '법령 근거',
      missingInputs: ['필요 입력값'],
      summary: '요약',
      practicalNote: '주의',
      relatedLaws: [
        {
          sourceId: 'law.go.kr/1',
          title: '소득세법',
          url: 'https://www.law.go.kr/1',
          sourceType: 'statute',
          // 추가 필드는 라우트에서 잘려나가야 한다
          agency: '기획재정부',
        },
      ],
      disclaimer: '면책',
    })

    const res = await POST(postRequest({ question: '가지급금 인정이자' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('answered')
    expect(json.practicalGuidance).toBe('일반 실무 안내')
    expect(json.legalBasis).toBe('법령 근거')
    expect(json.missingInputs).toEqual(['필요 입력값'])
    expect(json.relatedLaws).toEqual([
      { sourceId: 'law.go.kr/1', title: '소득세법', url: 'https://www.law.go.kr/1', sourceType: 'statute' },
    ])
    expect(json.disclaimer).toBe('면책')
    expect(json.retrievedAt).toBeTruthy()
  })

  it('returns 400 on invalid JSON body', async () => {
    const res = await POST(postRequest('{not json'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when question is missing (Zod boundary)', async () => {
    const res = await POST(postRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthorized', async () => {
    mocks.requireTenantSession.mockRejectedValue(new Error('Unauthorized'))
    const res = await POST(postRequest({ question: 'q' }))
    expect(res.status).toBe(401)
  })

  it('maps rate-limit to 429', async () => {
    mocks.getConsultationAnswer.mockRejectedValue(new LawGoKrRateLimitError())
    const res = await POST(postRequest({ question: 'q' }))
    const json = await res.json()
    expect(res.status).toBe(429)
    expect(json.error).toBe('rate_limited')
  })

  it('maps timeout to 503', async () => {
    mocks.getConsultationAnswer.mockRejectedValue(new LawGoKrTimeoutError())
    const res = await POST(postRequest({ question: 'q' }))
    expect(res.status).toBe(503)
  })

  it('maps api error to 502', async () => {
    mocks.getConsultationAnswer.mockRejectedValue(new LawGoKrApiError('boom'))
    const res = await POST(postRequest({ question: 'q' }))
    expect(res.status).toBe(502)
  })

  it('maps unexpected error to 500', async () => {
    mocks.getConsultationAnswer.mockRejectedValue(new Error('unexpected'))
    const res = await POST(postRequest({ question: 'q' }))
    expect(res.status).toBe(500)
  })
})
