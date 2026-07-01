import type { PayrollRuleSourceType } from '@/lib/validations/payroll-rule-profile'

/** Slice 4b: 담당자가 올리는 사내 급여 규칙 파일 MIME 허용 목록 */
export const PAYROLL_RULE_DOCUMENT_CONTENT_TYPES = [
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
] as const

export type PayrollRuleDocumentContentType = (typeof PAYROLL_RULE_DOCUMENT_CONTENT_TYPES)[number]

/**
 * 클라이언트가 급여정산 포털에서 직접 올린 사내 급여규정 파일을 `client_document`에
 * 저장할 때 쓰는 documentType 태그. 담당자 급여기준 프로필 화면이 이 값으로 필터해
 * "클라이언트 제출 규정 자료" 목록을 보여준다.
 */
export const PAYROLL_RULE_CLIENT_DOCUMENT_TYPE = '사내급여규정' as const
export const PAYROLL_RULE_LEGACY_STAFF_DOCUMENT_TYPE = '사내급여규칙' as const
export const PAYROLL_RULE_CLIENT_SUBMIT_MEMO = '클라이언트가 급여정산 포털에서 제출' as const
export const PAYROLL_RULE_STAFF_UPLOAD_MEMO = '담당자가 사내급여기준 탭에서 업로드' as const

export function isPayrollRuleDocumentType(documentType: string) {
  return (
    documentType === PAYROLL_RULE_CLIENT_DOCUMENT_TYPE ||
    documentType === PAYROLL_RULE_LEGACY_STAFF_DOCUMENT_TYPE
  )
}

export type PayrollRuleExtractFileType = 'pdf' | 'excel' | 'text' | 'word'

export function isPayrollRuleDocumentContentType(contentType: string): contentType is PayrollRuleDocumentContentType {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  return (PAYROLL_RULE_DOCUMENT_CONTENT_TYPES as readonly string[]).includes(normalized)
}

export function resolvePayrollRuleExtractFileType(contentType: string): PayrollRuleExtractFileType | null {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (normalized === 'application/pdf') return 'pdf'
  if (normalized === 'text/plain') return 'text'
  if (
    normalized === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || normalized === 'application/vnd.ms-excel'
  ) {
    return 'excel'
  }
  if (
    normalized === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || normalized === 'application/msword'
  ) {
    return 'word'
  }
  return null
}

export function resolvePayrollRuleSourceTypeFromContentType(contentType: string): PayrollRuleSourceType | null {
  const fileType = resolvePayrollRuleExtractFileType(contentType)
  if (!fileType) return null
  return fileType === 'excel' ? 'excel_embedded' : 'rule_document'
}

export const PAYROLL_RULE_DOCUMENT_ACCEPT = '.txt,.pdf,.xlsx,.xls,.doc,.docx'
