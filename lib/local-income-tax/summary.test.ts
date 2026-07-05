import { describe, expect, it } from 'vitest'
import {
  buildLocalIncomeTaxBlockers,
  buildLocalIncomeTaxHero,
  buildLocalIncomeTaxRows,
  buildLocalIncomeTaxTotals,
  isConfirmedLocalIncomeTaxLine,
  type LocalIncomeTaxLine,
} from './summary'

function line(overrides: Partial<LocalIncomeTaxLine> = {}): LocalIncomeTaxLine {
  return {
    employeeCode: 'E-001',
    employeeName: '김대표',
    grossPayKrw: 7_000_000,
    incomeTaxKrw: 490_000,
    localIncomeTaxKrw: 49_000,
    status: 'ready',
    ...overrides,
  }
}

describe('isConfirmedLocalIncomeTaxLine', () => {
  it('treats ready/closed as confirmed and needs_review as pending', () => {
    expect(isConfirmedLocalIncomeTaxLine('ready')).toBe(true)
    expect(isConfirmedLocalIncomeTaxLine('closed')).toBe(true)
    expect(isConfirmedLocalIncomeTaxLine('needs_review')).toBe(false)
  })
})

describe('buildLocalIncomeTaxTotals', () => {
  it('sums only confirmed lines and excludes needs_review from filing totals', () => {
    const totals = buildLocalIncomeTaxTotals([
      line(),
      line({ employeeCode: 'E-002', employeeName: '이수민', grossPayKrw: 3_600_000, incomeTaxKrw: 180_000, localIncomeTaxKrw: 18_000, status: 'closed' }),
      line({ employeeCode: 'E-003', employeeName: '정하늘', grossPayKrw: 3_000_000, incomeTaxKrw: 90_000, localIncomeTaxKrw: 9_000, status: 'needs_review' }),
    ])

    expect(totals.totalEmployees).toBe(3)
    expect(totals.readyEmployees).toBe(2)
    expect(totals.attentionCount).toBe(1)
    expect(totals.grossPayKrw).toBe(10_600_000)
    expect(totals.incomeTaxKrw).toBe(670_000)
    expect(totals.localIncomeTaxKrw).toBe(67_000)
  })

  it('returns zero totals for empty payroll periods', () => {
    expect(buildLocalIncomeTaxTotals([])).toEqual({
      totalEmployees: 0,
      readyEmployees: 0,
      attentionCount: 0,
      grossPayKrw: 0,
      incomeTaxKrw: 0,
      localIncomeTaxKrw: 0,
    })
  })
})

describe('rows + hero + blockers', () => {
  it('keeps needs_review visible but marks it as excluded from totals', () => {
    const rows = buildLocalIncomeTaxRows([
      line(),
      line({ employeeName: '정하늘', status: 'needs_review' }),
    ], '2026년 6월')

    expect(rows[0]).toMatchObject({ includedInTotals: true, statusLabel: '준비 완료', tone: 'ok' })
    expect(rows[1]).toMatchObject({ includedInTotals: false, statusLabel: '2026년 6월 급여 미확정', tone: 'warn' })
  })

  it('computes hero from the same confirmed-line totals', () => {
    const totals = buildLocalIncomeTaxTotals([
      line(),
      line({ employeeName: '정하늘', status: 'needs_review', localIncomeTaxKrw: 99_999 }),
    ])
    const hero = buildLocalIncomeTaxHero(totals)

    expect(hero.totalEmployees).toBe(2)
    expect(hero.readyEmployees).toBe(1)
    expect(hero.attentionCount).toBe(1)
    expect(hero.readinessPercent).toBe(50)
    expect(hero.localIncomeTaxTotalKrw).toBe(49_000)
  })

  it('routes unconfirmed payroll issues to payroll workspace', () => {
    const blockers = buildLocalIncomeTaxBlockers({
      lines: [line(), line({ employeeName: '정하늘', status: 'needs_review' })],
      periodLabel: '2026년 6월',
      periodKey: '2026-06',
    })

    expect(blockers).toHaveLength(1)
    expect(blockers[0]).toMatchObject({
      title: '2026년 6월 급여 미확정 직원 1명',
      href: '/dashboard/payroll?period=2026-06',
      ctaLabel: '급여 열기',
    })
  })
})
