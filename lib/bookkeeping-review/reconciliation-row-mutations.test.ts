import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmReconciliationRowAccount, saveReconciliationRowExplanation } from './reconciliation-row-mutations'

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

describe('saveReconciliationRowExplanation', () => {
  it('PATCHes the classification row endpoint with staffMemo only, leaving status untouched', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await saveReconciliationRowExplanation({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      memo: '해외 SaaS 협업 도구 구독료, 개발팀 업무용',
    })

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sessions/session-1/account-classification/rows/row-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffMemo: '해외 SaaS 협업 도구 구독료, 개발팀 업무용' }),
      },
    )
  })

  it('returns the server error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: '메모가 너무 깁니다.' }),
    }))

    const result = await saveReconciliationRowExplanation({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      memo: '메모',
    })

    expect(result).toEqual({ ok: false, message: '메모가 너무 깁니다.' })
  })
})
