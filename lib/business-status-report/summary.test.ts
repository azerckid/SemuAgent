import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import {
  buildBusinessStatusAnnualSourceIssueCounts,
  buildBusinessStatusBlockers,
  buildBusinessStatusExpenseRows,
  buildBusinessStatusHandoffRows,
  buildBusinessStatusPreparationPercent,
  buildBusinessStatusRevenueRows,
  resolveBusinessStatusEligibility,
  resolveBusinessStatusFiscalYear,
  type BusinessStatusClassificationRow,
} from './summary'

function row(overrides: Partial<BusinessStatusClassificationRow>): BusinessStatusClassificationRow {
  return {
    id: overrides.id ?? 'row-1',
    sourceType: overrides.sourceType ?? 'bank',
    direction: overrides.direction ?? 'income',
    amountKrw: Object.prototype.hasOwnProperty.call(overrides, 'amountKrw') ? overrides.amountKrw! : 1_000_000,
    recommendedAccount: Object.prototype.hasOwnProperty.call(overrides, 'recommendedAccount') ? overrides.recommendedAccount! : '상담 용역',
    finalAccount: Object.prototype.hasOwnProperty.call(overrides, 'finalAccount') ? overrides.finalAccount! : null,
    status: overrides.status ?? 'confirmed',
  }
}

describe('resolveBusinessStatusEligibility', () => {
  it('allows only tax_exempt business entities', () => {
    expect(resolveBusinessStatusEligibility('tax_exempt')).toEqual({ state: 'applicable', reason: null })
    expect(resolveBusinessStatusEligibility('individual')).toEqual({ state: 'not_applicable', reason: 'vat_taxable_or_corporation' })
    expect(resolveBusinessStatusEligibility('corporation')).toEqual({ state: 'not_applicable', reason: 'vat_taxable_or_corporation' })
    expect(resolveBusinessStatusEligibility(null)).toEqual({ state: 'needs_business_type', reason: 'tax_entity_type_missing' })
  })
})

describe('business status report amount rows', () => {
  it('sums confirmed income rows only and groups by final/recommended account', () => {
    const rows = buildBusinessStatusRevenueRows([
      row({ id: 'a', amountKrw: 3_000_000, finalAccount: '상담 용역' }),
      row({ id: 'b', amountKrw: 2_000_000, finalAccount: '상담 용역' }),
      row({ id: 'c', amountKrw: 7_000_000, recommendedAccount: '강의·자문' }),
      row({ id: 'd', amountKrw: 9_000_000, status: 'needs_decision' }),
      row({ id: 'e', amountKrw: null, status: 'confirmed' }),
      row({ id: 'f', direction: 'expense', amountKrw: 5_000_000 }),
    ])
    expect(rows).toEqual([
      expect.objectContaining({ label: '강의·자문', amountKrw: 7_000_000, sourceCount: 1 }),
      expect.objectContaining({ label: '상담 용역', amountKrw: 5_000_000, sourceCount: 2 }),
    ])
  })

  it('sums confirmed expense rows only and falls back to source type label', () => {
    const rows = buildBusinessStatusExpenseRows([
      row({ id: 'a', direction: 'expense', amountKrw: 1_000_000, finalAccount: '임차료' }),
      row({ id: 'b', direction: 'expense', amountKrw: 200_000, finalAccount: '임차료' }),
      row({ id: 'c', direction: 'expense', amountKrw: 300_000, finalAccount: null, recommendedAccount: null, sourceType: 'card' }),
      row({ id: 'd', direction: 'expense', amountKrw: 900_000, status: 'suggested' }),
    ])
    expect(rows).toEqual([
      expect.objectContaining({ label: '임차료', amountKrw: 1_200_000, sourceCount: 2 }),
      expect.objectContaining({ label: '카드 경비', amountKrw: 300_000, sourceCount: 1 }),
    ])
  })
})

describe('buildBusinessStatusBlockers', () => {
  it('routes missing business type, source issues, and unconfirmed bookkeeping rows to the right workspaces', () => {
    const blockers = buildBusinessStatusBlockers({
      eligibility: resolveBusinessStatusEligibility(null),
      sourceMissingCount: 1,
      normalizationPendingCount: 1,
      classificationRows: [
        row({ id: 'a', status: 'confirmed' }),
        row({ id: 'b', status: 'needs_decision' }),
        row({ id: 'c', status: 'confirmed', amountKrw: null }),
      ],
    })
    expect(blockers.map((b) => [b.id, b.href])).toEqual([
      ['business-type-missing', '/dashboard/settings'],
      ['source-collection', '/dashboard/direct-upload'],
      ['bookkeeping-review', '/dashboard/bookkeeping/reconciliation-ledger'],
    ])
    expect(blockers.find((b) => b.id === 'bookkeeping-review')?.title).toContain('2건')
  })
})

describe('buildBusinessStatusPreparationPercent', () => {
  it('returns 0 for non-applicable or empty data, 100 when ready, and proportional when blockers exist', () => {
    expect(buildBusinessStatusPreparationPercent({ applicable: false, blockerCount: 0, confirmedRevenueCount: 2, confirmedExpenseCount: 2 })).toBe(0)
    expect(buildBusinessStatusPreparationPercent({ applicable: true, blockerCount: 0, confirmedRevenueCount: 0, confirmedExpenseCount: 0 })).toBe(0)
    expect(buildBusinessStatusPreparationPercent({ applicable: true, blockerCount: 0, confirmedRevenueCount: 2, confirmedExpenseCount: 2 })).toBe(100)
    expect(buildBusinessStatusPreparationPercent({ applicable: true, blockerCount: 2, confirmedRevenueCount: 2, confirmedExpenseCount: 2 })).toBe(67)
  })
})


describe('buildBusinessStatusAnnualSourceIssueCounts', () => {
  it('combines H1 and H2 source collection blockers for an annual report', () => {
    const counts = buildBusinessStatusAnnualSourceIssueCounts([
      { missingItems: [{ id: 'h1-a' }, { id: 'h1-b' }], completeness: { normalizationPendingCount: 1 } },
      { missingItems: [{ id: 'h2-a' }], completeness: { normalizationPendingCount: 2 } },
    ])
    expect(counts).toEqual({ sourceMissingCount: 3, normalizationPendingCount: 3 })
  })
})

describe('buildBusinessStatusHandoffRows', () => {
  it('keeps Hometax submission as user-direct handoff', () => {
    const handoff = buildBusinessStatusHandoffRows({ revenueTotalKrw: 48_300_000, expenseTotalKrw: 17_240_000, blockerCount: 0 })
    expect(handoff.find((row) => row.item === '제출 안내')).toMatchObject({ statusLabel: '사용자 직접', owner: '신고지원' })
    expect(handoff.find((row) => row.item === '수입금액')?.value).toBe('48,300,000원')
  })
})

describe('resolveBusinessStatusFiscalYear', () => {
  it('uses a leading year in periodKey, otherwise today', () => {
    const today = DateTime.fromISO('2026-07-05T00:00:00', { zone: 'Asia/Seoul' })
    expect(resolveBusinessStatusFiscalYear(today, '2025-H2')).toBe(2025)
    expect(resolveBusinessStatusFiscalYear(today, null)).toBe(2026)
  })
})
