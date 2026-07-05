import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { DateTime } from '@/lib/time'
import {
  buildCompanyHomeActionItems,
  buildCompanyHomeHeroMeta,
  buildCompanyHomePeriod,
  buildCompanyHomeWorkspaceCards,
  monthInPeriod,
  sortCompanyHomeActionItems,
  type CompanyHomeActionItem,
} from './summary'

describe('buildCompanyHomePeriod', () => {
  it('derives the first VAT half period deadline and D-day', () => {
    const period = buildCompanyHomePeriod({
      periodKey: '2026-H1',
      today: DateTime.fromISO('2026-07-01', { zone: 'Asia/Seoul' }),
    })

    expect(period).toMatchObject({
      key: '2026-H1',
      label: '2026년 부가세 1기 확정 신고',
      startMonth: '2026-01',
      endMonth: '2026-06',
      filingDeadline: '2026-07-25',
      dDay: 24,
    })
    expect(period.progressPercent).toBeGreaterThan(0)
    expect(period.progressPercent).toBeLessThanOrEqual(100)
  })

  it('defaults early January to the previous second VAT half', () => {
    const period = buildCompanyHomePeriod({
      today: DateTime.fromISO('2027-01-10', { zone: 'Asia/Seoul' }),
    })

    expect(period.key).toBe('2026-H2')
    expect(period.filingDeadline).toBe('2027-01-25')
  })

  it('falls back to the current first half for invalid period keys before July deadline', () => {
    const period = buildCompanyHomePeriod({
      periodKey: 'bad-period',
      today: DateTime.fromISO('2026-07-01', { zone: 'Asia/Seoul' }),
    })

    expect(period.key).toBe('2026-H1')
  })
})

describe('buildCompanyHomeActionItems', () => {
  it('sorts action items by danger, warn, ok', () => {
    const items: CompanyHomeActionItem[] = [
      { id: 'ok', title: '정상', description: '', tone: 'ok', count: 0, href: '/ok', ctaLabel: '열기' },
      { id: 'warn', title: '주의', description: '', tone: 'warn', count: 1, href: '/warn', ctaLabel: '열기' },
      { id: 'danger', title: '위험', description: '', tone: 'danger', count: 1, href: '/danger', ctaLabel: '열기' },
    ]

    expect(sortCompanyHomeActionItems(items).map((item) => item.id)).toEqual(['danger', 'warn', 'ok'])
  })

  it('creates source, bookkeeping, and payroll blockers from counts', () => {
    const items = buildCompanyHomeActionItems({
      missingMaterialCount: 1,
      unclassifiedTransactionCount: 18,
      payrollIssueCount: 2,
      totalTransactionCount: 342,
    })

    expect(items.map((item) => item.id)).toEqual([
      'bookkeeping-unclassified',
      'source-missing',
      'payroll-issue',
    ])
    expect(items[0]).toMatchObject({ tone: 'danger', count: 18, ctaLabel: '기장검토 열기' })
    expect(items[1]).toMatchObject({ ctaLabel: '자료수집 열기' })
  })

  it('adds a vat review blocker when bookkeeping is complete', () => {
    const items = buildCompanyHomeActionItems({
      missingMaterialCount: 0,
      unclassifiedTransactionCount: 0,
      payrollIssueCount: 0,
      totalTransactionCount: 120,
    })

    expect(items.map((item) => item.id)).toEqual(['vat-review'])
    expect(items[0]).toMatchObject({ ctaLabel: '부가세 열기' })
  })

  it('returns a single ok item when there are no blockers', () => {
    const items = buildCompanyHomeActionItems({
      missingMaterialCount: 0,
      unclassifiedTransactionCount: 0,
      payrollIssueCount: 0,
      totalTransactionCount: 0,
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'no-blocker', tone: 'ok', count: 0 })
  })
})

describe('buildCompanyHomeWorkspaceCards', () => {
  it('derives status card values from counts without hard-coding totals', () => {
    const cards = buildCompanyHomeWorkspaceCards({
      missingMaterialCount: 1,
      totalMaterialCount: 24,
      collectedUploadCount: 23,
      unclassifiedTransactionCount: 18,
      totalTransactionCount: 342,
      payrollIssueCount: 0,
      payrollDraftCount: 1,
      recentReceiptCount: 3,
    })

    expect(cards.find((card) => card.id === 'source_collection')).toMatchObject({
      valueMain: '1',
      valueSuffix: ' / 24건',
      footChip: { tone: 'warn' },
    })
    expect(cards.find((card) => card.id === 'bookkeeping')).toMatchObject({
      valueMain: '18',
      valueSuffix: ' / 342건',
      footChip: { tone: 'danger' },
    })
    expect(cards.find((card) => card.id === 'payroll')).toMatchObject({
      valueMain: '완료',
      footChip: { tone: 'ok' },
    })
  })
})

describe('buildCompanyHomeHeroMeta', () => {
  it('builds readiness meta from workspace progress', () => {
    const meta = buildCompanyHomeHeroMeta({
      missingMaterialCount: 1,
      totalMaterialCount: 24,
      collectedUploadCount: 23,
      unclassifiedTransactionCount: 18,
      totalTransactionCount: 342,
      payrollIssueCount: 0,
      payrollDraftCount: 1,
      recentReceiptCount: 3,
    })

    expect(meta.readinessPercent).toBeGreaterThan(50)
    expect(meta.metaLine).toContain('전체 준비')
    expect(meta.metaLine).toContain('기장검토 진행 중')
  })
})

describe('monthInPeriod', () => {
  const period = { startMonth: '2026-01', endMonth: '2026-06' }

  it('keeps rows inside the selected accounting period', () => {
    expect(monthInPeriod('2026-01', period)).toBe(true)
    expect(monthInPeriod('2026-06', period)).toBe(true)
    expect(monthInPeriod('2026-07', period)).toBe(false)
  })
})

describe('company home loader boundaries', () => {
  const source = readFileSync(new URL('./summary.ts', import.meta.url), 'utf8')

  it('does not reference excluded request and mailbox tables', () => {
    const forbiddenIdentifiers = [
      'requestTemplate',
      'clientRequestSchedule',
      'clientRequestEvent',
      'outboundEmail',
      'inboundEmail',
      'staffMailbox',
    ]

    for (const identifier of forbiddenIdentifiers) {
      expect(source).not.toContain(identifier)
    }
  })

  it('keeps the company home loader read-only', () => {
    expect(source).not.toContain('.insert(')
    expect(source).not.toContain('.update(')
    expect(source).not.toContain('.delete(')
  })

  it('scopes staff_direct sessions via source_batch for JC-031 Slice 3c-1', () => {
    expect(source).toContain("eq(sourceBatch.sourceKind, 'staff_direct')")
    expect(source).toContain('eq(requestItemValidation.uploadSessionId, sourceBatch.legacyUploadSessionId)')
    expect(source).not.toContain('from(uploadSession)')
    expect(source).not.toContain("eq(uploadSession.source, 'staff_direct')")
  })

  it('filters source_batch rows by the selected accounting period', () => {
    expect(source).toContain('gte(sourceBatch.accountingPeriod, period.startMonth)')
    expect(source).toContain('lte(sourceBatch.accountingPeriod, period.endMonth)')
  })
})
