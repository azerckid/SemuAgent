import {
  describeReviewAdaptiveContextSignal,
  detectReviewAdaptiveContextSignal,
} from './adaptive-structuring-context-classification'
import { classifyReviewFile, type ReviewFileClassification } from '@/lib/reviews/review-file-classification'
import type { ReviewFile, ReviewSession } from '@/lib/reviews/review-workspace-types'

export type ReviewAdaptiveStructuringCandidateFile = {
  id: string
  originalFilename: string
  fileType: string
  detectedRole: 'business_data_candidate'
  reason: string
}

export type ReviewAdaptiveStructuringEligibility = {
  eligible: boolean
  reason: string
  candidateFiles: ReviewAdaptiveStructuringCandidateFile[]
  blockedFiles: Array<{
    id: string
    originalFilename: string
    label: ReviewFileClassification['label']
    reason: string
  }>
}

const TABULAR_FILE_TYPES = new Set(['excel', 'csv'])

function isTabularFile(file: ReviewFile): boolean {
  const filename = file.originalFilename.toLowerCase()
  return TABULAR_FILE_TYPES.has(file.fileType) ||
    filename.endsWith('.xlsx') ||
    filename.endsWith('.xls') ||
    filename.endsWith('.csv')
}

// Slice 1: 기존 자료검토 신호를 adapter로 연결한다. 새 wrong-file classifier나
// AI 호출을 만들지 않고, 현 화면의 파일 분류 결과만으로 구조화 제안 가능 여부를 판단한다.
export function deriveReviewAdaptiveStructuringEligibility(
  session: ReviewSession,
): ReviewAdaptiveStructuringEligibility {
  if (session.files.length === 0) {
    return {
      eligible: false,
      reason: '구조화 후보 없음',
      candidateFiles: [],
      blockedFiles: [],
    }
  }

  const classifiedFiles = session.files.map((file) => ({
    file,
    classification: classifyReviewFile(file, session),
  }))

  const pendingFile = classifiedFiles.find(({ classification }) => classification.status === 'pending')
  if (pendingFile) {
    return {
      eligible: false,
      reason: '검토 완료 후 가능',
      candidateFiles: [],
      blockedFiles: classifiedFiles.map(({ file, classification }) => ({
        id: file.id,
        originalFilename: file.originalFilename,
        label: classification.label,
        reason: classification.reason,
      })),
    }
  }

  const passwordBlockedFile = classifiedFiles.find(({ classification }) => (
    classification.status === 'password_required' || classification.status === 'password_invalid'
  ))
  if (passwordBlockedFile) {
    return {
      eligible: false,
      reason: '파일 확인 필요',
      candidateFiles: [],
      blockedFiles: classifiedFiles.map(({ file, classification }) => ({
        id: file.id,
        originalFilename: file.originalFilename,
        label: classification.label,
        reason: classification.reason,
      })),
    }
  }

  // payroll Slice 1과 달리 classifyReviewFile에는 메타정보/정책-only/결과-only 전용 분류가
  // 없다. unmatched로 떨어진 파일이라도 AI가 읽은 내용이 그런 신호를 보이면 구조화 제안
  // 후보에서 제외한다(docs/05_QA_Validation/40_ADAPTIVE_DATA_STRUCTURING_QA.md §4 Known gap).
  const contextSignalByFileId = new Map(
    classifiedFiles.map(({ file, classification }) => [
      file.id,
      classification.status === 'unmatched'
        ? detectReviewAdaptiveContextSignal(file, session.analysisRuns)
        : null,
    ]),
  )

  const candidateFiles = classifiedFiles
    .filter(({ file, classification }) => (
      classification.status === 'unmatched'
      && isTabularFile(file)
      && !contextSignalByFileId.get(file.id)
    ))
    .map(({ file, classification }) => ({
      id: file.id,
      originalFilename: file.originalFilename,
      fileType: file.fileType,
      detectedRole: 'business_data_candidate' as const,
      reason: classification.reason || '기존 요청자료 항목에는 자동 연결되지 않았지만, 표 형태 업무 데이터일 수 있습니다.',
    }))

  if (candidateFiles.length > 0) {
    return {
      eligible: true,
      reason: '기존 자료검토에서 자동 연결되지 않은 표 형태 후보가 있습니다.',
      candidateFiles,
      blockedFiles: classifiedFiles
        .filter(({ file, classification }) => (
          classification.status !== 'unmatched' || Boolean(contextSignalByFileId.get(file.id))
        ))
        .map(({ file, classification }) => {
          const contextSignal = contextSignalByFileId.get(file.id)
          return {
            id: file.id,
            originalFilename: file.originalFilename,
            label: classification.label,
            reason: contextSignal ? describeReviewAdaptiveContextSignal(contextSignal) : classification.reason,
          }
        }),
    }
  }

  const hasKnownSuitableFiles = classifiedFiles.some(({ classification }) => classification.status === 'suitable')
  if (hasKnownSuitableFiles) {
    return {
      eligible: false,
      reason: '기존 자료검토 로직으로 처리 가능한 자료입니다.',
      candidateFiles: [],
      blockedFiles: [],
    }
  }

  return {
    eligible: false,
    reason: '구조화 후보 없음',
    candidateFiles: [],
    blockedFiles: classifiedFiles.map(({ file, classification }) => ({
      id: file.id,
      originalFilename: file.originalFilename,
      label: classification.label,
      reason: classification.reason,
    })),
  }
}
