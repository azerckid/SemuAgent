import type { DisplayStatus } from '@/lib/status-tone'

export const REVIEW_ACCOUNT_CLASSIFICATION_DEACTIVATED_V1 = false
export const REVIEW_JOURNAL_ENTRY_DEACTIVATED_V1 = true

export const DEACTIVATED_ACCOUNT_CLASSIFICATION_STATUS: DisplayStatus = {
  label: '옵션',
  detail: '계정항목은 추가 옵션 기능으로, 현재 버전에서는 제공되지 않습니다',
  tone: 'default',
}

export const DEACTIVATED_JOURNAL_ENTRY_STATUS: DisplayStatus = {
  label: '옵션',
  detail: '전표분개는 추가 옵션 기능으로, 현재 버전에서는 제공되지 않습니다',
  tone: 'default',
}
