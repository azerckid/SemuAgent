import { describe, expect, it } from 'vitest'
import {
  buildRecentRequestItems,
  mapPayrollDerivedStatusToSummary,
  mapReviewDerivedStatusToSummary,
  type PayrollDerivedStatus,
  type ReviewDerivedStatus,
} from './client-work-context'
import type { ClientDetailEvent, ClientDetailSession } from './client-detail-types'

function status(label: string): ReviewDerivedStatus {
  return { label, detail: '', tone: 'info' }
}

function payrollStatus(label: string): PayrollDerivedStatus {
  return { label, detail: '', tone: 'info' }
}

describe('mapReviewDerivedStatusToSummary', () => {
  it('maps "제출 없음" to 업로드대기 — still waiting for the client to upload', () => {
    expect(mapReviewDerivedStatusToSummary(status('제출 없음')).label).toBe('업로드대기')
  })

  it('maps "제출 확인" and "검증통과" to 제출확인 — no actionable issue', () => {
    expect(mapReviewDerivedStatusToSummary(status('제출 확인')).label).toBe('제출확인')
    expect(mapReviewDerivedStatusToSummary(status('검증통과')).label).toBe('제출확인')
  })

  it('maps every other review label to 검토필요, including in-progress AI states', () => {
    for (const label of ['검토필요', '평가 필요', '재검토 필요', 'AI 판단 중']) {
      expect(mapReviewDerivedStatusToSummary(status(label)).label).toBe('검토필요')
    }
  })
})

describe('mapPayrollDerivedStatusToSummary', () => {
  it('maps payroll ready states to 제출확인', () => {
    for (const label of ['작성 가능', '엑셀 생성', '추출 대기', '추출 중']) {
      expect(mapPayrollDerivedStatusToSummary(payrollStatus(label)).label).toBe('제출확인')
    }
  })

  it('maps payroll waiting states to 업로드대기', () => {
    for (const label of ['업로드 대기', '업로드 중']) {
      expect(mapPayrollDerivedStatusToSummary(payrollStatus(label)).label).toBe('업로드대기')
    }
  })

  it('maps payroll problem states to 검토필요', () => {
    for (const label of ['부적합', '추출 실패', '재추출 필요', '자료 보완 필요']) {
      expect(mapPayrollDerivedStatusToSummary(payrollStatus(label)).label).toBe('검토필요')
    }
  })
})

const baseSession: ClientDetailSession = {
  id: 'session-1',
  accountingPeriod: '2026-06',
  status: 'submitted',
  expiresAt: '2026-06-30T23:59:59+09:00',
  lastAccessedAt: null,
  createdAt: '2026-06-01T00:00:00+09:00',
  requestEventId: null,
  requestKind: 'general',
}

const baseEvent: ClientDetailEvent = {
  id: 'event-1',
  accountingPeriod: '2026-06',
  frequency: 'monthly',
  requestKind: 'general',
  title: '2026-06 기장 자료 요청',
  dueAt: '2026-06-23T23:59:59+09:00',
  status: 'sent',
  uploadSessionId: null,
  createdAt: '2026-06-01T00:00:00+09:00',
}

describe('buildRecentRequestItems — review status reuse', () => {
  it('uses the review-derived status for a non-payroll session when available, not the raw session.status mapping', () => {
    // session.status === 'submitted' would normally map to 제출확인 via summarizeSessionStatus,
    // but the actual review screen says there is an actionable issue — that must win.
    const items = buildRecentRequestItems({
      events: [],
      sessions: [baseSession],
      reviewStatusBySessionId: { [baseSession.id]: status('검토필요') },
      payrollStatusBySessionId: {},
    })

    expect(items[0].status).toBe('검토필요')
    expect(items[0].href).toBe('/dashboard/direct-upload')
  })

  it('falls back to the raw session.status mapping when no review status is available', () => {
    const items = buildRecentRequestItems({
      events: [],
      sessions: [{ ...baseSession, status: 'requested' }],
      reviewStatusBySessionId: {},
      payrollStatusBySessionId: {},
    })

    expect(items[0].status).toBe('업로드대기')
  })

  it('uses payroll-derived status for payroll sessions, not the raw session.status or review status map', () => {
    const payrollSession: ClientDetailSession = { ...baseSession, requestKind: 'payroll', status: 'requested' }
    const items = buildRecentRequestItems({
      events: [],
      sessions: [payrollSession],
      // page.tsx never populates this for a payroll session id, but the
      // component defends against it anyway in case a caller gets it wrong.
      reviewStatusBySessionId: { [payrollSession.id]: status('검토필요') },
      payrollStatusBySessionId: { [payrollSession.id]: payrollStatus('작성 가능') },
    })

    expect(items[0].status).toBe('제출확인')
    expect(items[0].href).toBe('/dashboard/payroll')
  })

  it('prefers the linked session review status over the event\'s own status', () => {
    const event: ClientDetailEvent = { ...baseEvent, status: 'sent', uploadSessionId: 'session-1' }
    const items = buildRecentRequestItems({
      events: [event],
      sessions: [],
      reviewStatusBySessionId: { 'session-1': status('제출 확인') },
      payrollStatusBySessionId: {},
    })

    expect(items[0].status).toBe('제출확인')
  })

  it('falls back to the event status mapping when the linked session has no review status yet', () => {
    const event: ClientDetailEvent = { ...baseEvent, status: 'sent', uploadSessionId: 'session-1' }
    const items = buildRecentRequestItems({
      events: [event],
      sessions: [],
      reviewStatusBySessionId: {},
      payrollStatusBySessionId: {},
    })

    expect(items[0].status).toBe('발송완료')
  })
})
