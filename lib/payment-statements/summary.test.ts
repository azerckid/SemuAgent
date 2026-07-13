import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import {
  buildPaymentStatementBlockers,
  buildPaymentStatementHero,
  buildSimplifiedStatementBlockers,
  buildSimplifiedStatementHero,
  buildSimplifiedRow,
  buildYearEndSettlementBlockers,
  buildYearEndSettlementHero,
  buildYearEndRow,
  employeeKeyOf,
  resolveEmployeeGroupKey,
  resolveReportingContext,
  resolveYearEndPeriodKey,
  type EmployeeProfileInput,
  type PayrollLineInput,
  type SimplifiedRow,
  type YearEndRow,
} from './summary'

function line(period: string, over: Partial<PayrollLineInput> = {}): PayrollLineInput {
  return {
    employeeCode: 'E-001',
    employeeName: '김대표',
    period,
    grossPayKrw: 7_000_000,
    incomeTaxKrw: 490_000,
    status: 'ready',
    ...over,
  }
}

const H1 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']

const profile = (over: Partial<EmployeeProfileInput> = {}): EmployeeProfileInput => ({
  employeeCode: 'E-001',
  displayName: '김대표',
  employeeStatus: 'active',
  hireDate: '2024-01-01',
  terminationDate: null,
  ...over,
})

describe('resolveReportingContext', () => {
  it('defaults to the most recently completed half', () => {
    const inH1 = resolveReportingContext(DateTime.fromISO('2026-03-10', { zone: 'Asia/Seoul' }))
    expect(inH1.year).toBe(2025)
    expect(inH1.half).toBe(2)
    expect(inH1.halfMonths[0]).toBe('2025-07')
    expect(inH1.halfMonths[5]).toBe('2025-12')
    expect(inH1.periodStatus).toBe('completed')

    const inH2 = resolveReportingContext(DateTime.fromISO('2026-07-13', { zone: 'Asia/Seoul' }))
    expect(inH2.year).toBe(2026)
    expect(inH2.half).toBe(1)
    expect(inH2.halfMonths).toEqual(H1)
    expect(inH2.requiredMonths).toEqual(H1)
    expect(inH2.yearMonths).toHaveLength(12)
    expect(inH2.yearPeriodStatus).toBe('open')
    expect(inH2.yearRequiredMonths).toEqual(H1)
  })

  it('defaults year-end settlement to the most recently completed year', () => {
    const today = DateTime.fromISO('2026-07-13', { zone: 'Asia/Seoul' })
    expect(resolveYearEndPeriodKey(today)).toBe('2025-H2')
    expect(resolveYearEndPeriodKey(today, '2026-H1')).toBe('2026-H2')
    expect(resolveYearEndPeriodKey(today, '2024')).toBe('2024-H2')
  })

  it('honors periodKey year + half (YYYY-H2)', () => {
    const ctx = resolveReportingContext(DateTime.fromISO('2026-03-10', { zone: 'Asia/Seoul' }), '2025-H2')
    expect(ctx.year).toBe(2025)
    expect(ctx.half).toBe(2)
    expect(ctx.halfMonths[0]).toBe('2025-07')
    expect(ctx.periodStatus).toBe('completed')
  })

  it('does not require the current or future months in an explicitly opened active half', () => {
    const ctx = resolveReportingContext(DateTime.fromISO('2026-09-10', { zone: 'Asia/Seoul' }), '2026-H2')
    expect(ctx.periodStatus).toBe('open')
    expect(ctx.requiredMonths).toEqual(['2026-07', '2026-08'])
  })
})

describe('employeeKeyOf', () => {
  it('prefers employeeCode, falls back to name', () => {
    expect(employeeKeyOf({ employeeCode: 'E-9', employeeName: '홍' })).toBe('code:E-9')
    expect(employeeKeyOf({ employeeCode: null, employeeName: '홍길동' })).toBe('name:홍길동')
  })
})

describe('resolveEmployeeGroupKey (P1 regression: no split rows for the same person)', () => {
  it('resolves a code-less payroll line to the profile code via name match, not a separate name-key row', () => {
    const profileByCode = new Map([['E-001', profile()]])
    const profileByName = new Map([['김대표', profile()]])
    // 급여 line에 employeeCode가 비어 있어도(레거시 데이터), 이름이 명부와 일치하면
    // 명부의 code를 그룹 키로 채택해야 한다 — employeeKeyOf만 쓰면 'name:김대표'와
    // 'code:E-001'로 갈라져 한 사람이 두 행이 된다.
    const resolved = resolveEmployeeGroupKey({ employeeCode: null, name: '김대표' }, profileByCode, profileByName)
    expect(resolved.key).toBe('code:E-001')
    expect(resolved.profile?.employeeCode).toBe('E-001')
  })

  it('falls back to a name key only when no profile matches by code or name', () => {
    const resolved = resolveEmployeeGroupKey({ employeeCode: null, name: '무명씨' }, new Map(), new Map())
    expect(resolved.key).toBe('name:무명씨')
    expect(resolved.profile).toBeUndefined()
  })
})

describe('buildSimplifiedRow (간이지급명세서 반기)', () => {
  const base = { employeeKey: 'code:E-001', employeeName: '김대표', employeeCode: 'E-001', halfMonths: H1 }

  it('is ready when all half months present, confirmed, profile complete', () => {
    const row = buildSimplifiedRow({ ...base, lines: H1.map((m) => line(m)), profile: profile() })
    expect(row.status).toBe('ready')
    expect(row.grossPayKrw).toBe(42_000_000)
    expect(row.withholdingTaxKrw).toBe(2_940_000) // ΣincomeTax = 근로소득세만
  })

  it('flags needs_review when any month is needs_review', () => {
    const lines = H1.map((m) => (m === '2026-03' ? line(m, { status: 'needs_review' }) : line(m)))
    const row = buildSimplifiedRow({ ...base, lines, profile: profile() })
    expect(row.status).toBe('needs_review')
  })

  it('flags missing_months when an expected month has no line', () => {
    const lines = H1.filter((m) => m !== '2026-03').map((m) => line(m))
    const row = buildSimplifiedRow({ ...base, lines, profile: profile() })
    expect(row.status).toBe('missing_months')
  })

  it('does not count pre-hire months as missing', () => {
    // 3월 입사 → 3~6월만 기대, 1·2월 없음은 누락 아님
    const lines = ['2026-03', '2026-04', '2026-05', '2026-06'].map((m) => line(m))
    const row = buildSimplifiedRow({ ...base, lines, profile: profile({ hireDate: '2026-03-05' }) })
    expect(row.status).toBe('ready')
  })

  it('marks an active half as period_open without treating future months as missing', () => {
    const row = buildSimplifiedRow({
      ...base,
      halfMonths: ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'],
      requiredMonths: [],
      periodStatus: 'open',
      lines: [line('2026-07')],
      profile: profile(),
    })
    expect(row.status).toBe('period_open')
    expect(row.statusLabel).toBe('기간 진행 중')
  })

  it('still flags a missing completed month inside an active half', () => {
    const row = buildSimplifiedRow({
      ...base,
      halfMonths: ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'],
      requiredMonths: ['2026-07', '2026-08'],
      periodStatus: 'open',
      lines: [line('2026-07')],
      profile: profile(),
    })
    expect(row.status).toBe('missing_months')
  })

  it('flags profile_incomplete when hireDate missing (주민번호는 검증 대상 아님)', () => {
    const row = buildSimplifiedRow({ ...base, lines: H1.map((m) => line(m)), profile: profile({ hireDate: null }) })
    expect(row.status).toBe('profile_incomplete')
  })

  it('P1 regression: profile_incomplete takes priority over missing_months', () => {
    // hireDate가 없으면 expectedMonths()가 반기 전체를 기대값으로 잡아 missing_months가
    // 잘못 뜬다(실제로는 직원 명부를 고쳐야 하는데 급여 화면으로 오라우팅됨). 프로필이
    // 없거나 hireDate가 없을 때는 missing_months보다 profile_incomplete가 우선해야 한다.
    const partialLines = H1.filter((m) => m !== '2026-05' && m !== '2026-06').map((m) => line(m))
    const rowNoProfile = buildSimplifiedRow({ ...base, lines: partialLines, profile: undefined })
    expect(rowNoProfile.status).toBe('profile_incomplete')

    const rowNoHireDate = buildSimplifiedRow({ ...base, lines: partialLines, profile: profile({ hireDate: null }) })
    expect(rowNoHireDate.status).toBe('profile_incomplete')

    // 프로필이 완전하면 그제서야 진짜 누락이 missing_months로 보인다.
    const rowComplete = buildSimplifiedRow({ ...base, lines: partialLines, profile: profile() })
    expect(rowComplete.status).toBe('missing_months')
  })
})

describe('buildYearEndRow (연말정산 준비·검토)', () => {
  const base = { employeeKey: 'code:E-001', employeeName: '김대표', employeeCode: 'E-001' }
  const year = Array.from({ length: 12 }, (_, i) => line(`2026-${String(i + 1).padStart(2, '0')}`))

  it('aggregates annual gross + withholding without settlement calc', () => {
    const row = buildYearEndRow({ ...base, lines: year, profile: profile() })
    expect(row.status).toBe('ready')
    expect(row.annualGrossPayKrw).toBe(84_000_000)
    expect(row.annualWithholdingTaxKrw).toBe(5_880_000)
    expect(row.missingLabel).toBe('없음')
  })

  it('marks terminated employees for mid-year settlement review', () => {
    const row = buildYearEndRow({ ...base, lines: year.slice(0, 9), profile: profile({ employeeStatus: 'terminated', terminationDate: '2026-09-30' }) })
    expect(row.status).toBe('mid_year_settlement')
    expect(row.employeeStatusLabel).toBe('중도퇴사')
  })

  it('needs_payroll when a month is unconfirmed', () => {
    const lines = year.map((l, i) => (i === 2 ? { ...l, status: 'needs_review' as const } : l))
    const row = buildYearEndRow({ ...base, lines, profile: profile() })
    expect(row.status).toBe('needs_payroll')
  })

  it('profile_incomplete when no matching profile', () => {
    const row = buildYearEndRow({ ...base, lines: year, profile: undefined })
    expect(row.status).toBe('profile_incomplete')
  })

  it('does not mark a partially elapsed current year as review-ready', () => {
    const lines = year.slice(0, 7)
    const row = buildYearEndRow({
      ...base,
      lines,
      yearMonths: year.map((entry) => entry.period),
      requiredMonths: H1,
      periodStatus: 'open',
      profile: profile(),
    })
    expect(row.annualGrossPayKrw).toBe(49_000_000)
    expect(row.status).toBe('period_open')
    expect(row.statusLabel).toBe('연도 진행 중')
  })

  it('requires every expected month after the reporting year is complete', () => {
    const row = buildYearEndRow({
      ...base,
      lines: year.slice(0, 11),
      yearMonths: year.map((entry) => entry.period),
      requiredMonths: year.map((entry) => entry.period),
      periodStatus: 'completed',
      profile: profile(),
    })
    expect(row.status).toBe('needs_payroll')
    expect(row.missingLabel).toContain('월 급여 누락')
  })
})

describe('blockers + hero', () => {
  const rows = (statuses: SimplifiedRow['status'][]): SimplifiedRow[] =>
    statuses.map((s, i) => ({
      employeeKey: `k${i}`, employeeName: `e${i}`, employeeCode: null,
      periodLabel: '', grossPayKrw: 0, withholdingTaxKrw: 0,
      status: s, statusLabel: '', tone: 'ok',
    }))

  it('routes payroll vs profile issues to the right workspace', () => {
    const blockers = buildPaymentStatementBlockers({
      simplified: rows(['needs_review', 'profile_incomplete', 'ready']),
      yearEnd: [],
    })
    expect(blockers.find((b) => b.id === 'payroll')?.href).toBe('/dashboard/payroll')
    expect(blockers.find((b) => b.id === 'profile')?.href).toBe('/dashboard/employees')
  })

  it('keeps payment and year-end blocker counts scoped to their own rows', () => {
    const simplified = rows(['ready', 'ready'])
    const yearEnd: YearEndRow[] = [
      { employeeKey: 'k0', employeeName: 'e0', employeeCode: null, employeeStatus: 'active', employeeStatusLabel: '재직', annualGrossPayKrw: null, annualWithholdingTaxKrw: null, missingLabel: '월 급여 미확정', status: 'needs_payroll', statusLabel: '월 급여 확정 필요', tone: 'warn' },
      { employeeKey: 'k1', employeeName: 'e1', employeeCode: null, employeeStatus: 'active', employeeStatusLabel: '재직', annualGrossPayKrw: null, annualWithholdingTaxKrw: null, missingLabel: '인적사항', status: 'profile_incomplete', statusLabel: '인적사항 확인', tone: 'danger' },
    ]

    expect(buildSimplifiedStatementBlockers(simplified)).toEqual([])
    expect(buildYearEndSettlementBlockers(yearEnd).map((blocker) => blocker.id)).toEqual([
      'year_end_payroll',
      'year_end_profile',
    ])
  })

  it('computes readiness = ready / total', () => {
    const hero = buildPaymentStatementHero(rows(['ready', 'ready', 'needs_review', 'missing_months']), [])
    expect(hero.totalEmployees).toBe(4)
    expect(hero.readyCount).toBe(2)
    expect(hero.attentionCount).toBe(2)
    expect(hero.readinessPercent).toBe(50)
  })

  it('does not count an open reporting period as attention or ready', () => {
    const simplified = rows(['period_open', 'period_open'])
    const hero = buildPaymentStatementHero(simplified, [])
    expect(hero.readyCount).toBe(0)
    expect(hero.attentionCount).toBe(0)
    expect(hero.periodOpenCount).toBe(2)
    expect(buildPaymentStatementBlockers({ simplified, yearEnd: [] })).toEqual([])
  })

  it('P1 regression: a yearEnd-only issue (e.g. mid_year_settlement) counts as attention', () => {
    // simplified는 전부 ready(반기 급여는 정상)이지만, 연말정산 표에서 중도퇴사로
    // "중도정산 검토"가 뜨는 직원이 있다면 hero/허브 attention에도 반영돼야 한다.
    // 그렇지 않으면 화면은 경고를 보여주는데 hero·허브 트랙은 "데이터 준비"로
    // 어긋나 보인다.
    const simplified = rows(['ready', 'ready'])
    const yearEnd: YearEndRow[] = [
      { employeeKey: 'k0', employeeName: 'e0', employeeCode: null, employeeStatus: 'active', employeeStatusLabel: '재직', annualGrossPayKrw: 100, annualWithholdingTaxKrw: 10, missingLabel: '없음', status: 'ready', statusLabel: '', tone: 'ok' },
      { employeeKey: 'k1', employeeName: 'e1', employeeCode: null, employeeStatus: 'terminated', employeeStatusLabel: '중도퇴사', annualGrossPayKrw: 90, annualWithholdingTaxKrw: 9, missingLabel: '퇴사 정산 확인', status: 'mid_year_settlement', statusLabel: '', tone: 'warn' },
    ]
    const hero = buildPaymentStatementHero(simplified, yearEnd)
    expect(hero.totalEmployees).toBe(2)
    expect(hero.readyCount).toBe(1)
    expect(hero.attentionCount).toBe(1)
  })

  it('keeps the 지급명세서 and 연말정산 screen metrics independent', () => {
    const simplified = rows(['ready', 'ready'])
    const yearEnd: YearEndRow[] = [
      { employeeKey: 'k0', employeeName: 'e0', employeeCode: null, employeeStatus: 'active', employeeStatusLabel: '재직', annualGrossPayKrw: 100, annualWithholdingTaxKrw: 10, missingLabel: '없음', status: 'ready', statusLabel: '검토 준비', tone: 'ok' },
      { employeeKey: 'k1', employeeName: 'e1', employeeCode: null, employeeStatus: 'terminated', employeeStatusLabel: '중도퇴사', annualGrossPayKrw: 90, annualWithholdingTaxKrw: 9, missingLabel: '퇴사 정산 확인', status: 'mid_year_settlement', statusLabel: '중도정산 검토', tone: 'warn' },
    ]

    expect(buildSimplifiedStatementHero(simplified)).toMatchObject({
      readyCount: 2,
      attentionCount: 0,
      readinessPercent: 100,
    })
    expect(buildYearEndSettlementHero(yearEnd)).toMatchObject({
      readyCount: 1,
      attentionCount: 1,
      readinessPercent: 50,
    })
  })

  it('keeps an open year out of both attention and ready counts', () => {
    const yearEnd: YearEndRow[] = [
      { employeeKey: 'k0', employeeName: 'e0', employeeCode: null, employeeStatus: 'active', employeeStatusLabel: '재직', annualGrossPayKrw: 70, annualWithholdingTaxKrw: 7, missingLabel: '없음', status: 'period_open', statusLabel: '연도 진행 중', tone: 'muted' },
    ]
    expect(buildYearEndSettlementHero(yearEnd)).toMatchObject({
      readyCount: 0,
      attentionCount: 0,
      periodOpenCount: 1,
      readinessPercent: 0,
    })
    expect(buildPaymentStatementHero(rows(['ready']), yearEnd)).toMatchObject({
      readyCount: 1,
      attentionCount: 0,
    })
  })
})
