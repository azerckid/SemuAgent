import { describe, expect, it } from 'vitest'
import { DateTime } from '@/lib/time'
import {
  buildTaxCalendarStatusItems,
  groupTaxCalendarStatusItemsByDate,
  summarizeTaxCalendarStatusItems,
  type TaxCalendarEventRow,
  type TaxCalendarSessionRow,
} from './tax-calendar-status'

const today = DateTime.fromISO('2026-05-21T10:00:00+09:00', { zone: 'Asia/Seoul' })

function event(overrides: Partial<TaxCalendarEventRow> = {}): TaxCalendarEventRow {
  return {
    id: 'event_1',
    clientId: 'client_1',
    clientName: '가온상사',
    title: '5월 원천세 자료 요청',
    requestKind: 'general',
    dueAt: '2026-05-31T23:59:59+09:00',
    status: 'sent',
    uploadSessionId: 'session_1',
    ...overrides,
  }
}

function session(overrides: Partial<TaxCalendarSessionRow> = {}): TaxCalendarSessionRow {
  return {
    id: 'session_1',
    requestEventId: 'event_1',
    status: 'requested',
    ...overrides,
  }
}

describe('buildTaxCalendarStatusItems', () => {
  it('combines event and upload session into one calendar item', () => {
    const items = buildTaxCalendarStatusItems({
      events: [event()],
      sessions: [session()],
      today,
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      dateISO: '2026-05-31',
      clientName: '가온상사',
      uploadLabel: '업로드 대기',
      overallStatus: 'upload_waiting',
      nextAction: '업로드 대기 상태 확인',
    })
  })

  it('counts overdue unsent request as a review-needed item without email state', () => {
    const items = buildTaxCalendarStatusItems({
      events: [event({ status: 'draft_ready', dueAt: '2026-05-01T23:59:59+09:00' })],
      sessions: [],
      today,
    })
    const summary = summarizeTaxCalendarStatusItems(items)

    expect(items[0].overallStatus).toBe('overdue')
    expect(summary.reviewNeeded).toBe(1)
  })

  it('uses session requestEventId when event uploadSessionId is not populated', () => {
    const items = buildTaxCalendarStatusItems({
      events: [event({ uploadSessionId: null, status: 'submitted' })],
      sessions: [session({ status: 'submitted' })],
      today,
    })

    expect(items[0].sessionPath).toBe('/dashboard/sessions/session_1')
    expect(items[0].overallStatus).toBe('uploaded')
  })

  it('groups items by due date', () => {
    const items = buildTaxCalendarStatusItems({
      events: [
        event({ id: 'event_1', clientName: '가온상사', dueAt: '2026-05-10T23:59:59+09:00' }),
        event({ id: 'event_2', clientId: 'client_2', clientName: '누리상사', dueAt: '2026-05-10T23:59:59+09:00', uploadSessionId: null }),
      ],
      sessions: [session()],
      today,
    })
    const byDate = groupTaxCalendarStatusItemsByDate(items)

    expect(byDate.get('2026-05-10')).toHaveLength(2)
  })
})
