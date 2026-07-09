import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  confirmReconciliationRowAccount,
  connectReconciliationRowEvidence,
  disconnectReconciliationRowEvidence,
  revertReconciliationRowState,
  saveReconciliationRowExclusion,
  saveReconciliationRowExplanation,
} from './reconciliation-row-mutations'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('confirmReconciliationRowAccount', () => {
  it('PATCHes the classification row endpoint with finalAccount and confirmed status', async () => {
    const previous = { finalAccount: null, staffMemo: null, status: 'suggested' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, previous }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await confirmReconciliationRowAccount({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      accountKey: 'employee_welfare',
    })

    expect(result).toEqual({ ok: true, previous })
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

  it('falls back to a null previous snapshot when the server response has no previous field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))

    const result = await confirmReconciliationRowAccount({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      accountKey: 'employee_welfare',
    })

    expect(result).toEqual({ ok: true, previous: null })
  })
})

describe('saveReconciliationRowExplanation', () => {
  it('PATCHes the classification row endpoint with staffMemo only, leaving status untouched', async () => {
    const previous = { finalAccount: null, staffMemo: null, status: 'suggested' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, previous }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await saveReconciliationRowExplanation({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      memo: '해외 SaaS 협업 도구 구독료, 개발팀 업무용',
    })

    expect(result).toEqual({ ok: true, previous })
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

describe('saveReconciliationRowExclusion', () => {
  it('PATCHes the classification row endpoint with status excluded and the memo', async () => {
    const previous = { finalAccount: 'employee_welfare', staffMemo: null, status: 'confirmed' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, previous }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await saveReconciliationRowExclusion({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      memo: '제외 사유: 개인 사용 - 영화 관람',
    })

    expect(result).toEqual({ ok: true, previous })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sessions/session-1/account-classification/rows/row-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'excluded', staffMemo: '제외 사유: 개인 사용 - 영화 관람' }),
      },
    )
  })

  it('returns the server error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: '제외하려면 메모가 필요합니다.' }),
    }))

    const result = await saveReconciliationRowExclusion({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      memo: '',
    })

    expect(result).toEqual({ ok: false, message: '제외하려면 메모가 필요합니다.' })
  })
})

describe('revertReconciliationRowState', () => {
  it('PATCHes the classification row endpoint with the previous snapshot verbatim', async () => {
    const previous = { finalAccount: 'employee_welfare', staffMemo: '기존 메모', status: 'confirmed', linkedEvidenceRowId: 'row-9' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, previous: null }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await revertReconciliationRowState({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      previous,
    })

    expect(result).toEqual({ ok: true, previous: null })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sessions/session-1/account-classification/rows/row-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalAccount: 'employee_welfare',
          staffMemo: '기존 메모',
          status: 'confirmed',
          linkedEvidenceRowId: 'row-9',
        }),
      },
    )
  })

  it('reverts a null finalAccount/staffMemo/linkedEvidenceRowId back to null (undoing a first-time confirm/exclude/connect)', async () => {
    const previous = { finalAccount: null, staffMemo: null, status: 'suggested', linkedEvidenceRowId: null }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, previous: null }) })
    vi.stubGlobal('fetch', fetchMock)

    await revertReconciliationRowState({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      previous,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sessions/session-1/account-classification/rows/row-1',
      expect.objectContaining({
        body: JSON.stringify({ finalAccount: null, staffMemo: null, status: 'suggested', linkedEvidenceRowId: null }),
      }),
    )
  })

  it('returns the server error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: '이미 다른 값으로 변경되었습니다.' }),
    }))

    const result = await revertReconciliationRowState({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      previous: { finalAccount: null, staffMemo: null, status: 'suggested', linkedEvidenceRowId: null },
    })

    expect(result).toEqual({ ok: false, message: '이미 다른 값으로 변경되었습니다.' })
  })
})

describe('connectReconciliationRowEvidence', () => {
  it('PATCHes the classification row endpoint with linkedEvidenceRowId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, previous: { finalAccount: null, staffMemo: null, status: 'suggested', linkedEvidenceRowId: null } }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await connectReconciliationRowEvidence({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      evidenceRowId: 'row-2',
    })

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sessions/session-1/account-classification/rows/row-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedEvidenceRowId: 'row-2' }),
      },
    )
  })

  it('returns the server error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: '세금계산서·현금영수증·카드 거래만 증빙으로 연결할 수 있습니다.' }),
    }))

    const result = await connectReconciliationRowEvidence({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
      evidenceRowId: 'row-2',
    })

    expect(result).toEqual({ ok: false, message: '세금계산서·현금영수증·카드 거래만 증빙으로 연결할 수 있습니다.' })
  })
})

describe('disconnectReconciliationRowEvidence', () => {
  it('PATCHes the classification row endpoint with linkedEvidenceRowId null', async () => {
    const previous = { finalAccount: null, staffMemo: null, status: 'suggested', linkedEvidenceRowId: 'row-2' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, previous }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await disconnectReconciliationRowEvidence({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
    })

    expect(result).toEqual({ ok: true, previous })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sessions/session-1/account-classification/rows/row-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedEvidenceRowId: null }),
      },
    )
  })

  it('returns the server error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: '연결된 증빙이 없습니다.' }),
    }))

    const result = await disconnectReconciliationRowEvidence({
      uploadSessionId: 'session-1',
      rowId: 'row-1',
    })

    expect(result).toEqual({ ok: false, message: '연결된 증빙이 없습니다.' })
  })
})
