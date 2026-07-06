import { DateTime } from 'luxon'
import type {
  EmployeeProfileInput,
  PayrollLineInput,
  ReportingContext,
  SimplifiedRow,
} from '@/lib/payment-statements/summary'
import type { SimplifiedWageEmployeeSegment } from './types'

const TZ = 'Asia/Seoul'

function monthStartYmd(period: string): string {
  return DateTime.fromISO(`${period}-01`, { zone: TZ }).toFormat('yyyyMMdd')
}

function monthEndYmd(period: string): string {
  return DateTime.fromISO(`${period}-01`, { zone: TZ }).endOf('month').toFormat('yyyyMMdd')
}

export function clipWorkPeriod(
  context: ReportingContext,
  profile?: EmployeeProfileInput,
): { workPeriodStart: string; workPeriodEnd: string } {
  const halfStart = monthStartYmd(context.halfMonths[0])
  const halfEnd = monthEndYmd(context.halfMonths[context.halfMonths.length - 1])

  let start = halfStart
  if (profile?.hireDate && /^\d{4}-\d{2}/.test(profile.hireDate)) {
    const hireYmd = profile.hireDate.replace(/-/g, '').slice(0, 8)
    if (hireYmd > start) start = hireYmd
  }

  let end = halfEnd
  if (profile?.employeeStatus === 'terminated' && profile.terminationDate && /^\d{4}-\d{2}/.test(profile.terminationDate)) {
    const termYmd = profile.terminationDate.replace(/-/g, '').slice(0, 8)
    if (termYmd < end) end = termYmd
  }

  return { workPeriodStart: start, workPeriodEnd: end }
}

export function monthlyGrossForHalf(
  lines: PayrollLineInput[],
  halfMonths: string[],
): Record<string, number> {
  const monthly: Record<string, number> = {}
  for (const month of halfMonths) {
    monthly[month] = 0
  }
  for (const line of lines) {
    if (halfMonths.includes(line.period)) {
      monthly[line.period] = (monthly[line.period] ?? 0) + line.grossPayKrw
    }
  }
  return monthly
}

export function buildEmployeeSegments(params: {
  simplified: SimplifiedRow[]
  linesByEmployeeKey: Map<string, PayrollLineInput[]>
  profilesByEmployeeKey: Map<string, EmployeeProfileInput>
  context: ReportingContext
}): SimplifiedWageEmployeeSegment[] {
  const { simplified, linesByEmployeeKey, profilesByEmployeeKey, context } = params

  return simplified.map((row) => {
    const lines = linesByEmployeeKey.get(row.employeeKey) ?? []
    const profile = profilesByEmployeeKey.get(row.employeeKey)
    const { workPeriodStart, workPeriodEnd } = clipWorkPeriod(context, profile)

    return {
      employeeKey: row.employeeKey,
      employeeName: row.employeeName,
      simplifiedStatus: row.status,
      residentId: null,
      workPeriodStart,
      workPeriodEnd,
      grossPayKrw: row.grossPayKrw,
      recognizedBonusKrw: 0,
      monthlyGrossPayKrw: monthlyGrossForHalf(lines, context.halfMonths),
    }
  })
}
