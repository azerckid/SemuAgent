import { DateTime } from '@/lib/time'

const DEFAULT_TZ = 'Asia/Seoul'

export type TaxScheduleCategory = 'tax' | 'payroll' | 'vat' | 'corporate'

export type TaxScheduleRule = {
  id: string
  title: string
  category: TaxScheduleCategory
  recurrence:
    | { type: 'monthly'; day: number }
    | { type: 'yearly'; month: number; day: number }
  source: 'nts' | 'mois' | 'operational_calendar'
  applicability?: string
  years?: readonly number[]
}

export type TaxScheduleOccurrence = TaxScheduleRule & {
  date: DateTime
  dateISO: string
  day: number
}

export type TaxCalendarDay = {
  date: DateTime
  dateISO: string
  dayOfMonth: number
  inCurrentMonth: boolean
  isToday: boolean
  occurrences: TaxScheduleOccurrence[]
}

export type TaxCalendarMonth = {
  year: number
  month: number
  label: string
  monthKey: string
  previousMonthKey: string
  nextMonthKey: string
  days: TaxCalendarDay[]
  weeks: TaxCalendarDay[][]
  occurrences: TaxScheduleOccurrence[]
}

export const TAX_SCHEDULE_CATEGORY_LABEL: Record<TaxScheduleCategory, string> = {
  tax: '원천세·세무 신고',
  payroll: '급여·인사',
  vat: '부가세',
  corporate: '법인·종소세',
}

export const TAX_SCHEDULE_RULES: TaxScheduleRule[] = [
  {
    id: 'monthly-withholding-tax',
    title: '원천세 신고',
    category: 'tax',
    recurrence: { type: 'monthly', day: 10 },
    source: 'nts',
    applicability: '원천징수 대상 소득을 지급한 경우',
  },
  {
    id: 'monthly-social-insurance',
    title: '4대보험 납부',
    category: 'tax',
    recurrence: { type: 'monthly', day: 10 },
    source: 'operational_calendar',
    applicability: '4대보험 가입 사업장',
  },
  {
    id: 'monthly-labor-confirmation',
    title: '근로내용확인신고',
    category: 'payroll',
    recurrence: { type: 'monthly', day: 15 },
    source: 'operational_calendar',
    applicability: '일용근로자를 고용한 경우',
  },
  {
    id: 'january-vat-final',
    title: '부가가치세 확정신고',
    category: 'vat',
    recurrence: { type: 'yearly', month: 1, day: 25 },
    source: 'nts',
    applicability: '부가가치세 신고 대상 사업자',
  },
  {
    id: 'april-vat-preliminary',
    title: '부가가치세 예정신고',
    category: 'vat',
    recurrence: { type: 'yearly', month: 4, day: 25 },
    source: 'nts',
    applicability: '부가가치세 신고 대상 사업자',
  },
  {
    id: 'july-vat-final',
    title: '부가가치세 확정신고',
    category: 'vat',
    recurrence: { type: 'yearly', month: 7, day: 25 },
    source: 'nts',
    applicability: '부가가치세 신고 대상 사업자',
  },
  {
    id: 'october-vat-preliminary',
    title: '부가가치세 예정신고',
    category: 'vat',
    recurrence: { type: 'yearly', month: 10, day: 25 },
    source: 'nts',
    applicability: '부가가치세 신고 대상 사업자',
  },
  {
    id: 'march-corporate-tax',
    title: '법인세 신고',
    category: 'corporate',
    recurrence: { type: 'yearly', month: 3, day: 31 },
    source: 'nts',
    applicability: '12월 결산법인',
  },
  {
    id: 'may-global-income-tax',
    title: '종합소득세 신고',
    category: 'corporate',
    recurrence: { type: 'yearly', month: 5, day: 31 },
    source: 'nts',
    applicability: '종합소득세 신고 대상자',
  },
  {
    id: 'may-income-total-report',
    title: '소득총액 신고',
    category: 'payroll',
    recurrence: { type: 'yearly', month: 5, day: 31 },
    source: 'operational_calendar',
    applicability: '보수총액 신고 대상 사업장',
  },
  {
    id: 'may-simplified-payment-statement',
    title: '간이지급명세서',
    category: 'tax',
    recurrence: { type: 'yearly', month: 5, day: 31 },
    source: 'nts',
    applicability: '지급명세서 제출 대상 소득을 지급한 경우',
  },
  {
    id: 'july-2026-daily-wage-payment-statement',
    title: '일용근로소득 지급명세서',
    category: 'payroll',
    recurrence: { type: 'yearly', month: 7, day: 31 },
    source: 'nts',
    applicability: '전월에 일용근로소득을 지급한 경우',
    years: [2026],
  },
  {
    id: 'july-2026-business-income-simple-statement',
    title: '간이지급명세서(거주자의 사업소득)',
    category: 'payroll',
    recurrence: { type: 'yearly', month: 7, day: 31 },
    source: 'nts',
    applicability: '전월에 사업소득을 지급한 경우',
    years: [2026],
  },
  {
    id: 'july-2026-other-income-simple-statement',
    title: '간이지급명세서(거주자의 기타소득)',
    category: 'payroll',
    recurrence: { type: 'yearly', month: 7, day: 31 },
    source: 'nts',
    applicability: '전월에 인적용역 기타소득을 지급한 경우',
    years: [2026],
  },
  {
    id: 'july-2026-wage-income-simple-statement',
    title: '간이지급명세서(근로소득)',
    category: 'payroll',
    recurrence: { type: 'yearly', month: 7, day: 31 },
    source: 'nts',
    applicability: '상반기에 근로소득을 지급한 경우',
    years: [2026],
  },
  {
    id: 'july-2026-property-tax',
    title: '재산세 납부',
    category: 'tax',
    recurrence: { type: 'yearly', month: 7, day: 31 },
    source: 'mois',
    applicability: '주택·건축물 등 과세 대상 재산을 소유한 경우',
    years: [2026],
  },
]

// 법정일이 휴일인 해의 실제 신고·납부기한은 관할 기관의 연간 세무일정으로 확인한다.
// 현재 제품에서 검증한 2026년 일정만 명시적으로 보정하며, 임의로 공휴일을 추정하지 않는다.
const OFFICIAL_DATE_OVERRIDES: Record<string, string> = {
  'july-vat-final:2026': '2026-07-27',
}

function toMonthKey(date: DateTime): string {
  return date.toFormat('yyyy-MM')
}

export function parseTaxCalendarMonth(
  monthKey: string | null | undefined,
  fallback: DateTime = DateTime.now().setZone(DEFAULT_TZ),
): DateTime {
  if (monthKey) {
    const parsed = DateTime.fromISO(`${monthKey}-01`, { zone: DEFAULT_TZ })
    if (parsed.isValid) return parsed.startOf('month')
  }

  return fallback.setZone(DEFAULT_TZ).startOf('month')
}

export function expandTaxSchedulesForMonth(
  year: number,
  month: number,
  rules: TaxScheduleRule[] = TAX_SCHEDULE_RULES,
): TaxScheduleOccurrence[] {
  const monthStart = DateTime.fromObject({ year, month, day: 1 }, { zone: DEFAULT_TZ })
  const daysInMonth = monthStart.daysInMonth ?? 31
  const occurrences: TaxScheduleOccurrence[] = []

  for (const rule of rules) {
    const recurrence = rule.recurrence
    if (rule.years && !rule.years.includes(year)) continue
    if (recurrence.type === 'yearly' && recurrence.month !== month) continue

    const override = OFFICIAL_DATE_OVERRIDES[`${rule.id}:${year}`]
    const overrideDate = override
      ? DateTime.fromISO(override, { zone: DEFAULT_TZ })
      : null
    if (overrideDate?.isValid && overrideDate.month !== month) continue

    const day = overrideDate?.isValid ? overrideDate.day : recurrence.day
    if (day < 1 || day > daysInMonth) continue

    const date = DateTime.fromObject({ year, month, day }, { zone: DEFAULT_TZ })
    occurrences.push({
      ...rule,
      date,
      dateISO: date.toISODate() ?? '',
      day,
    })
  }

  return occurrences.sort(
    (a, b) => a.date.toMillis() - b.date.toMillis() || a.title.localeCompare(b.title),
  )
}

export type CompanyScheduleItem = {
  id: string
  dateLabel: string
  title: string
  dDay: number
  href: string
}

export type CompanyScheduleApplicability = {
  vat: boolean
  payroll: boolean
}

const VAT_SCHEDULE_IDS = new Set([
  'january-vat-final',
  'april-vat-preliminary',
  'july-vat-final',
  'october-vat-preliminary',
])

const PAYROLL_SCHEDULE_IDS = new Set([
  'monthly-withholding-tax',
  'july-2026-wage-income-simple-statement',
])

/** 세비서 첫 화면: 회사 자료로 확인된 이번 달 일정을 한 건당 한 줄로 반환한다. */
export function buildCurrentMonthScheduleItems(
  today: DateTime,
  applicability: CompanyScheduleApplicability,
): CompanyScheduleItem[] {
  const start = today.setZone(DEFAULT_TZ).startOf('day')
  return expandTaxSchedulesForMonth(start.year, start.month)
    .filter((schedule) =>
      (applicability.vat && VAT_SCHEDULE_IDS.has(schedule.id))
      || (applicability.payroll && PAYROLL_SCHEDULE_IDS.has(schedule.id)),
    )
    .map((schedule) => ({
      id: `${schedule.id}-${schedule.dateISO}`,
      dateLabel: `${schedule.date.month}/${schedule.date.day}`,
      title: schedule.title,
      dDay: Math.ceil(schedule.date.startOf('day').diff(start, 'days').days),
      href: SCHEDULE_RULE_HREF[schedule.id] ?? '/dashboard/filing-preparation',
    }))
}

export function buildTaxCalendarMonth(params: {
  month: DateTime
  today?: DateTime
  rules?: TaxScheduleRule[]
}): TaxCalendarMonth {
  const monthStart = params.month.setZone(DEFAULT_TZ).startOf('month')
  const monthEnd = monthStart.plus({ months: 1 }).minus({ days: 1 })
  const today = (params.today ?? DateTime.now()).setZone(DEFAULT_TZ)
  const occurrences = expandTaxSchedulesForMonth(monthStart.year, monthStart.month, params.rules)
  const occurrencesByDate = new Map<string, TaxScheduleOccurrence[]>()

  for (const occurrence of occurrences) {
    const existing = occurrencesByDate.get(occurrence.dateISO) ?? []
    existing.push(occurrence)
    occurrencesByDate.set(occurrence.dateISO, existing)
  }

  const gridStart = monthStart.minus({ days: monthStart.weekday % 7 })
  const trailingDays = 6 - (monthEnd.weekday % 7)
  const gridEnd = monthEnd.plus({ days: trailingDays })
  const totalDays = Math.max(35, Math.round(gridEnd.diff(gridStart, 'days').days) + 1)

  const days = Array.from({ length: totalDays }, (_, index) => {
    const date = gridStart.plus({ days: index })
    const dateISO = date.toISODate() ?? ''
    return {
      date,
      dateISO,
      dayOfMonth: date.day,
      inCurrentMonth: date.month === monthStart.month,
      isToday: date.hasSame(today, 'day'),
      occurrences: occurrencesByDate.get(dateISO) ?? [],
    }
  })

  const weeks: TaxCalendarDay[][] = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }

  return {
    year: monthStart.year,
    month: monthStart.month,
    label: monthStart.toFormat('yyyy년 M월'),
    monthKey: toMonthKey(monthStart),
    previousMonthKey: toMonthKey(monthStart.minus({ months: 1 })),
    nextMonthKey: toMonthKey(monthStart.plus({ months: 1 })),
    days,
    weeks,
    occurrences,
  }
}

export type UpcomingScheduleItem = {
  id: string
  dDay: number
  dateLabel: string
  title: string
  category: string
  soon: boolean
  href: string
}

// JC-036: 회사 홈 "다가오는 신고" 항목의 CTA 대상. 신고 유형별 실제 준비 화면으로 보낸다
// (cadence IA상 급여·지급/부가세/연간신고 그룹과 무관하게 라우트 자체는 바뀌지 않았다).
const SCHEDULE_RULE_HREF: Record<string, string> = {
  'monthly-withholding-tax': '/dashboard/filing-support',
  'monthly-social-insurance': '/dashboard/payroll',
  'monthly-labor-confirmation': '/dashboard/payroll',
  'january-vat-final': '/dashboard/vat',
  'april-vat-preliminary': '/dashboard/vat',
  'july-vat-final': '/dashboard/vat',
  'october-vat-preliminary': '/dashboard/vat',
  'march-corporate-tax': '/dashboard/filing-preparation',
  'may-global-income-tax': '/dashboard/filing-preparation',
  'may-income-total-report': '/dashboard/payroll',
  'may-simplified-payment-statement': '/dashboard/filing-preparation/payment-statements',
  'july-2026-daily-wage-payment-statement': '/dashboard/filing-preparation/payment-statements',
  'july-2026-business-income-simple-statement': '/dashboard/filing-preparation/payment-statements',
  'july-2026-other-income-simple-statement': '/dashboard/filing-preparation/payment-statements',
  'july-2026-wage-income-simple-statement': '/dashboard/filing-preparation/payment-statements',
  'july-2026-property-tax': '/dashboard/calendar',
}

// 다가오는 신고 일정: 이번 달·다음 달 마감 중 미래 항목 상위 N건(기본 3).
// 세목·tenant에 무관한 정적 규칙 기반 계산이라 회사 홈·연간신고 등 여러 화면에서 공유한다.
export function buildUpcomingSchedule(today: DateTime, limit = 3): UpcomingScheduleItem[] {
  const start = today.startOf('day')
  const nextMonth = today.plus({ months: 1 })
  const occurrences = [
    ...expandTaxSchedulesForMonth(today.year, today.month),
    ...expandTaxSchedulesForMonth(nextMonth.year, nextMonth.month),
  ]

  return occurrences
    .filter((occ) => occ.date.startOf('day') >= start)
    .slice(0, limit)
    .map((occ) => {
      const dDay = Math.ceil(occ.date.startOf('day').diff(start, 'days').days)
      return {
        id: `${occ.id}-${occ.dateISO}`,
        dDay,
        dateLabel: `${occ.date.month}/${occ.date.day}`,
        title: occ.title,
        category: occ.category,
        soon: dDay <= 7,
        href: SCHEDULE_RULE_HREF[occ.id] ?? '/dashboard',
      } satisfies UpcomingScheduleItem
    })
}
