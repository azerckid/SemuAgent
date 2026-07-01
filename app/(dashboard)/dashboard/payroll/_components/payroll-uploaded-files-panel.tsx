import { Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { fromISO } from '@/lib/time'
import { cn } from '@/lib/utils'

export type PayrollUploadedFile = {
  id: string
  originalFilename: string
  fileSize: number
  uploadedAt: string
  passwordStatus: 'none' | 'required' | 'supplied' | 'invalid' | 'consumed' | 'not_needed'
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FILE_STATUS_BADGE: Record<PayrollUploadedFile['passwordStatus'], { label: string; className: string }> = {
  none: { label: '업로드됨', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  not_needed: { label: '업로드됨', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  consumed: { label: '업로드됨', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  supplied: { label: '비밀번호 확인 중', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  required: { label: '비밀번호 확인 필요', className: 'border-red-200 bg-red-50 text-red-700' },
  invalid: { label: '비밀번호 오류', className: 'border-red-200 bg-red-50 text-red-700' },
}

export function PayrollUploadedFilesPanel({
  files,
  sessionId,
}: {
  files: PayrollUploadedFile[]
  sessionId: string | null
}) {
  return (
    <section className="rounded-lg border bg-background">
      {!sessionId ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          아직 연결된 업로드 세션이 없습니다. 요청 발송 후 업로드되면 여기에 표시됩니다.
        </div>
      ) : files.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          아직 업로드된 급여 자료가 없습니다.
        </div>
      ) : (
        <ul className="divide-y">
          {files.map((file) => {
            const fileStatus = FILE_STATUS_BADGE[file.passwordStatus]

            return (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{file.originalFilename}</p>
                    <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold', fileStatus.className)}>
                      {fileStatus.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatBytes(file.fileSize)} · {fromISO(file.uploadedAt).toFormat('MM/dd HH:mm')}
                  </p>
                </div>
                <a
                  href={`/api/sessions/${sessionId}/payroll/source-files/download?fileId=${encodeURIComponent(file.id)}`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  <Download className="size-4" />
                  다운로드
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
