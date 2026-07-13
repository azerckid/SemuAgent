import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import {
  buildPaymentStatementBlockers,
  buildPaymentStatementHero,
  buildSimplifiedStatementBlockers,
  buildSimplifiedStatementHero,
  buildSimplifiedRow,
  buildYearEndSettlementHero,
  buildYearEndRow,
  employeeKeyOf,
  isEmployeeProfileRelevantForYear,
  resolveEmployeeGroupKey,
  resolveReportingContext,
  resolveYearEndPeriodKey,
  type AnnualPayrollLineInput,
  type EmployeeProfileInput,
  type SimplifiedRow,
  type YearEndRow,
} from './summary'

function line(period: string, over: Partial<AnnualPayrollLineInput> = {}): AnnualPayrollLineInput {
  return {
    employeeCode: 'E-001',
    employeeName: '김대표',
    period,
    periodCloseStatus: 'closed',
    baseSalaryKrw: 6_000_000,
    allowanceKrw: 800_000,
    mealAllowanceKrw: 200_000,
    grossPayKrw: 7_000_000,
    incomeTaxKrw: 490_000,
    localIncomeTaxKrw: 49_000,
    nationalPensionKrw: 250_000,
    healthInsuranceKrw: 210_000,
    longTermCareKrw: 27_000,
    employmentInsuranceKrw: 63_000,
    status: 'closed',
    ...over,
  }
}

const H1 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']

const profile = (over: Partial<EmployeeProfileInput> = {}): EmployeeProfileInput => ({
  employeeCode: 'E-001',
  displayName: '김대표',
  employeeStatus: 'active',
  payrollEligibility: 'eligible',
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

describe('employee profile reporting-year scope', () => {
  it('excludes payroll-ineligible and out-of-year profiles', () => {
    expect(isEmployeeProfileRelevantForYear(profile({ payrollEligibility: 'excluded' }), 2026)).toBe(false)
    expect(isEmployeeProfileRelevantForYear(profile({ hireDate: '2027-01-01' }), 2026)).toBe(false)
    expect(isEmployeeProfileRelevantForYear(profile({ employeeStatus: 'terminated', terminationDate: '2025-12-31' }), 2026)).toBe(false)
    expect(isEmployeeProfileRelevantForYear(profile({ hireDate: '2026-03-01' }), 2026)).toBe(true)
  })
})

describe('buildYearEndRow (홈택스 지급명세서 생성용 급여 기초자료)', () => {
  const base = { employeeKey: 'code:E-001', employeeName: '김대표', employeeCode: 'E-001' }
  const year = Array.from({ length: 12 }, (_, i) => line(`2026-${String(i + 1).padStart(2, '0')}`))

  it('aggregates only stored closed payroll components without settlement calculation', () => {
    const row = buildYearEndRow({ ...base, lines: year, yearMonths: year.map((entry) => entry.period), profile: profile() })
    expect(row.status).toBe('ready')
    expect(row.statusLabel).toBe('급여 준비 완료')
    expect(row.annualBaseSalaryKrw).toBe(72_000_000)
    expect(row.annualAllowanceKrw).toBe(9_600_000)
    expect(row.annualMealAllowanceKrw).toBe(2_400_000)
    expect(row.annualGrossPayKrw).toBe(84_000_000)
    expect(row.annualWithholdingTaxKrw).toBe(5_880_000)
    expect(row.annualLocalIncomeTaxKrw).toBe(588_000)
    expect(row.annualNationalPensionKrw).toBe(3_000_000)
    expect(row.workPeriodLabel).toBe('1~12월')
    expect(row.reasonCodes).toEqual([])
  })

  it('marks complete mid-year hire and termination rows as special-case review', () => {
    const hired = buildYearEndRow({
      ...base,
      lines: year.slice(3),
      yearMonths: year.map((entry) => entry.period),
      profile: profile({ hireDate: '2026-04-01' }),
    })
    expect(hired.status).toBe('special_case_review')
    expect(hired.reasonCodes).toContain('mid_year_hire')
    expect(hired.hometaxCheckLabel).toContain('종전근무지')

    const terminated = buildYearEndRow({
      ...base,
      lines: year.slice(0, 9),
      yearMonths: year.map((entry) => entry.period),
      profile: profile({ employeeStatus: 'terminated', terminationDate: '2026-09-30' }),
    })
    expect(terminated.status).toBe('special_case_review')
    expect(terminated.reasonCodes).toContain('mid_year_termination')
    expect(terminated.workPeriodDetail).toBe('9개월 · 중도퇴사')
  })

  it('prioritizes payroll action over a special-case signal', () => {
    const lines = year.slice(3).map((entry, index) => index === 0 ? { ...entry, status: 'needs_review' as const } : entry)
    const row = buildYearEndRow({
      ...base,
      lines,
      yearMonths: year.map((entry) => entry.period),
      profile: profile({ hireDate: '2026-04-01' }),
    })
    expect(row.status).toBe('payroll_action_required')
    expect(row.statusLabel).toBe('급여 보완')
    expect(row.reasonCodes).toEqual(expect.arrayContaining(['line_not_closed', 'mid_year_hire']))
    expect(row.annualGrossPayKrw).toBeNull()
  })

  it('requires both the period summary and employee line to be closed', () => {
    const openPeriod = year.map((entry, index) => index === 1 ? { ...entry, periodCloseStatus: 'open' as const } : entry)
    const row = buildYearEndRow({ ...base, lines: openPeriod, yearMonths: year.map((entry) => entry.period), profile: profile() })
    expect(row.status).toBe('payroll_action_required')
    expect(row.reasonCodes).toContain('period_not_closed')
    expect(row.issueLabels).toContain('2월 급여 마감 필요')
  })

  it('does not infer a total when stored payroll components do not match gross pay', () => {
    const mismatch = year.map((entry, index) => index === 4 ? { ...entry, grossPayKrw: entry.grossPayKrw + 1 } : entry)
    const row = buildYearEndRow({ ...base, lines: mismatch, yearMonths: year.map((entry) => entry.period), profile: profile() })
    expect(row.status).toBe('payroll_action_required')
    expect(row.reasonCodes).toContain('gross_mismatch')
    expect(row.annualGrossPayKrw).toBeNull()
  })

  it('requires an employee profile and hire date without collecting resident IDs', () => {
    const noProfile = buildYearEndRow({ ...base, lines: year, yearMonths: year.map((entry) => entry.period), profile: undefined })
    expect(noProfile.status).toBe('payroll_action_required')
    expect(noProfile.reasonCodes).toContain('missing_profile')

    const noHireDate = buildYearEndRow({ ...base, lines: year, yearMonths: year.map((entry) => entry.period), profile: profile({ hireDate: null }) })
    expect(noHireDate.reasonCodes).toContain('missing_hire_date')
  })

  it('keeps an open year separate and aggregates completed months only', () => {
    const lines = year.slice(0, 7)
    const row = buildYearEndRow({
      ...base,
      lines,
      yearMonths: year.map((entry) => entry.period),
      requiredMonths: H1,
      periodStatus: 'open',
      profile: profile(),
    })
    expect(row.annualGrossPayKrw).toBe(42_000_000)
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
    expect(row.status).toBe('payroll_action_required')
    expect(row.reasonCodes).toContain('missing_month')
    expect(row.issueLabels).toContain('12월 급여 누락')
  })
})

function yearEndRow(status: YearEndRow['status'], over: Partial<YearEndRow> = {}): YearEndRow {
  return {
    employeeKey: 'k0',
    employeeName: 'e0',
    employeeCode: null,
    employeeStatus: 'active',
    employeeStatusLabel: '재직',
    workPeriodLabel: '1~12월',
    workPeriodDetail: '12개월',
    annualBaseSalaryKrw: 80,
    annualAllowanceKrw: 10,
    annualMealAllowanceKrw: 10,
    annualGrossPayKrw: 100,
    annualNationalPensionKrw: 5,
    annualHealthInsuranceKrw: 4,
    annualLongTermCareKrw: 1,
    annualEmploymentInsuranceKrw: 1,
    annualWithholdingTaxKrw: 10,
    annualLocalIncomeTaxKrw: 1,
    payrollSummaryLabel: '',
    hometaxCheckLabel: '',
    hometaxCheckDetail: '',
    reasonCodes: [],
    issueLabels: [],
    status,
    statusLabel: '',
    tone: status === 'ready' ? 'ok' : status === 'period_open' ? 'muted' : 'warn',
    ...over,
  }
}

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

  it('keeps payment-statement blockers scoped to simplified rows', () => {
    expect(buildSimplifiedStatementBlockers(rows(['ready', 'ready']))).toEqual([])
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

  it('counts a year-end special case as shared attention', () => {
    const simplified = rows(['ready', 'ready'])
    const yearEnd: YearEndRow[] = [
      yearEndRow('ready'),
      yearEndRow('special_case_review', { employeeKey: 'k1', employeeName: 'e1', reasonCodes: ['mid_year_termination'] }),
    ]
    const hero = buildPaymentStatementHero(simplified, yearEnd)
    expect(hero.totalEmployees).toBe(2)
    expect(hero.readyCount).toBe(1)
    expect(hero.attentionCount).toBe(1)
  })

  it('keeps the 지급명세서 and 연말정산 screen metrics independent', () => {
    const simplified = rows(['ready', 'ready'])
    const yearEnd: YearEndRow[] = [
      yearEndRow('ready'),
      yearEndRow('special_case_review', { employeeKey: 'k1', employeeName: 'e1' }),
      yearEndRow('payroll_action_required', { employeeKey: 'k2', employeeName: 'e2' }),
    ]

    expect(buildSimplifiedStatementHero(simplified)).toMatchObject({
      readyCount: 2,
      attentionCount: 0,
      readinessPercent: 100,
    })
    expect(buildYearEndSettlementHero(yearEnd)).toMatchObject({
      readyCount: 1,
      payrollActionCount: 1,
      specialCaseCount: 1,
      periodOpenCount: 0,
    })
  })

  it('keeps an open year out of both attention and ready counts', () => {
    const yearEnd: YearEndRow[] = [yearEndRow('period_open')]
    expect(buildYearEndSettlementHero(yearEnd)).toMatchObject({
      readyCount: 0,
      payrollActionCount: 0,
      specialCaseCount: 0,
      periodOpenCount: 1,
    })
    expect(buildPaymentStatementHero(rows(['ready']), yearEnd)).toMatchObject({
      readyCount: 1,
      attentionCount: 0,
    })
  })
})
