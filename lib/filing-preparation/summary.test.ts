import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import type { InternalReminderAttention } from '@/lib/internal-reminders/summary'
import {
  buildFilingPreparationBlockers,
  buildFilingPreparationReadiness,
  buildTracks,
  buildUpcomingSchedule,
  businessTypeLabel,
  classifyBusinessType,
  inapplicableReasonFor,
  isTrackApplicable,
} from './summary'

function attentions(overrides: Partial<Record<InternalReminderAttention['domain'], number>> = {}): InternalReminderAttention[] {
  const base: Record<InternalReminderAttention['domain'], number> = {
    source_collection: 0,
    bookkeeping_review: 0,
    vat: 0,
    payroll: 0,
    filing_support: 0,
  }
  const counts = { ...base, ...overrides }
  return (Object.keys(counts) as InternalReminderAttention['domain'][]).map((domain) => ({
    domain,
    count: counts[domain],
    label: `${domain} ${counts[domain]}건`,
  }))
}

describe('classifyBusinessType', () => {
  it('classifies known keywords and defaults unknown to unknown', () => {
    expect(classifyBusinessType('법인사업자')).toBe('corporation')
    expect(classifyBusinessType('면세 개인사업자')).toBe('tax_exempt')
    expect(classifyBusinessType('개인 일반과세')).toBe('individual')
    expect(classifyBusinessType(null)).toBe('unknown')
    expect(classifyBusinessType('')).toBe('unknown')
    expect(classifyBusinessType('주식회사')).toBe('unknown')
  })

  it('prioritizes 면세 over 개인', () => {
    // 면세 개인사업자는 tax_exempt로 분류되어야 부가세 흐림이 작동한다
    expect(classifyBusinessType('면세 개인')).toBe('tax_exempt')
  })

  it('labels types for the UI', () => {
    expect(businessTypeLabel('corporation')).toBe('법인')
    expect(businessTypeLabel('tax_exempt')).toBe('면세 개인')
    expect(businessTypeLabel('individual')).toBe('개인')
    expect(businessTypeLabel('unknown')).toBe('미지정')
  })
})

describe('buildTracks', () => {
  it('null-hrefs a non-applicable track so "해당 없음" cannot be opened (dimmed = 실행 막기)', () => {
    const tracks = buildTracks(attentions(), { outputTaxKrw: 0, inputTaxKrw: 0, pendingDeductionCount: 0 }, 'tax_exempt')
    const vat = tracks.find((t) => t.id === 'vat')!
    expect(vat.applicable).toBe(false)
    expect(vat.href).toBeNull()
    // 해당하는 트랙은 링크가 유지된다
    const withholding = tracks.find((t) => t.id === 'withholding')!
    expect(withholding.applicable).toBe(true)
    expect(withholding.href).toBe('/dashboard/filing-support')
  })

  it('keeps VAT openable for applicable business types', () => {
    const tracks = buildTracks(attentions(), { outputTaxKrw: 0, inputTaxKrw: 0, pendingDeductionCount: 0 }, 'individual')
    const vat = tracks.find((t) => t.id === 'vat')!
    expect(vat.applicable).toBe(true)
    expect(vat.href).toBe('/dashboard/vat')
  })
})

describe('isTrackApplicable / inapplicableReasonFor', () => {
  it('dims only VAT for tax-exempt business', () => {
    expect(isTrackApplicable('vat', 'tax_exempt')).toBe(false)
    expect(inapplicableReasonFor('vat', 'tax_exempt')).toContain('사업장현황신고')
  })

  it('keeps all tracks applicable for individual/corporation/unknown', () => {
    for (const type of ['individual', 'corporation', 'unknown'] as const) {
      expect(isTrackApplicable('vat', type)).toBe(true)
      expect(isTrackApplicable('withholding', type)).toBe(true)
      expect(isTrackApplicable('payment_statement', type)).toBe(true)
      expect(isTrackApplicable('local_income', type)).toBe(true)
      expect(inapplicableReasonFor('vat', type)).toBeNull()
    }
  })
})

describe('buildFilingPreparationReadiness', () => {
  it('is 100% when foundation and live tracks have no attention', () => {
    expect(buildFilingPreparationReadiness(attentions())).toBe(100)
  })

  it('drops as blockers appear (source/bookkeeping/vat/payroll considered, filing_support excluded)', () => {
    // 4개 고려 도메인 중 2개에 blocker → 50%
    expect(buildFilingPreparationReadiness(attentions({ vat: 3, payroll: 1 }))).toBe(50)
    // filing_support는 준비율 계산에서 제외 → 여전히 100%
    expect(buildFilingPreparationReadiness(attentions({ filing_support: 2 }))).toBe(100)
  })
})

describe('buildFilingPreparationBlockers', () => {
  it('lists only domains with attention and routes to the right workspace', () => {
    const blockers = buildFilingPreparationBlockers(attentions({ vat: 3, source_collection: 1 }))
    expect(blockers.map((b) => b.domain).sort()).toEqual(['source_collection', 'vat'])
    const vatBlocker = blockers.find((b) => b.domain === 'vat')!
    expect(vatBlocker.tone).toBe('danger')
    expect(vatBlocker.href).toBe('/dashboard/vat')
  })

  it('is empty when nothing needs attention', () => {
    expect(buildFilingPreparationBlockers(attentions())).toEqual([])
  })
})

describe('buildUpcomingSchedule', () => {
  it('returns future occurrences with D-day and soon flag', () => {
    const today = DateTime.fromISO('2026-07-04T00:00:00', { zone: 'Asia/Seoul' })
    const schedule = buildUpcomingSchedule(today)
    expect(Array.isArray(schedule)).toBe(true)
    for (const item of schedule) {
      expect(item.dDay).toBeGreaterThanOrEqual(0)
      expect(item.soon).toBe(item.dDay <= 7)
    }
    // 7/10 원천세 마감 같은 이번 달 미래 항목이 포함된다
    expect(schedule.some((item) => item.dateLabel.startsWith('7/'))).toBe(true)
  })

  it('excludes past occurrences', () => {
    const today = DateTime.fromISO('2026-07-26T00:00:00', { zone: 'Asia/Seoul' })
    const schedule = buildUpcomingSchedule(today)
    // 7/25 부가세 등 과거 항목은 제외
    expect(schedule.every((item) => item.dDay >= 0)).toBe(true)
  })
})
