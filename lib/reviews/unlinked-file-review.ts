import type { ReviewFileClassification } from './review-file-classification'
import type { ReviewFile } from './review-workspace-types'

export const DEFAULT_UNLINKED_FILE_EXCLUDE_NOTE = '담당자 검토 제외 확인'

export function isStaffExcludedUnlinkedFile(file: Pick<ReviewFile, 'staffReviewStatus'>) {
  return file.staffReviewStatus === 'excluded'
}

export function canStaffExcludeUnlinkedFile(
  file: Pick<ReviewFile, 'status' | 'passwordStatus'>,
  classification: Pick<ReviewFileClassification, 'status'>,
) {
  if (file.passwordStatus === 'required') return false
  if (file.status === 'uploaded' || file.status === 'analyzing') return false
  if (classification.status === 'pending') return false
  return true
}
