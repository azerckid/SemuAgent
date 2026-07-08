import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmReconciliationRowAccount } from './reconciliation-row-mutations'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('confirmReconciliationRowAccount', () => {
  it('PATCHes the classification row endpoint with finalAccount and confirmed status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await confirmReconciliationRowAccount({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      accountKey: 'employee_welfare',
    })

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sessions/session-1/account-classification/rows/row-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalAccount: 'employee_welfare', status: 'confirmed' }),
      },
    )
  })

  it('returns the server error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: '권한이 없습니다.' }),
    }))

    const result = await confirmReconciliationRowAccount({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      accountKey: 'employee_welfare',
    })

    expect(result).toEqual({ ok: false, message: '권한이 없습니다.' })
  })

  it('falls back to a generic message when the server response has no error field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => null,
    }))

    const result = await confirmReconciliationRowAccount({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      accountKey: 'employee_welfare',
    })

    expect(result).toEqual({ ok: false, message: '계정항목 확정에 실패했습니다.' })
  })
})
