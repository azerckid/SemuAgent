import { describe, expect, it } from 'vitest'
import { DateTime } from '@/lib/time'
import {
  buildCurrentMonthScheduleItems,
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

  it('uses the official July 2026 deadlines and includes conditional filing schedules', () => {
    const july = expandTaxSchedulesForMonth(2026, 7)

    expect(july.filter((item) => item.dateISO === '2026-07-10')).toHaveLength(2)
    expect(july.find((item) => item.id === 'july-vat-final')?.dateISO).toBe('2026-07-27')
    expect(july.filter((item) => item.dateISO === '2026-07-31')).toHaveLength(5)
    expect(july.map((item) => item.title)).toEqual(expect.arrayContaining([
      '일용근로소득 지급명세서',
      '간이지급명세서(근로소득)',
      '간이지급명세서(거주자의 사업소득)',
      '간이지급명세서(거주자의 기타소득)',
      '재산세 납부',
    ]))
  })

  it('does not carry the verified 2026-only July additions into other years', () => {
    const july2027 = expandTaxSchedulesForMonth(2027, 7)

    expect(july2027.some((item) => item.id.startsWith('july-2026-'))).toBe(false)
  })
})

describe('buildCurrentMonthScheduleItems', () => {
  it('returns one row per applicable monthly schedule and keeps elapsed deadlines visible', () => {
    const today = DateTime.fromISO('2026-07-19', { zone: 'Asia/Seoul' })
    const items = buildCurrentMonthScheduleItems(today, { vat: true, payroll: true })

    expect(items).toEqual([
      expect.objectContaining({ dateLabel: '7/10', title: '원천세 신고', dDay: -9 }),
      expect.objectContaining({ dateLabel: '7/27', title: '부가가치세 확정신고', dDay: 8 }),
      expect.objectContaining({ dateLabel: '7/31', title: '간이지급명세서(근로소득)', dDay: 12 }),
    ])
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
