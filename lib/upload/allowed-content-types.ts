/**
 * Server-authoritative upload MIME allowlist.
 * Keep in sync with `app/api/upload/route.ts` ALLOWED_CONTENT_TYPES.
 */
export const UPLOAD_ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const UPLOAD_ALLOWED_ACCEPT = UPLOAD_ALLOWED_CONTENT_TYPES.join(',')

export const UPLOAD_MAX_FILE_BYTES = 50 * 1024 * 1024

export const UPLOAD_ALLOWED_TYPES_HINT =
  '지원 형식: PDF · XLSX · XLS · 이미지(JPG/PNG/WebP) · 최대 50MB'

const ALLOWED_SET = new Set<string>(UPLOAD_ALLOWED_CONTENT_TYPES)

export function isUploadAllowedContentType(contentType: string | undefined | null): boolean {
  if (!contentType) return false
  return ALLOWED_SET.has(contentType)
}

export function isUploadAllowedFile(file: Pick<File, 'type' | 'name'>): boolean {
  if (isUploadAllowedContentType(file.type)) return true
  if (file.type) return false
  // Some browsers omit MIME for Excel; fall back to extension.
  const lower = file.name.toLowerCase()
  return (
    lower.endsWith('.pdf')
    || lower.endsWith('.xlsx')
    || lower.endsWith('.xls')
    || lower.endsWith('.jpg')
    || lower.endsWith('.jpeg')
    || lower.endsWith('.png')
    || lower.endsWith('.webp')
  )
}
