import { fromISO, now } from '@/lib/time'
import { classifyReviewFile, type ReviewFileClassification } from './review-file-classification'
import { isStaffExcludedUnlinkedFile } from './unlinked-file-review'
import type {
  ReviewFile,
  ReviewSession,
  ReviewValidation,
} from './review-workspace-types'

export type SubmissionStatusKey = 'submitted' | 'none' | 'needs_check'

export const submissionStatusConfig: Record<SubmissionStatusKey, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  submitted: { label: '제출 확인', variant: 'success' },
  none: { label: '제출 없음', variant: 'secondary' },
  needs_check: { label: '검토필요', variant: 'warning' },
}

const reasonPrefix: Record<string, string> = {
  partially_satisfied: '일부 충족',
  missing: '누락',
  non_compliant: '불일치',
  uncertain: '판독 불가',
}

export const requirednessConfig: Record<string, { label: string; variant: 'secondary' | 'outline' }> = {
  required: { label: '요청 항목', variant: 'secondary' },
  conditional: { label: '조건부 요청', variant: 'secondary' },
  optional: { label: '참고 항목', variant: 'outline' },
}

const FAILED_FILE_STATUSES = ['failed', 'rejected'] as const
const AI_CHECKING_GRACE_MS = 3 * 60 * 1000

function isMaterialValidation(validation: ReviewValidation) {
  return validation.criterionType === 'material' || validation.criterionType === null
}

function isReviewFile(value: ReviewFile | undefined): value is ReviewFile {
  return Boolean(value)
}

function inferValidationGroup(validation: ReviewValidation) {
  if (
    validation.itemGroup === 'bank_statement' ||
    validation.itemGroup === 'card_statement' ||
    validation.itemGroup === 'sales_tax_invoice' ||
    validation.itemGroup === 'purchase_tax_invoice' ||
    validation.itemGroup === 'cash_receipt' ||
    validation.itemGroup === 'online_sales_pg_settlement' ||
    validation.itemGroup === 'journal_entry_workbook' ||
    validation.itemGroup === 'other_evidence'
  ) {
    return validation.itemGroup
  }

  const itemName = validation.itemName.normalize('NFC')
  if (itemName.includes('통장 거래내역')) return 'bank_statement'
  if (itemName.includes('카드 사용내역')) return 'card_statement'
  if (itemName.includes('매출 세금계산서')) return 'sales_tax_invoice'
  if (itemName.includes('매입 세금계산서')) return 'purchase_tax_invoice'
  if (itemName.includes('현금영수증')) return 'cash_receipt'
  if (itemName.includes('온라인 매출/PG 정산자료')) return 'online_sales_pg_settlement'
  if (itemName.includes('전표·입출금') || itemName.includes('전표 입출금')) return 'journal_entry_workbook'
  if (itemName.includes('기타 증빙자료')) return 'other_evidence'

  return validation.itemGroup
}

function fileMatchesValidationGroup(file: ReviewFile, validation: ReviewValidation, session: ReviewSession) {
  const classification = classifyReviewFile(file, session)
  const validationGroup = inferValidationGroup(validation)
  return classification.status === 'suitable' &&
    classification.criterionGroup !== null &&
    classification.criterionGroup === validationGroup
}

function getSubmissionStatusKey(
  validation: ReviewValidation,
  displayMatchedFiles: ReviewFile[],
  hasDeterministicCorrection: boolean,
): SubmissionStatusKey {
  if (displayMatchedFiles.length === 0) return 'none'
  if (hasDeterministicCorrection || validation.validationStatus === 'satisfied') return 'submitted'
  return 'needs_check'
}

export function getSubmissionMemo(
  validation: ReviewValidation,
  submissionStatusKey: SubmissionStatusKey,
  hasDeterministicCorrection: boolean,
) {
  if (hasDeterministicCorrection) {
    return '파일명과 AI 분석 결과 기준으로 요청자료에 연결되었습니다.'
  }

  if (submissionStatusKey === 'submitted') {
    return '제출된 자료가 요청 기준에 연결되었습니다.'
  }

  if (submissionStatusKey === 'none') {
    return validation.requiredness === 'optional'
      ? '참고 항목입니다. 제출되지 않아도 바로 보충 요청으로 판단하지 않습니다.'
      : '제출된 파일이 없습니다. 해당 활동이 없으면 정상일 수 있으며, 필요 시 담당자가 확인합니다.'
  }

  return [reasonPrefix[validation.validationStatus], validation.requestedAction ?? validation.aiReasoning ?? '담당자 확인이 필요합니다.']
    .filter(Boolean)
    .join(' · ')
}

export function formatRequestItemName(itemName: string) {
  const withoutDescription = itemName.normalize('NFC').trim().split(':')[0]?.trim() ?? itemName.trim()
  return withoutDescription
    .replace(/\s*\((필수|선택|조건부|요청 항목|조건부 요청|참고 항목)\)\s*$/g, '')
    .trim()
}

export type ReviewSubmissionPresentation = {
  rows: ReviewValidation[]
  presentedRows: Array<{
    validation: ReviewValidation
    displayMatchedFiles: ReviewFile[]
    memo: string
    requiredness: { label: string; variant: 'secondary' | 'outline' }
    submissionStatus: { label: string; variant: 'success' | 'warning' | 'secondary' }
    submissionStatusKey: SubmissionStatusKey
  }>
  unlinkedFiles: Array<{
    file: ReviewFile
    classification: ReviewFileClassification
    badgeLabel: string
    badgeVariant: 'destructive' | 'warning' | 'secondary'
  }>
  linkedFileCount: number
  submittedCount: number
  noSubmissionCount: number
  needsCheckCount: number
  actionableUnlinkedCount: number
}

function getUnlinkedFileBadge(classification: ReviewFileClassification): {
  badgeLabel: string
  badgeVariant: 'destructive' | 'warning' | 'secondary'
} {
  if (classification.status === 'unsuitable') {
    return { badgeLabel: '잘못 올린 파일', badgeVariant: 'destructive' }
  }

  if (classification.status === 'password_required') {
    return { badgeLabel: '비밀번호 필요', badgeVariant: 'warning' }
  }

  if (classification.status === 'password_invalid') {
    return { badgeLabel: '비밀번호 오류', badgeVariant: 'destructive' }
  }

  if (classification.status === 'pending') {
    return { badgeLabel: '판정 대기', badgeVariant: 'warning' }
  }

  return { badgeLabel: '연결 필요', badgeVariant: 'warning' }
}

export function countActionableUnlinkedFiles(
  unlinkedFiles: ReviewSubmissionPresentation['unlinkedFiles'],
) {
  return unlinkedFiles.filter((entry) => !isStaffExcludedUnlinkedFile(entry.file)).length
}

export function buildReviewSubmissionPresentation(session: ReviewSession): ReviewSubmissionPresentation {
  const fileById = new Map(session.files.map((file) => [file.id, file]))
  const materialRows = session.validations.filter(isMaterialValidation)
  const rows = materialRows.length > 0 ? materialRows : session.validations
  const visibleValidationIds = new Set(rows.map((validation) => validation.id))
  const usableLinkedFileIds = new Set(
    session.validationFiles
      .filter((link) => (
        visibleValidationIds.has(link.validationId) &&
        (link.contribution === 'satisfied' || link.contribution === 'partial')
      ))
      .map((link) => link.uploadFileId),
  )
  const presentedRows = rows.map((validation) => {
    const matchedFiles = session.validationFiles
      .filter((link) => (
        link.validationId === validation.id &&
        (link.contribution === 'satisfied' || link.contribution === 'partial')
      ))
      .map((link) => fileById.get(link.uploadFileId))
      .filter(isReviewFile)
    const deterministicMatchedFiles = session.files.filter((file) => (
      !matchedFiles.some((matchedFile) => matchedFile.id === file.id) &&
      fileMatchesValidationGroup(file, validation, session)
    ))
    const displayMatchedFiles = [...matchedFiles, ...deterministicMatchedFiles]
    const hasDeterministicCorrection = deterministicMatchedFiles.length > 0 &&
      ['missing', 'non_compliant', 'uncertain'].includes(validation.validationStatus)
    const submissionStatusKey = getSubmissionStatusKey(validation, displayMatchedFiles, hasDeterministicCorrection)
    const requiredness = requirednessConfig[validation.requiredness] ?? {
      label: validation.requiredness,
      variant: 'secondary' as const,
    }

    return {
      validation,
      displayMatchedFiles,
      memo: getSubmissionMemo(validation, submissionStatusKey, hasDeterministicCorrection),
      requiredness,
      submissionStatus: submissionStatusConfig[submissionStatusKey],
      submissionStatusKey,
    }
  })
  const displayedFileIds = new Set(
    presentedRows.flatMap((row) => row.displayMatchedFiles.map((file) => file.id)),
  )
  for (const fileId of usableLinkedFileIds) {
    if (fileById.has(fileId)) displayedFileIds.add(fileId)
  }
  const unlinkedFiles = session.files
    .filter((file) => !displayedFileIds.has(file.id))
    .map((file) => {
      const classification = classifyReviewFile(file, session)
      return {
        file,
        classification,
        ...getUnlinkedFileBadge(classification),
      }
    })

  return {
    rows,
    presentedRows,
    unlinkedFiles,
    linkedFileCount: displayedFileIds.size,
    submittedCount: presentedRows.filter((row) => row.submissionStatusKey === 'submitted').length,
    noSubmissionCount: presentedRows.filter((row) => row.submissionStatusKey === 'none').length,
    needsCheckCount: presentedRows.filter((row) => row.submissionStatusKey === 'needs_check').length,
    actionableUnlinkedCount: countActionableUnlinkedFiles(unlinkedFiles),
  }
}

function isRecentAnalysis(value: string | null) {
  if (!value) return false
  const parsed = fromISO(value)
  if (!parsed.isValid) return false
  return now().toMillis() - parsed.toMillis() < AI_CHECKING_GRACE_MS
}

function buildSubmissionSummaryDetail(presentation: ReviewSubmissionPresentation) {
  const parts = [
    `제출 확인 ${presentation.submittedCount}개`,
    `제출 없음 ${presentation.noSubmissionCount}개`,
  ]
  if (presentation.needsCheckCount > 0) parts.push(`검토필요 ${presentation.needsCheckCount}개`)
  if (presentation.actionableUnlinkedCount > 0) parts.push(`미연결 파일 ${presentation.actionableUnlinkedCount}개`)
  return parts.join(' · ')
}

function buildSubmissionStatusDetail(presentation: ReviewSubmissionPresentation) {
  if (presentation.needsCheckCount > 0 || presentation.actionableUnlinkedCount > 0) {
    const focusParts = []
    if (presentation.needsCheckCount > 0) focusParts.push(`검토필요 ${presentation.needsCheckCount}개`)
    if (presentation.actionableUnlinkedCount > 0) focusParts.push(`미연결 파일 ${presentation.actionableUnlinkedCount}개`)
    return `${focusParts.join(', ')} 항목을 아래 제출 현황에서 확인해 주세요.`
  }

  if (presentation.noSubmissionCount > 0) {
    return `제출 없음 ${presentation.noSubmissionCount}개 항목을 확인해 주세요. 해당 활동이 없으면 정상일 수 있습니다. (${buildSubmissionSummaryDetail(presentation)})`
  }

  return '아래 제출 현황을 확인해 주세요.'
}

export function deriveSessionStatus(params: {
  sessionStatus: string
  session: ReviewSession
  latestAnalysisAt: string | null
}): ReviewSession['derivedStatus'] {
  const { sessionStatus, session, latestAnalysisAt } = params
  const presentation = buildReviewSubmissionPresentation(session)
  const failedFileCount = session.files.some((file) => FAILED_FILE_STATUSES.includes(file.status as typeof FAILED_FILE_STATUSES[number]))
  const hasPendingFileAnalysis = session.files.some((file) => ['uploaded', 'analyzing'].includes(file.status))
  const hasActionableIssue = presentation.needsCheckCount > 0 || failedFileCount || presentation.actionableUnlinkedCount > 0
  const hasOnlyNoSubmission = presentation.noSubmissionCount > 0 &&
    presentation.needsCheckCount === 0 &&
    presentation.actionableUnlinkedCount === 0 &&
    !failedFileCount
  const hasNoUploadedFiles = session.files.length === 0

  if (hasPendingFileAnalysis) {
    return {
      label: 'AI 판단 중',
      detail: '파일 분석 또는 세션 선검증이 진행 중입니다.',
      tone: 'info',
    }
  }

  if (sessionStatus === 'submitted' && !session.hasSessionEvaluation && session.files.length > 0) {
    return {
      label: '평가 필요',
      detail: '파일 분석은 끝났지만 세션 평가가 완료되지 않았습니다. 자료 다시 검토를 눌러 주세요.',
      tone: 'warning',
    }
  }

  if (sessionStatus === 'ai_checking' && isRecentAnalysis(latestAnalysisAt)) {
    return {
      label: 'AI 판단 중',
      detail: '파일 분석은 끝났고 세션 기준 평가를 마무리하는 중입니다.',
      tone: 'info',
    }
  }

  if (sessionStatus === 'ai_checking') {
    return {
      label: '재검토 필요',
      detail: '파일 분석은 끝났지만 세션 평가가 완료되지 않았습니다. 다시 검토를 눌러 주세요.',
      tone: 'warning',
    }
  }

  if (hasNoUploadedFiles) {
    return {
      label: '제출 없음',
      detail: presentation.rows.length > 0
        ? buildSubmissionStatusDetail(presentation)
        : '아직 업로드된 파일이 없습니다.',
      tone: 'default',
    }
  }

  if (['ready_for_accountant', 'completed'].includes(sessionStatus) && !hasActionableIssue) {
    return {
      label: '검증통과',
      detail: latestAnalysisAt ? '요청자료 기준을 충족했습니다.' : '담당자 완료 처리 가능한 상태입니다.',
      tone: 'success',
    }
  }

  if (hasActionableIssue) {
    return {
      label: '검토필요',
      detail: buildSubmissionStatusDetail(presentation),
      tone: 'warning',
    }
  }

  if (sessionStatus === 'needs_resubmission' || hasOnlyNoSubmission) {
    return {
      label: '제출 확인',
      detail: buildSubmissionStatusDetail(presentation),
      tone: 'info',
    }
  }

  return {
    label: '제출 확인',
    detail: presentation.rows.length > 0
      ? buildSubmissionStatusDetail(presentation)
      : '고객사 업로드 또는 제출 상태를 확인하세요.',
    tone: 'info',
  }
}
