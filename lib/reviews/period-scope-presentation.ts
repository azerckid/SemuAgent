import type { ReviewMaterialAttributionSummary } from './review-workspace-types'

export function hasRequestedPeriodDataGap(summary: ReviewMaterialAttributionSummary): boolean {
  return summary.total > 0 && summary.requestedInPeriod === 0
}

/** 보충요청(기간 부재)은 클라이언트가 실제로 파일을 올린 뒤에만 생성한다. */
export function shouldCreatePeriodGapMissingRequestDraft(
  summary: ReviewMaterialAttributionSummary,
  uploadedFileCount: number,
): boolean {
  return hasRequestedPeriodDataGap(summary) && uploadedFileCount > 0
}

export function formatRequestedPeriodForDisplay(requestedPeriod: string): string {
  const match = requestedPeriod.match(/^(20\d{2})-(\d{2})$/)
  if (!match) return requestedPeriod
  return `${Number(match[2])}월`
}

function uniqueSortedPeriods(periods: readonly string[] | null | undefined) {
  return [...new Set(periods ?? [])]
    .filter((period) => /^(20\d{2})-(0[1-9]|1[0-2])$/.test(period))
    .sort()
}

export function formatAttributionPeriodsForSentence(
  periods: readonly string[] | null | undefined,
  options: { yearOnlyWhenSameYear?: boolean } = {},
): string | null {
  const unique = uniqueSortedPeriods(periods)
  if (unique.length === 0) return null

  const years = [...new Set(unique.map((period) => period.slice(0, 4)))]
  if (options.yearOnlyWhenSameYear && years.length === 1) {
    return `${years[0]}년`
  }

  if (unique.length === 1) return unique[0]
  return `${unique[0]}~${unique[unique.length - 1]}`
}

export function buildRequestedPeriodGapMessageLines(
  summary: ReviewMaterialAttributionSummary,
): string[] {
  const lines = [
    `요청 기간(${summary.requestedPeriod})에 해당하는 거래가 확인되지 않습니다.`,
  ]

  if (summary.outOfScope > 0 && summary.inCloseWindow === 0) {
    const outOfScopePeriod = formatAttributionPeriodsForSentence(summary.outOfScopePeriods, {
      yearOnlyWhenSameYear: true,
    })
    lines.push(
      outOfScopePeriod
        ? `업로드된 자료는 ${outOfScopePeriod} 거래로 판단되어 마감범위(${summary.closePeriod}) 밖입니다.`
        : `업로드된 자료는 마감범위(${summary.closePeriod}) 밖 거래로 판단됩니다.`,
    )
  } else if (summary.inCloseWindow > 0 && summary.outOfScope === 0) {
    const inCloseWindowPeriod = formatAttributionPeriodsForSentence(summary.inCloseWindowPeriods)
    lines.push(
      inCloseWindowPeriod
        ? `업로드된 자료는 ${inCloseWindowPeriod} 거래로 판단되며 마감범위(${summary.closePeriod}) 안이지만 요청 기간(${summary.requestedPeriod}) 거래가 아닙니다.`
        : `업로드된 자료는 마감범위(${summary.closePeriod}) 안 자료이지만 요청 기간(${summary.requestedPeriod}) 거래가 아닙니다.`,
    )
  } else if (summary.inCloseWindow > 0 && summary.outOfScope > 0) {
    lines.push(
      `업로드된 자료에는 마감범위(${summary.closePeriod}) 안 다른 기간 자료 ${summary.inCloseWindow.toLocaleString('ko-KR')}건과 마감범위 밖 자료 ${summary.outOfScope.toLocaleString('ko-KR')}건이 함께 있습니다.`,
    )
  } else {
    lines.push(`업로드된 자료에서 요청 기간(${summary.requestedPeriod}) 거래를 확인하지 못했습니다.`)
  }

  lines.push(`${summary.requestedPeriod} 자료를 보충 요청해 주세요.`)
  return lines
}

export type RequestedPeriodGapPresentation = {
  headline: string
  messageLines: string[]
  periodContext: string
  scopeDetail: string | null
  tone: 'warning' | 'destructive'
}

export function buildRequestedPeriodGapPresentation(
  summary: ReviewMaterialAttributionSummary,
): RequestedPeriodGapPresentation | null {
  if (!hasRequestedPeriodDataGap(summary)) return null

  const periodLabel = formatRequestedPeriodForDisplay(summary.requestedPeriod)
  const scopeParts: string[] = []
  if (summary.inCloseWindow > 0) scopeParts.push(`마감범위 안 ${summary.inCloseWindow}건`)
  if (summary.outOfScope > 0) scopeParts.push(`마감범위 밖 ${summary.outOfScope}건`)
  const messageLines = buildRequestedPeriodGapMessageLines(summary)

  return {
    headline: messageLines[0] ?? `요청 기간(${periodLabel})에 해당하는 거래가 확인되지 않습니다.`,
    messageLines,
    periodContext: `요청월 ${summary.requestedPeriod} · 마감범위 ${summary.closePeriod}`,
    scopeDetail: scopeParts.length > 0 ? scopeParts.join(' · ') : null,
    tone: summary.outOfScope > 0 ? 'destructive' : 'warning',
  }
}

export function buildRequestedPeriodGapStatusDetail(summary: ReviewMaterialAttributionSummary): string {
  const parts = [`요청 기간(${summary.requestedPeriod}) 해당 거래 없음`]
  if (summary.inCloseWindow > 0) parts.push(`마감범위 안 ${summary.inCloseWindow}건`)
  if (summary.outOfScope > 0) parts.push(`마감범위 밖 ${summary.outOfScope}건`)
  return parts.join(' · ')
}

export type PeriodGapEmailVariant = 'missing_requested_month' | 'wrong_period_entirely' | 'mixed'

export function derivePeriodGapEmailVariant(summary: ReviewMaterialAttributionSummary): PeriodGapEmailVariant | null {
  if (!hasRequestedPeriodDataGap(summary)) return null
  if (summary.inCloseWindow > 0 && summary.outOfScope > 0) return 'mixed'
  if (summary.outOfScope > 0) return 'wrong_period_entirely'
  return 'missing_requested_month'
}

export function buildRequestedPeriodPromptBlockMessage(summary: ReviewMaterialAttributionSummary): string {
  return `${buildRequestedPeriodGapMessageLines(summary).join(' ')} 프롬프트 추출은 보충 자료 업로드 후 다시 시도해 주세요.`
}
