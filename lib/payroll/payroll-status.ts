import { formatPayrollExtractionMessageForDisplay } from '@/lib/payroll/extraction-message'
import {
  isPayrollRunningBatchStale,
  PAYROLL_RUNNING_BATCH_STALE_MINUTES,
} from '@/lib/payroll/extraction-status'
import { now, type DateTime } from '@/lib/time'
import { STATUS_TONE_CLASS, type DisplayStatus } from '@/lib/status-tone'

export type PayrollDisplayStatus = DisplayStatus

export const PAYROLL_STATUS_TONE_CLASS = STATUS_TONE_CLASS

export const PAYROLL_SESSION_STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  requested: '제출 없음',
  active: '업로드 중',
  submitted: '제출 완료',
  ai_checking: 'AI 판단 중',
  needs_resubmission: '자료 보완 필요',
  ready_for_accountant: '매칭 완료',
  completed: '완료',
  expired: '만료',
  revoked: '취소',
}

export const PAYROLL_EVENT_STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  draft_ready: '초안 준비',
  sent: '요청 발송',
  waiting_upload: '업로드 대기',
  submitted: '제출 완료',
  analyzing: '분석 중',
  needs_review: '검토 필요',
  completed: '완료',
  expired: '만료',
  cancelled: '취소',
}

export const PAYROLL_BATCH_STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  running: '추출 중',
  needs_review: '판정 완료',
  completed: '판정 완료',
  failed: '실패',
}

export type PayrollStatusInput = {
  failCount: number
  passCount: number
  generatedDraft: boolean
  batch: {
    status: string
    errorMessage: string | null
    createdAt: string
  } | null
  sessionStatus: string | null
  emailStatus: string | null
  eventStatus: string
  referenceTime?: DateTime
}

export function derivePayrollDisplayStatus(input: PayrollStatusInput): PayrollDisplayStatus {
  if (input.failCount > 0) {
    return {
      label: '부적합',
      detail: `${input.failCount}개 row 보완 필요`,
      tone: 'destructive',
    }
  }

  if (input.generatedDraft) {
    return {
      label: '엑셀 생성',
      detail: '결과 엑셀 초안 다운로드 가능',
      tone: 'success',
    }
  }

  if (input.passCount > 0) {
    return {
      label: '작성 가능',
      detail: '모든 row 적합, 세션 상세에서 초안 작성 가능',
      tone: 'success',
    }
  }

  if (input.batch?.status === 'failed') {
    return {
      label: '추출 실패',
      detail: formatPayrollExtractionMessageForDisplay(input.batch.errorMessage) ?? '자동 추출 실패',
      tone: 'destructive',
    }
  }

  if (isPayrollRunningBatchStale(input.batch, input.referenceTime ?? now())) {
    return {
      label: '재추출 필요',
      detail: `추출이 ${PAYROLL_RUNNING_BATCH_STALE_MINUTES}분 이상 완료되지 않았습니다. 다시 추출해 주세요.`,
      tone: 'warning',
    }
  }

  if (input.batch?.status === 'running' || input.batch?.status === 'pending') {
    return {
      label: '추출 중',
      detail: PAYROLL_BATCH_STATUS_LABEL[input.batch.status] ?? input.batch.status,
      tone: 'info',
    }
  }

  if (input.sessionStatus === 'submitted' || input.sessionStatus === 'ai_checking') {
    return {
      label: '추출 대기',
      detail: '업로드 제출 완료, 급여 추출 결과 대기',
      tone: 'warning',
    }
  }

  if (input.sessionStatus) {
    return {
      label: PAYROLL_SESSION_STATUS_LABEL[input.sessionStatus] ?? input.sessionStatus,
      detail: '고객사 업로드 진행 중',
      tone: 'warning',
    }
  }

  if (input.emailStatus === 'sent' || input.eventStatus === 'sent' || input.eventStatus === 'waiting_upload') {
    return {
      label: '제출 없음',
      detail: '자료 요청 메일 발송 후 고객사 제출 대기',
      tone: 'warning',
    }
  }

  return {
    label: PAYROLL_EVENT_STATUS_LABEL[input.eventStatus] ?? input.eventStatus,
    detail: '급여 자료 요청 준비',
    tone: 'default',
  }
}

// `자료 상태` 컬럼/팝업 전용. derivePayrollDisplayStatus와 달리 추출·엑셀 진행
// 정보를 섞지 않고 업로드 자료(세션/메일/이벤트) 상태만 표시한다.
export type PayrollMaterialStatusInput = {
  sessionStatus: string | null
  emailStatus: string | null
  eventStatus: string
  isOverdue: boolean
}

export function derivePayrollMaterialStatus(input: PayrollMaterialStatusInput): PayrollDisplayStatus {
  if (input.sessionStatus === 'needs_resubmission') {
    return { label: '자료 보완 필요', detail: '고객사가 다시 업로드해야 합니다', tone: 'destructive' }
  }

  if (input.sessionStatus === 'revoked' || input.eventStatus === 'cancelled') {
    return { label: '취소', detail: '요청이 취소되었습니다', tone: 'default' }
  }

  if (input.sessionStatus === 'expired' || input.eventStatus === 'expired') {
    return { label: '만료', detail: '제출 기한이 지났습니다', tone: 'default' }
  }

  if (
    input.sessionStatus === 'submitted'
    || input.sessionStatus === 'ai_checking'
    || input.sessionStatus === 'ready_for_accountant'
    || input.sessionStatus === 'completed'
  ) {
    return { label: '제출 완료', detail: '고객사 업로드 완료', tone: 'success' }
  }

  if (input.isOverdue) {
    return { label: '기한 경과', detail: '제출기한을 지나 아직 자료가 제출되지 않았습니다', tone: 'destructive' }
  }

  if (
    input.sessionStatus === 'active'
    || input.sessionStatus === 'draft'
    || input.sessionStatus === 'requested'
  ) {
    return {
      label: PAYROLL_SESSION_STATUS_LABEL[input.sessionStatus] ?? input.sessionStatus,
      detail: '고객사 업로드 진행 중',
      tone: 'warning',
    }
  }

  if (input.emailStatus === 'sent' || input.eventStatus === 'sent' || input.eventStatus === 'waiting_upload') {
    return { label: '제출 없음', detail: '자료 요청 메일 발송 후 고객사 제출 대기', tone: 'warning' }
  }

  return {
    label: PAYROLL_EVENT_STATUS_LABEL[input.eventStatus] ?? input.eventStatus,
    detail: '급여 자료 요청 준비',
    tone: 'default',
  }
}

// `추출 상태` 컬럼/팝업 전용. payroll extraction batch와 row 판정만 본다.
export type PayrollExtractionStatusInput = {
  failCount: number
  passCount: number
  batch: {
    status: string
    errorMessage: string | null
  } | null
  isBatchStale: boolean
}

export function derivePayrollExtractionStatus(input: PayrollExtractionStatusInput): PayrollDisplayStatus {
  if (input.failCount > 0) {
    return { label: '부적합', detail: `${input.failCount}개 row 보완 필요`, tone: 'destructive' }
  }

  if (input.batch?.status === 'failed') {
    return {
      label: '추출 실패',
      detail: formatPayrollExtractionMessageForDisplay(input.batch.errorMessage) ?? '자동 추출 실패',
      tone: 'destructive',
    }
  }

  if (input.isBatchStale) {
    return {
      label: '재추출 필요',
      detail: `추출이 ${PAYROLL_RUNNING_BATCH_STALE_MINUTES}분 이상 완료되지 않았습니다. 다시 추출해 주세요.`,
      tone: 'warning',
    }
  }

  if (input.batch?.status === 'running' || input.batch?.status === 'pending') {
    return {
      label: '추출 중',
      detail: PAYROLL_BATCH_STATUS_LABEL[input.batch.status] ?? input.batch.status,
      tone: 'info',
    }
  }

  if (input.passCount > 0) {
    return { label: '판정 완료', detail: `${input.passCount}명 적합`, tone: 'success' }
  }

  return { label: '추출 전', detail: '아직 자동 추출을 실행하지 않았습니다', tone: 'default' }
}

// `엑셀 상태` 컬럼/팝업 전용. payroll excel draft 생성/다운로드 상태만 본다.
export type PayrollExcelStatusInput = {
  generatedDraft: boolean
  failCount: number
  passCount: number
  resultDownloadState: {
    enabled: boolean
    detail: string
  }
}

export function derivePayrollExcelStatus(input: PayrollExcelStatusInput): PayrollDisplayStatus {
  if (input.generatedDraft) {
    return {
      label: '엑셀 생성',
      detail: input.resultDownloadState.enabled ? '결과 엑셀 초안 다운로드 가능' : input.resultDownloadState.detail,
      tone: input.resultDownloadState.enabled ? 'success' : 'warning',
    }
  }

  if (input.failCount > 0) {
    return { label: '작성 불가', detail: `부적합 ${input.failCount}개 보완 후 작성 가능`, tone: 'destructive' }
  }

  if (input.passCount > 0) {
    return { label: '작성 가능', detail: '모든 row 적합, 결과 엑셀 작성 가능', tone: 'success' }
  }

  return { label: '대기', detail: '추출 완료 후 결과 엑셀을 작성할 수 있습니다', tone: 'default' }
}
