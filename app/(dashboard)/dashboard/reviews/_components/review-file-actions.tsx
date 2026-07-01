import Link from 'next/link'
import { Download, Upload } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { fromISO } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { ReviewFile, ReviewSession } from '@/lib/reviews/review-workspace-types'

export const filePipelineStatusConfig: Record<string, {
  label: string
  variant: 'secondary' | 'info' | 'success' | 'warning' | 'destructive'
}> = {
  uploaded: { label: '업로드', variant: 'secondary' },
  analyzing: { label: '분석 중', variant: 'info' },
  matched: { label: '분석 완료', variant: 'success' },
  needs_review: { label: '분석 완료', variant: 'info' },
  rejected: { label: '제외', variant: 'destructive' },
  failed: { label: '분석 실패', variant: 'destructive' },
}

const STAFF_DIRECT_INCOMPLETE_UPLOAD_STATUSES = new Set(['draft', 'requested', 'active'])

export function formatReviewFileBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatReviewFileUploadedAt(value: string) {
  const parsed = fromISO(value)
  return parsed.isValid ? parsed.toFormat('MM.dd HH:mm') : value
}

export function buildReviewBulkDownloadHref(sessionId: string) {
  return `/api/sessions/${sessionId}/upload-files/download`
}

export function buildReviewFileDownloadHref(sessionId: string, fileId: string) {
  return `${buildReviewBulkDownloadHref(sessionId)}?fileId=${encodeURIComponent(fileId)}`
}

export function getReviewFilePipelineStatus(file: ReviewFile) {
  return filePipelineStatusConfig[file.status] ?? { label: file.status, variant: 'secondary' as const }
}

export function getStaffDirectContinueUploadHref(session: ReviewSession): string | null {
  if (session.source !== 'staff_direct') return null
  if (session.files.length > 0) return null
  if (!STAFF_DIRECT_INCOMPLETE_UPLOAD_STATUSES.has(session.status)) return null
  return `/dashboard/direct-upload?sessionId=${session.id}`
}

export function partitionReviewFilesByPipelineStatus(files: ReviewFile[]) {
  return {
    analyzingFiles: files.filter((file) => ['uploaded', 'analyzing'].includes(file.status)),
    failedFiles: files.filter((file) => ['failed', 'rejected'].includes(file.status)),
  }
}

export function ReviewBulkDownloadButton({
  sessionId,
  disabled = false,
  className,
}: {
  sessionId: string
  disabled?: boolean
  className?: string
}) {
  if (disabled) {
    return (
      <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'pointer-events-none opacity-50', className)}>
        <Download className="size-3.5" />
        제출 파일 전체 다운로드
      </span>
    )
  }

  return (
    <a
      href={buildReviewBulkDownloadHref(sessionId)}
      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), className)}
    >
      <Download className="size-3.5" />
      제출 파일 전체 다운로드
    </a>
  )
}

export function ReviewFileDownloadLink({
  sessionId,
  fileId,
  filename,
  label = '다운로드',
  className,
}: {
  sessionId: string
  fileId: string
  filename?: string
  label?: string
  className?: string
}) {
  return (
    <a
      href={buildReviewFileDownloadHref(sessionId, fileId)}
      aria-label={filename ? `${filename} 다운로드` : '파일 다운로드'}
      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), className)}
    >
      <Download className="size-3.5" />
      {label}
    </a>
  )
}

export function ReviewStaffDirectContinueUploadLink({ session }: { session: ReviewSession }) {
  const href = getStaffDirectContinueUploadHref(session)
  if (!href) return null

  return (
    <Link href={href} className={cn(buttonVariants({ size: 'sm' }), 'mt-4')}>
      <Upload className="size-4" />
      업로드 이어하기
    </Link>
  )
}
