import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyUploadClientTokenAvailable } from './client-token-preflight'

describe('verifyUploadClientTokenAvailable', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes when the upload route can issue a client token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ clientToken: 'token' })))

    await expect(verifyUploadClientTokenAvailable({
      handleUploadUrl: '/api/upload',
      pathname: 'uploads/file.xlsx',
      clientPayload: '{"rawToken":"token"}',
    })).resolves.toBeUndefined()
  })

  it('surfaces the upload route response body when token generation fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('유효하지 않거나 만료된 세션입니다', {
      status: 400,
    }))

    await expect(verifyUploadClientTokenAvailable({
      handleUploadUrl: '/api/upload',
      pathname: 'uploads/file.xlsx',
      clientPayload: '{"rawToken":"token"}',
    })).rejects.toThrow('유효하지 않거나 만료된 세션입니다')
  })
})
