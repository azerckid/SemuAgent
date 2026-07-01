import type { ReviewMaterialAttributionSummary } from '@/lib/reviews/review-workspace-types'
import {
  derivePeriodGapEmailVariant,
  formatAttributionPeriodsForSentence,
  type PeriodGapEmailVariant,
} from '@/lib/reviews/period-scope-presentation'
import { formatAccountingPeriod } from './templates'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export const PERIOD_GAP_MISSING_REQUEST_CRITERIA_PREFIX = '요청 기간 부재'

export function isPeriodGapMissingRequestCriteriaSummary(criteriaSummary: string | null | undefined): boolean {
  return Boolean(criteriaSummary?.startsWith(PERIOD_GAP_MISSING_REQUEST_CRITERIA_PREFIX))
}

function variantCriteriaSummary(variant: PeriodGapEmailVariant): string {
  if (variant === 'missing_requested_month') return '요청 기간 부재 — 요청월 자료 추가 요청'
  if (variant === 'wrong_period_entirely') return '요청 기간 부재 — 기간 불일치 자료 안내'
  return '요청 기간 부재 — 요청월 부재 및 기간 불일치 혼재'
}

function buildBodyParagraphs(params: {
  variant: PeriodGapEmailVariant
  summary: ReviewMaterialAttributionSummary
  formattedPeriod: string
  contactName: string
  staffName: string
  uploadLinkText: string
}): string {
  const { variant, summary, formattedPeriod, contactName, staffName, uploadLinkText } = params
  const closePeriod = escapeHtml(summary.closePeriod)
  const requestedPeriod = escapeHtml(summary.requestedPeriod)
  const outOfScopePeriod = formatAttributionPeriodsForSentence(summary.outOfScopePeriods, {
    yearOnlyWhenSameYear: true,
  })
  const inCloseWindowPeriod = formatAttributionPeriodsForSentence(summary.inCloseWindowPeriods)

  const intro = `<p>안녕하세요, ${escapeHtml(contactName)} 담당자님.</p>
    <p>제출해 주신 ${escapeHtml(formattedPeriod)} 자료를 확인했습니다.</p>`

  let reason = ''
  if (variant === 'missing_requested_month') {
    const periodSentence = inCloseWindowPeriod
      ? `업로드된 자료는 <strong>${escapeHtml(inCloseWindowPeriod)} 거래</strong>로 판단되며 마감범위(${closePeriod}) 안이지만 요청 기간(${requestedPeriod}) 거래가 아닙니다.`
      : `업로드된 자료는 마감범위(${closePeriod}) 안 자료이지만 요청 기간(${requestedPeriod}) 거래가 아닙니다.`
    reason = `<p>요청 기간(<strong>${requestedPeriod}</strong>)에 해당하는 거래가 확인되지 않습니다. ${periodSentence} <strong>${requestedPeriod} 자료</strong>를 기존 업로드 링크로 보충 업로드해 주세요.</p>`
  } else if (variant === 'wrong_period_entirely') {
    const periodSentence = outOfScopePeriod
      ? `업로드된 자료는 <strong>${escapeHtml(outOfScopePeriod)} 거래</strong>로 판단되어 마감범위(${closePeriod}) 밖입니다.`
      : `업로드된 자료는 마감범위(${closePeriod}) 밖 거래로 판단됩니다.`
    reason = `<p>요청 기간(<strong>${requestedPeriod}</strong>)에 해당하는 거래가 확인되지 않습니다. ${periodSentence} <strong>${requestedPeriod} 자료</strong>를 기존 업로드 링크로 보충 업로드해 주세요.</p>`
  } else {
    reason = `<p>요청 기간(<strong>${requestedPeriod}</strong>)에 해당하는 거래가 확인되지 않습니다. 업로드된 자료에는 마감범위(${closePeriod}) 안 다른 기간 자료 ${summary.inCloseWindow.toLocaleString('ko-KR')}건과 마감범위 밖 자료 ${summary.outOfScope.toLocaleString('ko-KR')}건이 함께 있습니다. <strong>${requestedPeriod} 자료</strong>를 기존 업로드 링크로 보충 업로드해 주세요.</p>`
  }

  const outro = `<p>해당 자료가 없거나 관련 거래가 없다면 현재 제출해 주신 자료를 기준으로 작업을 진행하겠습니다.</p>
    <p><a href="${escapeHtml(uploadLinkText)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;">자료 업로드하기</a></p>
    <p>감사합니다.<br />${escapeHtml(staffName)} 드림</p>`

  return `${intro}${reason}${outro}`
}

export function buildPeriodGapMissingRequestDraft(params: {
  clientName: string
  contactName: string | null
  staffName: string
  accountingPeriod: string
  uploadUrl: string | null
  uploadBaseUrl: string
  summary: ReviewMaterialAttributionSummary
}) {
  const variant = derivePeriodGapEmailVariant(params.summary)
  if (!variant) return null

  const formattedPeriod = formatAccountingPeriod(params.accountingPeriod)
  const uploadLinkText = params.uploadUrl ?? `${params.uploadBaseUrl}/upload`
  const contactName = params.contactName ?? params.clientName

  const subject = `[${params.clientName}] ${formattedPeriod} 요청 기간 자료 안내`
  const bodyHtml = `
    <div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;line-height:1.6;">
      ${buildBodyParagraphs({
        variant,
        summary: params.summary,
        formattedPeriod,
        contactName,
        staffName: params.staffName,
        uploadLinkText,
      })}
    </div>`

  return {
    subject,
    bodyHtml,
    criteriaSummary: variantCriteriaSummary(variant),
  }
}
