import { describe, expect, it } from 'vitest'
import { DateTime } from '@/lib/time'
import {
  buildTaxCalendarMonth,
  expandTaxSchedulesForMonth,
  parseTaxCalendarMonth,
} from './tax-calendar'

describe('parseTaxCalendarMonth', () => {
  it('parses a yyyy-MM month key at the start of month', () => {
    const parsed = parseTaxCalendarMonth('2026-05')

    expect(parsed.toISODate()).toBe('2026-05-01')
  })

  it('falls back when the month key is invalid', () => {
    const fallback = DateTime.fromISO('2026-07-18', { zone: 'Asia/Seoul' })

    expect(parseTaxCalendarMonth('bad-value', fallback).toISODate()).toBe('2026-07-01')
  })
})

describe('expandTaxSchedulesForMonth', () => {
  it('expands monthly and yearly rules for May 2026', () => {
    const occurrences = expandTaxSchedulesForMonth(2026, 5)

    expect(occurrences.map((occurrence) => `${occurrence.dateISO}:${occurrence.title}`)).toEqual([
      '2026-05-10:4대보험 납부',
      '2026-05-10:원천세 신고',
      '2026-05-15:근로내용확인신고',
      '2026-05-31:간이지급명세서',
      '2026-05-31:소득총액 신고',
      '2026-05-31:종합소득세 신고',
    ])
  })

  it('keeps month-specific VAT schedules out of unrelated months', () => {
    const january = expandTaxSchedulesForMonth(2026, 1)
    const may = expandTaxSchedulesForMonth(2026, 5)

    expect(january.some((occurrence) => occurrence.title === '부가가치세 확정신고')).toBe(true)
    expect(may.some((occurrence) => occurrence.title.includes('부가가치세'))).toBe(false)
  })
})

describe('buildTaxCalendarMonth', () => {
  it('builds a Sunday-start monthly grid for May 2026', () => {
    const month = DateTime.fromISO('2026-05-01', { zone: 'Asia/Seoul' })
    const today = DateTime.fromISO('2026-05-21', { zone: 'Asia/Seoul' })
    const view = buildTaxCalendarMonth({ month, today })

    expect(view.label).toBe('2026년 5월')
    expect(view.weeks[0][0].dateISO).toBe('2026-04-26')
    expect(view.weeks[0][5].dateISO).toBe('2026-05-01')
    expect(view.weeks.at(-1)?.at(-1)?.dateISO).toBe('2026-06-06')
    expect(view.days.find((day) => day.dateISO === '2026-05-21')?.isToday).toBe(true)
  })

  it('attaches tax schedule occurrences to matching days', () => {
    const month = DateTime.fromISO('2026-05-01', { zone: 'Asia/Seoul' })
    const view = buildTaxCalendarMonth({ month })

    expect(view.days.find((day) => day.dateISO === '2026-05-10')?.occurrences).toHaveLength(2)
    expect(view.days.find((day) => day.dateISO === '2026-05-31')?.occurrences).toHaveLength(3)
  })
})
