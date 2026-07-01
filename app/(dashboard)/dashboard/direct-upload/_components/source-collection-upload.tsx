'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { RefreshCw, Upload } from 'lucide-react'
import { FilePasswordInput } from '@/components/upload/file-password-input'
import { verifyUploadClientTokenAvailable } from '@/lib/upload/client-token-preflight'
import { resolveUploadedFileDisplay } from '@/lib/upload/file-display'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
  'image/jpeg',
  'image/png',
  'image/webp',
].join(',')

const MAX_FILE_BYTES = 50 * 1024 * 1024

type UploadSession = {
  id: string
  rawToken: string | null
  status: string
}

type UploadedFile = {
  id: string
  originalFilename: string
  fileSize: number
  status: string
  passwordStatus?: string | null
}

type Props = {
  readonly businessEntityId: string
  readonly periodKey: string
  readonly periodLabel: string
  readonly accountingPeriod: string
  readonly session: UploadSession | null
  readonly uploadedFiles: UploadedFile[]
  readonly focusFileId?: string | null
  readonly retryAction?: boolean
}

function fileIdentity(file: Pick<UploadedFile, 'originalFilename' | 'fileSize'>) {
  return `${file.originalFilename}:${file.fileSize}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extractRawToken(uploadUrl: string | null | undefined) {
  if (!uploadUrl) return null
  try {
    const parsed = new URL(uploadUrl)
    return parsed.pathname.split('/').filter(Boolean).pop() ?? null
  } catch {
    return uploadUrl.split('/').filter(Boolean).pop() ?? null
  }
}

export function SourceCollectionUploadDropzone({
  businessEntityId,
  periodKey,
  periodLabel,
  accountingPeriod,
  session: initialSession,
  uploadedFiles,
  focusFileId,
  retryAction,
}: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const retriedRef = useRef(false)
  const [createdSession, setCreatedSession] = useState<UploadSession | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const activeSession = createdSession ?? initialSession

  const ensureSession = useCallback(async (): Promise<UploadSession | null> => {
    if (activeSession?.rawToken) return activeSession

    const res = await fetch('/api/staff-direct-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: businessEntityId,
        displayLabel: `${periodLabel} 자료수집`,
        workType: 'bookkeeping',
        accountingPeriod,
        bookkeepingPeriodType: null,
        analysisNotes: '',
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.error ?? '업로드 세션을 만들지 못했습니다')
    }

    const rawToken = extractRawToken(data.uploadUrl)
    const nextSession: UploadSession = {
      id: data.sessionId,
      rawToken,
      status: 'active',
    }

    if (!nextSession.rawToken) {
      throw new Error('업로드 세션을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }

    setCreatedSession(nextSession)
    return nextSession
  }, [accountingPeriod, activeSession, businessEntityId, periodLabel])

  const submitSession = useCallback(async (rawToken: string) => {
    const res = await fetch('/api/upload/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawToken }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.error ?? '제출 처리에 실패했습니다')
    }
    return data
  }, [])

  const handleFiles = async (files: FileList | File[]) => {
    const targets = Array.from(files)
    if (targets.length === 0) return

    setError(null)
    setMessage(null)

    const oversized = targets.filter((file) => file.size > MAX_FILE_BYTES)
    if (oversized.length > 0) {
      setError(`파일당 최대 50MB까지 업로드할 수 있습니다. (${oversized[0].name})`)
      return
    }

    setUploading(true)
    try {
      const activeSession = await ensureSession()
      if (!activeSession?.rawToken) return

      const blockedIdentities = new Set(uploadedFiles.map(fileIdentity))
      const acceptedTargets: File[] = []
      for (const file of targets) {
        const identity = fileIdentity({ originalFilename: file.name, fileSize: file.size })
        if (!blockedIdentities.has(identity)) {
          acceptedTargets.push(file)
        }
      }

      if (acceptedTargets.length === 0) {
        setError('이미 등록된 파일입니다.')
        return
      }

      for (const file of acceptedTargets) {
        const pathname = `uploads/${crypto.randomUUID()}-${file.name}`
        const clientPayload = JSON.stringify({
          rawToken: activeSession.rawToken,
          originalFilename: file.name,
        })

        await verifyUploadClientTokenAvailable({
          handleUploadUrl: '/api/upload',
          pathname,
          clientPayload,
        })

        await upload(pathname, file, {
          access: 'private',
          handleUploadUrl: '/api/upload',
          clientPayload,
        })
      }

      await submitSession(activeSession.rawToken)
      setMessage(`${acceptedTargets.length}개 파일을 업로드했습니다. 파싱이 시작됩니다.`)
      router.refresh()
      window.setTimeout(() => router.refresh(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

  const retryFile = useCallback((fileId: string) => {
    setError(null)
    setMessage(null)
    setRetrying(true)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/upload/files/${fileId}/retry`, { method: 'POST' })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error ?? '다시 시도에 실패했습니다')
        }
        setMessage('파일 분석을 다시 시도합니다.')
        router.replace(`/dashboard/direct-upload?period=${periodKey}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : '다시 시도에 실패했습니다')
      } finally {
        setRetrying(false)
      }
    })
  }, [periodKey, router])

  useEffect(() => {
    if (!retryAction || !focusFileId || retriedRef.current) return
    retriedRef.current = true
    retryFile(focusFileId)
  }, [focusFileId, retryAction, retryFile])

  const focusFile = focusFileId
    ? uploadedFiles.find((file) => file.id === focusFileId) ?? null
    : null
  const focusDisplay = focusFile ? resolveUploadedFileDisplay(focusFile) : null
  const canSelectFiles = !uploading && !isPending && !retrying

  return (
    <section id="upload-dropzone" className="grid gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (canSelectFiles) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (!canSelectFiles) return
          void handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          'flex items-center gap-[18px] rounded-xl border-[1.5px] border-dashed bg-company-surface px-[26px] py-[26px] transition-colors',
          canSelectFiles && dragging && 'border-blue-600 bg-blue-50/40',
          canSelectFiles && !dragging && 'border-company-border-strong hover:bg-muted/20',
          !canSelectFiles && 'border-company-border-strong opacity-80',
        )}
      >
        <div className="grid size-[46px] shrink-0 place-items-center rounded-xl bg-[#eff6ff] text-xl text-[#2563eb]">
          {uploading ? <RefreshCw className="size-5 animate-spin" /> : <Upload className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold text-foreground">자료 파일 업로드</p>
          <p className="mt-0.5 text-[12.5px] text-company-fg-muted">
            세금계산서 · 통장 거래내역 · 카드 매입내역 · 영수증 · 급여 파일 · 홈택스보내기 파일을 끌어다 놓거나 선택하세요.
          </p>
          <p className="mt-2 text-[11.5px] text-company-fg-subtle">
            지원 형식: XLSX · CSV · PDF · 이미지(JPG/PNG) · ZIP · 최대 50MB
          </p>
        </div>
        <button
          type="button"
          disabled={!canSelectFiles}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-lg border border-foreground bg-foreground px-4 py-2 text-[13px] font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? '업로드 중...' : '파일 선택'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          className="hidden"
          disabled={!canSelectFiles}
          onChange={(event) => {
            if (event.target.files) void handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {focusFile && focusDisplay?.isPasswordSubmittable ? (
        <div className="rounded-xl border border-company-border bg-company-surface p-4 shadow-company-card">
          <p className="text-sm font-semibold text-foreground">{focusFile.originalFilename}</p>
          <p className="mt-1 text-xs text-amber-700">
            비밀번호가 걸린 파일입니다. 비밀번호를 입력하면 분석이 재개됩니다.
          </p>
          <p className="mt-1 text-xs text-company-fg-muted">{formatBytes(focusFile.fileSize)}</p>
          <FilePasswordInput
            fileId={focusFile.id}
            mode="staff"
            variant="dashboard"
            disabled={uploading || isPending}
            className="mt-3"
          />
        </div>
      ) : null}

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  )
}
