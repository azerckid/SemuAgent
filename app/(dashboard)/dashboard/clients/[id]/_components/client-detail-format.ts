import { type DateTime, fromISO } from '@/lib/time'

export const STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  requested: '업로드 대기',
  active: '업로드 중',
  submitted: '제출 완료',
  ai_checking: 'AI 판단 중',
  needs_resubmission: '보충 요청 필요',
  ready_for_accountant: '검토 가능',
  completed: '완료',
  expired: '만료',
  revoked: '취소',
}

export const STATUS_STYLE: Record<string, string> = {
  completed: 'border-green-200 bg-green-50 text-green-700',
  ready_for_accountant: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  active: 'border-blue-200 bg-blue-50 text-blue-700',
  ai_checking: 'border-blue-200 bg-blue-50 text-blue-700',
  submitted: 'border-violet-200 bg-violet-50 text-violet-700',
  needs_resubmission: 'border-amber-200 bg-amber-50 text-amber-700',
  requested: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  expired: 'border-gray-200 bg-gray-50 text-gray-500',
  revoked: 'border-red-200 bg-red-50 text-red-700',
  draft: 'border-gray-200 bg-gray-50 text-gray-500',
}

export const FREQUENCY_TABS = [
  { label: '월별', value: 'monthly' },
  { label: '분기별', value: 'quarterly' },
  { label: '반기별', value: 'semiannual' },
  { label: '연간', value: 'annual' },
]

export const FREQUENCY_LABEL: Record<string, string> = {
  monthly: '월별',
  quarterly: '분기별',
  semiannual: '반기별',
  annual: '연간',
  custom: '기타',
}

export const EVENT_STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  draft_ready: '초안 준비',
  sent: '발송됨',
  waiting_upload: '업로드 대기',
  analyzing: '분석 중',
  needs_review: '검토필요',
  cancelled: '취소됨',
  draft: '초안 준비',
  requested: '업로드 대기',
  active: '업로드 대기',
  submitted: '제출 확인',
  ai_checking: '분석 중',
  needs_resubmission: '검토필요',
  ready_for_accountant: '검토필요',
  completed: '완료',
  expired: '만료',
  revoked: '취소',
}

export const EVENT_STATUS_STYLE: Record<string, string> = {
  scheduled: 'border-gray-200 bg-gray-50 text-gray-500',
  draft_ready: 'border-sky-200 bg-sky-50 text-sky-700',
  sent: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  waiting_upload: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  analyzing: 'border-blue-200 bg-blue-50 text-blue-700',
  needs_review: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-green-200 bg-green-50 text-green-700',
  expired: 'border-gray-200 bg-gray-50 text-gray-500',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
}

export function getAiSummary(files: Array<{ status: string }>) {
  if (files.length === 0) {
    return { label: '파일 없음', detail: '업로드 대기', style: 'border-gray-200 bg-gray-50 text-gray-500' }
  }

  const running = files.filter((file) => file.status === 'uploaded' || file.status === 'analyzing').length
  const review = files.filter((file) => file.status === 'needs_review').length
  const failed = files.filter((file) => file.status === 'failed' || file.status === 'rejected').length
  const matched = files.filter((file) => file.status === 'matched').length

  if (running > 0) {
    return { label: 'AI 판단 중', detail: `${running}/${files.length}개 진행`, style: 'border-blue-200 bg-blue-50 text-blue-700' }
  }

  if (failed > 0) {
    return { label: '분석 실패', detail: `${failed}/${files.length}개 실패`, style: 'border-red-200 bg-red-50 text-red-700' }
  }

  if (review > 0) {
    return { label: '검토필요', detail: `${review}/${files.length}개 검토`, style: 'border-amber-200 bg-amber-50 text-amber-700' }
  }

  return { label: 'AI 확인 완료', detail: `${matched}/${files.length}개 완료`, style: 'border-green-200 bg-green-50 text-green-700' }
}

export function getMonthSlots(anchor: DateTime) {
  const start = anchor.startOf('month').minus({ months: 2 })
  return Array.from({ length: 6 }, (_, index) => {
    const month = start.plus({ months: index })
    return {
      key: month.toFormat('yyyy-MM'),
      label: month.toFormat('yyyy년 M월'),
      shortLabel: month.toFormat('M월'),
      isCurrent: month.hasSame(anchor, 'month'),
    }
  })
}

export function getAccountingFrequency(period: string) {
  if (/^\d{4}-\d{2}$/.test(period)) return 'monthly'
  if (/^\d{4}-Q[1-4]$/.test(period)) return 'quarterly'
  if (/^\d{4}-H[1-2]$/.test(period)) return 'semiannual'
  if (/^\d{4}$/.test(period)) return 'annual'
  return 'custom'
}

export function getPeriodTitle(period: string) {
  const frequency = getAccountingFrequency(period)

  if (frequency === 'quarterly') {
    const [year, quarter] = period.split('-Q')
    return `${year}년 ${quarter}분기`
  }

  if (frequency === 'semiannual') {
    const [year, half] = period.split('-H')
    return `${year}년 ${half === '1' ? '상반기' : '하반기'}`
  }

  if (frequency === 'annual') {
    return `${period}년`
  }

  if (frequency === 'monthly') {
    return fromISO(`${period}-01`).toFormat('yyyy년 M월')
  }

  return period
}
