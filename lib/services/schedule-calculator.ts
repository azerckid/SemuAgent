/**
 * 정기 요청 스케줄 날짜 계산 유틸리티.
 * 모든 계산은 Luxon + 테넌트 타임존 기준.
 */

import { DateTime } from 'luxon'
import type { DueRule, SendRule } from '@/lib/validations/scheduling'

// ---------------------------------------------------------------------------
// 회계 기간 계산
// ---------------------------------------------------------------------------

/**
 * 기준 날짜와 주기를 받아 해당 기간의 accountingPeriod 문자열 반환
 * monthly   → '2026-05'
 * quarterly → '2026-Q2'
 * semiannual → '2026-H1'
 * annual    → '2026'
 */
export function calculateAccountingPeriod(
  frequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual',
  referenceDate: DateTime,
): string {
  const year = referenceDate.year
  const month = referenceDate.month

  if (frequency === 'monthly') {
    return referenceDate.toFormat('yyyy-MM')
  }
  if (frequency === 'quarterly') {
    const q = Math.ceil(month / 3)
    return `${year}-Q${q}`
  }
  if (frequency === 'semiannual') {
    const h = month <= 6 ? 1 : 2
    return `${year}-H${h}`
  }
  return `${year}`
}

// ---------------------------------------------------------------------------
// 기간 종료일 계산
// ---------------------------------------------------------------------------

/** 회계 기간 문자열에서 해당 기간의 마지막 날(23:59:59) 반환 */
export function getPeriodEndDate(
  accountingPeriod: string,
  timezone: string,
): DateTime {
  // monthly: '2026-05'
  if (/^\d{4}-\d{2}$/.test(accountingPeriod)) {
    const [year, month] = accountingPeriod.split('-').map(Number)
    return DateTime.fromObject({ year, month }, { zone: timezone }).endOf('month')
  }
  // quarterly: '2026-Q2'
  if (/^\d{4}-Q[1-4]$/.test(accountingPeriod)) {
    const year = Number(accountingPeriod.slice(0, 4))
    const q = Number(accountingPeriod[6])
    const endMonth = q * 3
    return DateTime.fromObject({ year, month: endMonth }, { zone: timezone }).endOf('month')
  }
  // semiannual: '2026-H1'
  if (/^\d{4}-H[1-2]$/.test(accountingPeriod)) {
    const year = Number(accountingPeriod.slice(0, 4))
    const h = Number(accountingPeriod[6])
    const endMonth = h === 1 ? 6 : 12
    return DateTime.fromObject({ year, month: endMonth }, { zone: timezone }).endOf('month')
  }
  // annual: '2026'
  if (/^\d{4}$/.test(accountingPeriod)) {
    const year = Number(accountingPeriod)
    return DateTime.fromObject({ year, month: 12 }, { zone: timezone }).endOf('month')
  }
  throw new Error(`Unknown accountingPeriod format: ${accountingPeriod}`)
}

// ---------------------------------------------------------------------------
// 제출 기한 계산
// ---------------------------------------------------------------------------

/**
 * dueRule + 회계 기간 → 제출 기한 ISO datetime 반환
 * day_of_month: 해당 회계 기간이 시작하는 달의 N일 23:59:59
 * days_after_period_end: 기간 종료 후 N일 23:59:59
 */
export function calculateDueAt(
  dueRule: DueRule,
  accountingPeriod: string,
  timezone: string,
): string {
  if (dueRule.type === 'day_of_month') {
    // monthly: '2026-05' → 해당 달의 N일
    // quarterly/semiannual/annual: 기간의 마지막 달 N일
    const periodEnd = getPeriodEndDate(accountingPeriod, timezone)
    const due = periodEnd.set({ day: dueRule.dayOfMonth }).endOf('day')
    // 같은 달이 없는 경우(28일 초과) clamp
    return due.toISO()!
  }
  // days_after_period_end
  const periodEnd = getPeriodEndDate(accountingPeriod, timezone)
  return periodEnd.plus({ days: dueRule.daysAfterPeriodEnd }).endOf('day').toISO()!
}

// ---------------------------------------------------------------------------
// 선생성 회차 목록 계산
// ---------------------------------------------------------------------------

/**
 * startsOn~endsOn 범위에 해당하는 accounting_period 문자열 목록을 반환.
 * endsOn이 null이면 startsOn + maxMonths 개월까지만 생성.
 */
export function generateAccountingPeriods(
  frequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual',
  startsOn: string,
  endsOn: string | null,
  timezone: string,
  maxMonths = 12,
): string[] {
  const tz = timezone || 'Asia/Seoul'
  const start = DateTime.fromISO(startsOn, { zone: tz })

  // endsOn 없을 때: 날짜 비교 대신 카운트 기반으로 정확히 제한
  // start + 12 months 방식은 월 경계 차이로 13개가 생길 수 있음
  if (!endsOn) {
    const periods: string[] = []
    if (frequency === 'monthly') {
      let cursor = start.startOf('month')
      for (let i = 0; i < maxMonths; i++) {
        periods.push(cursor.toFormat('yyyy-MM'))
        cursor = cursor.plus({ months: 1 })
      }
    } else if (frequency === 'quarterly') {
      let year = start.year
      let q = Math.ceil(start.month / 3)
      const max = Math.ceil(maxMonths / 3)
      for (let i = 0; i < max; i++) {
        periods.push(`${year}-Q${q}`)
        q++
        if (q > 4) { q = 1; year++ }
      }
    } else if (frequency === 'semiannual') {
      let year = start.year
      let h = start.month <= 6 ? 1 : 2
      const max = Math.ceil(maxMonths / 6)
      for (let i = 0; i < max; i++) {
        periods.push(`${year}-H${h}`)
        h++
        if (h > 2) { h = 1; year++ }
      }
    } else {
      // annual: 12개월 범위 = 시작 연도 1개
      periods.push(`${start.year}`)
    }
    return periods
  }

  // endsOn 있을 때: 날짜 범위 기반
  const end = DateTime.fromISO(endsOn, { zone: tz })
  const periods: string[] = []

  if (frequency === 'monthly') {
    let cursor = start.startOf('month')
    const endMonth = end.startOf('month')
    while (cursor <= endMonth) {
      periods.push(cursor.toFormat('yyyy-MM'))
      cursor = cursor.plus({ months: 1 })
    }
  } else if (frequency === 'quarterly') {
    let year = start.year
    let q = Math.ceil(start.month / 3)
    const endYear = end.year
    const endQ = Math.ceil(end.month / 3)
    while (year < endYear || (year === endYear && q <= endQ)) {
      periods.push(`${year}-Q${q}`)
      q++
      if (q > 4) { q = 1; year++ }
    }
  } else if (frequency === 'semiannual') {
    let year = start.year
    let h = start.month <= 6 ? 1 : 2
    const endYear = end.year
    const endH = end.month <= 6 ? 1 : 2
    while (year < endYear || (year === endYear && h <= endH)) {
      periods.push(`${year}-H${h}`)
      h++
      if (h > 2) { h = 1; year++ }
    }
  } else {
    for (let year = start.year; year <= end.year; year++) {
      periods.push(`${year}`)
    }
  }

  return periods
}

// ---------------------------------------------------------------------------
// 발송 날짜 조건 확인
// ---------------------------------------------------------------------------

/**
 * 오늘 날짜가 sendRule 조건과 일치하는지 확인
 * Cron에서 "오늘 발송할 스케줄인가?" 판단에 사용
 */
export function isScheduledToday(
  sendRule: SendRule,
  frequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual',
  today: DateTime,
): boolean {
  if (sendRule.type === 'day_of_month') {
    return today.day === sendRule.dayOfMonth
  }
  // days_before_period_end: 기간 종료일 - N일 = 오늘인지 확인
  const accountingPeriod = calculateAccountingPeriod(frequency, today)
  // timezone은 today에 이미 포함되어 있으므로 today.zone 사용
  const periodEnd = getPeriodEndDate(accountingPeriod, today.zoneName ?? 'Asia/Seoul')
  const sendDate = periodEnd.minus({ days: sendRule.daysBefore })
  return today.hasSame(sendDate, 'day')
}
