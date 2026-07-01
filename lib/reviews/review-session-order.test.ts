import { describe, expect, it } from 'vitest'
import { sortReviewSessions } from './review-session-order'
import type { ReviewSession, ReviewTone } from './review-workspace-types'

function session(overrides: Partial<ReviewSession> & Pick<ReviewSession, 'id' | 'clientName' | 'createdAt'>): ReviewSession {
  return {
    id: overrides.id,
    clientId: `${overrides.id}-client`,
    clientName: overrides.clientName,
    clientEmail: `${overrides.id}@example.com`,
    staffName: '춘심이',
    accountingPeriod: overrides.accountingPeriod ?? '2026-06',
    status: 'submitted',
    hasSessionEvaluation: false,
    expiresAt: '2027-06-12T00:00:00.000+09:00',
    createdAt: overrides.createdAt,
    requestEmailSubject: null,
    requestEmailBody: null,
    source: 'staff_direct',
    latestAnalysisAt: null,
    workType: 'bookkeeping',
    bookkeepingPeriodType: null,
    bookkeepingPeriodStart: null,
    bookkeepingPeriodEnd: null,
    files: [],
    validations: [],
    validationFiles: [],
    analysisRuns: [],
    materialAttributions: [],
    materialAttributionSummary: null,
    acceptedFiles: [],
    counts: {
      satisfied: 0,
      missing: 0,
      nonCompliant: 0,
      partial: 0,
      uncertain: 0,
    },
    derivedStatus: {
      label: overrides.derivedStatus?.label ?? '제출 확인',
      detail: overrides.derivedStatus?.detail ?? '',
      tone: overrides.derivedStatus?.tone ?? 'info',
    },
    completionKind: null,
  }
}

describe('sortReviewSessions', () => {
  it('keeps the session list ordered by recency instead of status severity', () => {
    const sessions = [
      session({
        id: 'older-warning',
        clientName: '오래된 검토필요',
        createdAt: '2026-06-10T00:00:00.000+09:00',
        derivedStatus: { label: '검토필요', detail: '', tone: 'warning' as ReviewTone },
      }),
      session({
        id: 'newer-info',
        clientName: '최신 제출 확인',
        createdAt: '2026-06-12T00:00:00.000+09:00',
        derivedStatus: { label: '제출 확인', detail: '', tone: 'info' as ReviewTone },
      }),
    ]

    expect(sortReviewSessions(sessions).map((item) => item.id)).toEqual([
      'newer-info',
      'older-warning',
    ])
  })

  it('uses accounting period and client name as stable tie breakers', () => {
    const sessions = [
      session({ id: 'a', clientName: '나회사', accountingPeriod: '2026-05', createdAt: '2026-06-12T00:00:00.000+09:00' }),
      session({ id: 'b', clientName: '가회사', accountingPeriod: '2026-06', createdAt: '2026-06-12T00:00:00.000+09:00' }),
      session({ id: 'c', clientName: '다회사', accountingPeriod: '2026-06', createdAt: '2026-06-12T00:00:00.000+09:00' }),
    ]

    expect(sortReviewSessions(sessions).map((item) => item.id)).toEqual(['b', 'c', 'a'])
  })
})
