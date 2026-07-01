import { fromISO } from '@/lib/time'

export type ApprovalPeriodFormat =
  | { label: string; isInvalid: false }
  | { label: '기간 확인 필요'; isInvalid: true }

const MISSING_REQUEST_COUNT_PATTERN = /(\d+)\s*개\s*항목/
const REASON_STRONG_PATTERN = /<strong>\s*\[([^\]]+)\]\s*([^<]+?)\s*<\/strong>/gi
const LEGACY_MISSING_STRONG_PATTERN = /<strong>\s*\[누락\]\s*([^(:<]+?)(?:\s*\(필수\))?\s*:\s*[^<]*<\/strong>/gi
const LEGACY_NON_COMPLIANT_STRONG_PATTERN = /<strong>\s*\[(?:불일치|자료 불일치|형식\/내용 불일치)\]\s*([^(:<]+?)(?:\s*\(필수\))?\s*:\s*[^<]*<\/strong>/gi
const LEGACY_ACTION_SPAN_PATTERN = /<span\b[^>]*>\s*요청:\s*[\s\S]*?<\/span>\s*(?:<br\s*\/?>)?/gi

export function formatApprovalQueuePeriod(period: string): ApprovalPeriodFormat {
  const value = period.trim()

  const monthly = /^(\d{4})-(\d{2})$/.exec(value)
  if (monthly) {
    const month = Number(monthly[2])
    if (month >= 1 && month <= 12) {
      return { label: `${monthly[1]}년 ${month}월`, isInvalid: false }
    }
  }

  const quarterly = /^(\d{4})-Q([1-4])$/.exec(value)
  if (quarterly) {
    return { label: `${quarterly[1]}년 ${quarterly[2]}분기`, isInvalid: false }
  }

  const halfYear = /^(\d{4})-H([12])$/.exec(value)
  if (halfYear) {
    return {
      label: `${halfYear[1]}년 ${halfYear[2] === '1' ? '상반기' : '하반기'}`,
      isInvalid: false,
    }
  }

  const annual = /^(\d{4})$/.exec(value)
  if (annual) {
    return { label: `${annual[1]}년`, isInvalid: false }
  }

  return { label: '기간 확인 필요', isInvalid: true }
}

export function formatApprovalQueueCreatedAt(createdAt: string) {
  return fromISO(createdAt).toFormat('MM/dd HH:mm')
}

export function normalizeApprovalEmailSubject(subject: string) {
  return subject
    .replace(/기장 자료 보충 요청 안내/g, '제출 자료 확인 안내')
    .replace(/보충 요청/g, '제출 자료 확인')
}

export function normalizeApprovalEmailBody(htmlBody: string) {
  return htmlBody
    .replace(LEGACY_MISSING_STRONG_PATTERN, (_match, item: string) => (
      `<strong>${stripInlineWhitespace(item)}</strong> <span style="display:inline-block;margin-left:6px;color:#b45309;">제출 없음</span><br />` +
      '<span style="color:#4b5563;">현재 제출 자료에서 확인되지 않았습니다.</span>'
    ))
    .replace(LEGACY_NON_COMPLIANT_STRONG_PATTERN, (_match, item: string) => (
      `<strong>${stripInlineWhitespace(item)}</strong> <span style="display:inline-block;margin-left:6px;color:#b45309;">확인 필요</span><br />` +
      '<span style="color:#4b5563;">제출 자료와 요청 항목의 연결을 확인해야 합니다.</span>'
    ))
    .replace(LEGACY_ACTION_SPAN_PATTERN, '')
    .replace(/\[누락\]/g, '제출 없음')
    .replace(/\((?:필수|선택|조건부)\)/g, '')
    .replace(/보완 자료/g, '자료')
    .replace(/재제출/g, '추가 업로드')
    .replace(
      /아래 업로드 링크에서 자료를 추가로 제출해 주세요\./g,
      '해당 자료가 있으시면 기한 내 기존 업로드 링크로 추가 업로드해 주세요. 자료가 없거나 관련 거래가 없다면 현재 제출해주신 자료를 기준으로 작업을 진행하겠습니다.',
    )
    .replace(
      /아래 업로드 링크에서 보완 자료를 추가로 제출해 주세요\./g,
      '해당 자료가 있으시면 기한 내 기존 업로드 링크로 추가 업로드해 주세요. 자료가 없거나 관련 거래가 없다면 현재 제출해주신 자료를 기준으로 작업을 진행하겠습니다.',
    )
}

export function summarizeApprovalEmailReason(criteriaSummary: string | null, htmlBody: string) {
  const normalizedCriteria = criteriaSummary?.trim()
  const criteriaCount = normalizedCriteria?.match(MISSING_REQUEST_COUNT_PATTERN)?.[1]
  if (criteriaCount) {
    return `확인 항목 ${criteriaCount}개`
  }

  const reasons = extractSupplementReasonsFromHtml(htmlBody)
  if (reasons.length > 0) {
    return reasons.slice(0, 2).join(' · ') + (reasons.length > 2 ? ` 외 ${reasons.length - 2}개` : '')
  }

  if (normalizedCriteria) return normalizedCriteria
  return '제출자료 확인'
}

export function extractSupplementReasonsFromHtml(htmlBody: string) {
  const reasons: string[] = []
  for (const match of htmlBody.matchAll(REASON_STRONG_PATTERN)) {
    const status = normalizeCustomerNoticeStatus(stripInlineWhitespace(match[1] ?? ''))
    const item = stripInlineWhitespace(match[2] ?? '')
    if (!status && !item) continue
    reasons.push(`${status} ${item}`.trim())
  }
  return Array.from(new Set(reasons))
}

function normalizeCustomerNoticeStatus(status: string) {
  if (status === '누락') return '제출 없음'
  if (status === '불일치' || status.includes('불일치')) return '확인 필요'
  return status
}

function stripInlineWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}
