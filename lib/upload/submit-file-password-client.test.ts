import { afterEach, describe, expect, it, vi } from 'vitest'
import { submitFilePasswordClient } from './submit-file-password-client'

describe('submitFilePasswordClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('성공 시 ok: true를 반환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'consumed' }),
      }),
    )

    const result = await submitFilePasswordClient({
      fileId: 'file-1',
      password: 'secret',
      mode: 'client',
      rawToken: 'token',
    })

    expect(result).toEqual({ ok: true })
  })

  it('400 invalid 응답을 password_invalid로 매핑한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ status: 'invalid', error: '비밀번호가 올바르지 않습니다' }),
      }),
    )

    const result = await submitFilePasswordClient({
      fileId: 'file-1',
      password: 'wrong',
      mode: 'staff',
    })

    expect(result).toEqual({
      ok: false,
      reason: 'invalid',
      message: '비밀번호가 올바르지 않습니다',
    })
  })

  it('결과 객체에 비밀번호 값이 포함되지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'consumed' }),
      }),
    )

    const secret = 'top-secret-password'
    const result = await submitFilePasswordClient({
      fileId: 'file-1',
      password: secret,
      mode: 'client',
      rawToken: 'token',
    })

    expect(JSON.stringify(result)).not.toContain(secret)
  })
})
