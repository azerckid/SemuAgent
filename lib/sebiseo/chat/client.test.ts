import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestSebiseoChat } from './client'

describe('requestSebiseoChat', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts only the bounded chat contract and parses the response', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      status: 'answered',
      answer: '자료수집 화면에서 첨부하세요.',
      suggestedActions: [],
    })))
    vi.stubGlobal('fetch', fetchMock)

    const response = await requestSebiseoChat({
      message: '파일은 어디서 올려요?',
      history: [],
      routePath: '/dashboard/sebiseo',
      clientRequestId: 'b40d60f4-3a78-4df2-a195-2f0c6a9ca62e',
    })

    expect(response.status).toBe('answered')
    expect(fetchMock).toHaveBeenCalledWith('/api/sebiseo/chat', expect.objectContaining({ method: 'POST' }))
  })
})
