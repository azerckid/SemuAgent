// 기장 연간 장부(누적 보기·계정항목·전표분개) 패널을 고객사 상세에서 일단 숨긴다.
// 기장/전표 관련 노출을 보류하기 위한 v1 플래그이며, 데이터·라우트는 보존한다(false로 복원).
export const BOOKKEEPING_FISCAL_YEAR_PANEL_HIDDEN_V1 = true

export type FiscalLedgerMonthStatus =
  | 'not_requested'
  | 'requested'
  | 'material_received'
  | 'classification_needed'
  | 'journal_needed'
  | 'journal_draft_ready'

export type LedgerMonthView = {
  id: string
  periodMonth: string
  status: FiscalLedgerMonthStatus
  lastUploadSessionId: string | null
  counts: {
    sessionCount: number
    includedMaterialCount: number
    completedClassificationRunCount: number
    journalEntryRunCount: number
  }
}

export type LedgerPeriodOption = {
  value: string
  label: string
  shortLabel: string
  type: 'year' | 'half' | 'quarter' | 'month'
  start: string
  end: string
}

export const LEDGER_STATUS_META: Record<FiscalLedgerMonthStatus, {
  label: string
  className: string
}> = {
  not_requested: {
    label: '자료 없음',
    className: 'border-gray-200 bg-gray-50 text-gray-500',
  },
  requested: {
    label: '요청됨',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  material_received: {
    label: '자료 반영',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  classification_needed: {
    label: '계정 필요',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  journal_needed: {
    label: '전표 필요',
    className: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  journal_draft_ready: {
    label: '전표 초안',
    className: 'border-green-200 bg-green-50 text-green-700',
  },
}

function monthValue(fiscalYear: number, month: number) {
  return `${fiscalYear}-${String(month).padStart(2, '0')}`
}

export function buildLedgerPeriodOptions(fiscalYear: number): LedgerPeriodOption[] {
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const value = monthValue(fiscalYear, month)
    return {
      value,
      label: `${month}월`,
      shortLabel: `${month}월`,
      type: 'month' as const,
      start: value,
      end: value,
    }
  })

  return [
    {
      value: String(fiscalYear),
      label: `${fiscalYear}년`,
      shortLabel: '연간',
      type: 'year',
      start: monthValue(fiscalYear, 1),
      end: monthValue(fiscalYear, 12),
    },
    {
      value: `${fiscalYear}-H1`,
      label: '상반기',
      shortLabel: '상반기',
      type: 'half',
      start: monthValue(fiscalYear, 1),
      end: monthValue(fiscalYear, 6),
    },
    {
      value: `${fiscalYear}-H2`,
      label: '하반기',
      shortLabel: '하반기',
      type: 'half',
      start: monthValue(fiscalYear, 7),
      end: monthValue(fiscalYear, 12),
    },
    ...[1, 2, 3, 4].map((quarter) => {
      const startMonth = ((quarter - 1) * 3) + 1
      return {
        value: `${fiscalYear}-Q${quarter}`,
        label: `${quarter}분기`,
        shortLabel: `Q${quarter}`,
        type: 'quarter' as const,
        start: monthValue(fiscalYear, startMonth),
        end: monthValue(fiscalYear, startMonth + 2),
      }
    }),
    ...months,
  ]
}

export function resolveLedgerPeriodOption(fiscalYear: number, value: string): LedgerPeriodOption {
  const options = buildLedgerPeriodOptions(fiscalYear)
  return options.find((option) => option.value === value) ?? options[0]!
}

export function summarizeLedgerPeriod({
  fiscalYear,
  months,
  period,
}: {
  fiscalYear: number
  months: LedgerMonthView[]
  period: string
}) {
  const option = resolveLedgerPeriodOption(fiscalYear, period)
  const selectedMonths = months.filter((month) => month.periodMonth >= option.start && month.periodMonth <= option.end)
  const statusCounts = selectedMonths.reduce<Record<FiscalLedgerMonthStatus, number>>((acc, month) => {
    acc[month.status] += 1
    return acc
  }, {
    not_requested: 0,
    requested: 0,
    material_received: 0,
    classification_needed: 0,
    journal_needed: 0,
    journal_draft_ready: 0,
  })

  return {
    option,
    selectedMonths,
    statusCounts,
    totals: selectedMonths.reduce((acc, month) => ({
      sessionCount: acc.sessionCount + month.counts.sessionCount,
      includedMaterialCount: acc.includedMaterialCount + month.counts.includedMaterialCount,
      completedClassificationRunCount: acc.completedClassificationRunCount + month.counts.completedClassificationRunCount,
      journalEntryRunCount: acc.journalEntryRunCount + month.counts.journalEntryRunCount,
    }), {
      sessionCount: 0,
      includedMaterialCount: 0,
      completedClassificationRunCount: 0,
      journalEntryRunCount: 0,
    }),
  }
}
