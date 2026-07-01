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
  source: 'sample_workbook_image'
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
    source: 'sample_workbook_image',
  },
  {
    id: 'monthly-social-insurance',
    title: '4대보험 납부',
    category: 'tax',
    recurrence: { type: 'monthly', day: 10 },
    source: 'sample_workbook_image',
  },
  {
    id: 'monthly-labor-confirmation',
    title: '근로내용확인신고',
    category: 'payroll',
    recurrence: { type: 'monthly', day: 15 },
    source: 'sample_workbook_image',
  },
  {
    id: 'january-vat-final',
    title: '부가가치세 확정신고',
    category: 'vat',
    recurrence: { type: 'yearly', month: 1, day: 25 },
    source: 'sample_workbook_image',
  },
  {
    id: 'april-vat-preliminary',
    title: '부가가치세 예정신고',
    category: 'vat',
    recurrence: { type: 'yearly', month: 4, day: 25 },
    source: 'sample_workbook_image',
  },
  {
    id: 'july-vat-final',
    title: '부가가치세 확정신고',
    category: 'vat',
    recurrence: { type: 'yearly', month: 7, day: 25 },
    source: 'sample_workbook_image',
  },
  {
    id: 'october-vat-preliminary',
    title: '부가가치세 예정신고',
    category: 'vat',
    recurrence: { type: 'yearly', month: 10, day: 25 },
    source: 'sample_workbook_image',
  },
  {
    id: 'march-corporate-tax',
    title: '법인세 신고',
    category: 'corporate',
    recurrence: { type: 'yearly', month: 3, day: 31 },
    source: 'sample_workbook_image',
  },
  {
    id: 'may-global-income-tax',
    title: '종합소득세 신고',
    category: 'corporate',
    recurrence: { type: 'yearly', month: 5, day: 31 },
    source: 'sample_workbook_image',
  },
  {
    id: 'may-income-total-report',
    title: '소득총액 신고',
    category: 'payroll',
    recurrence: { type: 'yearly', month: 5, day: 31 },
    source: 'sample_workbook_image',
  },
  {
    id: 'may-simplified-payment-statement',
    title: '간이지급명세서',
    category: 'tax',
    recurrence: { type: 'yearly', month: 5, day: 31 },
    source: 'sample_workbook_image',
  },
]

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
    if (recurrence.type === 'yearly' && recurrence.month !== month) continue

    const day = recurrence.day
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
