'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { verifyUploadClientTokenAvailable } from '@/lib/upload/client-token-preflight'
import { PayrollRulePortalUpload } from './payroll-rule-portal-upload'
import { isPasswordSubmittable, resolveUploadedFileDisplay } from '@/lib/upload/file-display'
import { getMaterialItemHelp } from '@/lib/upload/material-item-help'
import type { UploadPortalChecklistStatus } from '@/lib/upload/portal-status'
import { FilePasswordInput } from '@/components/upload/file-password-input'

interface ChecklistItem {
  id: string
  name: string
  required: boolean
  status: UploadPortalChecklistStatus
  matchedFilename?: string
  canDeclare?: boolean
  declaration?: 'none' | 'later' | null
  declarationNote?: string | null
}

interface UploadedFile {
  id: string
  originalFilename: string
  fileSize: number
  status: string
  passwordStatus?: 'none' | 'required' | 'supplied' | 'invalid' | 'consumed' | 'not_needed'
  uploadedAt: string
  matchedItemName?: string | null
  isUnlinked?: boolean
}

interface UploadPortalProps {
  rawToken: string
  tenantName: string
  staffName: string
  accountingPeriod: string
  requestKind: 'general' | 'payroll'
  expiresAt: string
  sessionStatus: string
  checklistItems: ChecklistItem[]
  uploadedFiles: UploadedFile[]
}

interface UploadingFile {
  name: string
  progress: number
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error'
  error?: string
}

interface RecentUpload {
  name: string
  uploadedAt: string
}

type SubmissionStepStatus = 'done' | 'active' | 'pending'

interface SubmissionStep {
  label: string
  description: string
  status: SubmissionStepStatus
}

const STATUS_LABEL: Record<ChecklistItem['status'], string> = {
  completed: '접수됨',
  analyzing: '확인 중',
  needs_review: '확인 필요',
  pending: '아직 정리 전',
}

const STATUS_STYLE: Record<ChecklistItem['status'], string> = {
  completed: 'bg-green-100 text-green-800',
  analyzing: 'bg-yellow-100 text-yellow-800',
  needs_review: 'bg-amber-100 text-amber-800',
  pending: 'bg-gray-100 text-gray-600',
}

const DECLARATION_LABEL: Record<'none' | 'later', string> = {
  none: '없음 표시',
  later: '나중에 제출',
}

const DECLARATION_STYLE: Record<'none' | 'later', string> = {
  none: 'bg-purple-100 text-purple-700',
  later: 'bg-amber-100 text-amber-800',
}

const UPLOAD_STATUS_LABEL: Record<UploadingFile['status'], string> = {
  queued: '대기 중',
  uploading: '업로드 중',
  processing: '접수 중',
  done: '업로드 완료',
  error: '실패',
}

const SUBMISSION_STEP_DOT_STYLE: Record<SubmissionStepStatus, string> = {
  done: 'bg-blue-600 text-white',
  active: 'bg-blue-100 text-blue-700 ring-4 ring-blue-50',
  pending: 'bg-gray-100 text-gray-400',
}

const SUBMISSION_STEP_TEXT_STYLE: Record<SubmissionStepStatus, string> = {
  done: 'text-gray-900',
  active: 'text-blue-800',
  pending: 'text-gray-500',
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/jpeg',
  'image/png',
  'image/webp',
].join(',')

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function friendlyUploadError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)

  if (
    message.includes('already exists') ||
    message.includes('allowOverwrite') ||
    message.includes('addRandomSuffix')
  ) {
    return '이미 업로드한 파일입니다. 아래 업로드한 파일 목록을 확인해 주세요.'
  }

  return err instanceof Error ? err.message : '업로드 실패'
}

export function UploadPortal({
  rawToken,
  tenantName,
  staffName,
  accountingPeriod,
  requestKind,
  expiresAt,
  sessionStatus,
  checklistItems,
  uploadedFiles,
}: UploadPortalProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [expandedHelp, setExpandedHelp] = useState<Record<string, boolean>>({})
  const [decidingItemId, setDecidingItemId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, UploadingFile>>({})
  const [recentUploads, setRecentUploads] = useState<Record<string, RecentUpload>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [isSubmitInFlight, setIsSubmitInFlight] = useState(false)
  const [optimisticSubmitted, setOptimisticSubmitted] = useState(false)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const isUploading = Object.values(uploadingFiles).some((file) =>
    ['queued', 'uploading', 'processing'].includes(file.status),
  )
  const isPayrollRequest = requestKind === 'payroll'
  const isClientSubmitted = sessionStatus === 'submitted'
  const isClosed = sessionStatus === 'completed'

  useEffect(() => {
    if (!isUploading) return

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isUploading])

  useEffect(() => {
    const uploadedNames = new Set(uploadedFiles.map((file) => file.originalFilename))

    setRecentUploads((prev) => {
      const next = { ...prev }
      let changed = false

      for (const name of Object.keys(next)) {
        if (uploadedNames.has(name)) {
          delete next[name]
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [uploadedFiles])

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (isClosed) return

      const fileArray = Array.from(files)
      if (fileArray.length === 0) return

      const initialState: Record<string, UploadingFile> = {}
      const selectedNames = new Set<string>()
      const existingNames = new Set([
        ...uploadedFiles.map((file) => file.originalFilename),
        ...Object.keys(recentUploads),
        ...Object.keys(uploadingFiles),
      ])
      const uploadTargets: File[] = []

      for (const f of fileArray) {
        if (existingNames.has(f.name) || selectedNames.has(f.name)) {
          initialState[f.name] = {
            name: f.name,
            progress: 0,
            status: 'error',
            error: '이미 업로드한 파일입니다. 아래 목록을 확인해 주세요.',
          }
          continue
        }

        selectedNames.add(f.name)
        uploadTargets.push(f)
        initialState[f.name] = { name: f.name, progress: 5, status: 'queued' }
      }
      setUploadingFiles((prev) => ({ ...prev, ...initialState }))
      setSubmitError(null)
      setSubmitMessage(null)
      if (isClientSubmitted) setOptimisticSubmitted(false)
      if (uploadTargets.length === 0) return

      await Promise.all(
        uploadTargets.map(async (file) => {
          try {
            setUploadingFiles((prev) => ({
              ...prev,
              [file.name]: { name: file.name, progress: 5, status: 'uploading' },
            }))

            const pathname = `uploads/${crypto.randomUUID()}-${file.name}`
            const clientPayload = JSON.stringify({
              rawToken,
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
              onUploadProgress: ({ percentage }) => {
                setUploadingFiles((prev) => ({
                  ...prev,
                  [file.name]: {
                    name: file.name,
                    progress: Math.max(5, percentage),
                    status: 'uploading',
                  },
                }))
              },
            })

            setUploadingFiles((prev) => ({
              ...prev,
              [file.name]: { name: file.name, progress: 100, status: 'processing' },
            }))
            setRecentUploads((prev) => ({
              ...prev,
              [file.name]: {
                name: file.name,
                uploadedAt: new Intl.DateTimeFormat('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date()),
              },
            }))

            window.setTimeout(() => {
              setUploadingFiles((prev) => {
                if (prev[file.name]?.status === 'error') return prev

                const next = { ...prev }
                delete next[file.name]
                return next
              })
            }, 3000)
          } catch (err) {
            setUploadingFiles((prev) => ({
              ...prev,
              [file.name]: {
                name: file.name,
                progress: 0,
                status: 'error',
                error: friendlyUploadError(err),
              },
            }))
          }
        }),
      )

      startTransition(() => router.refresh())
      window.setTimeout(() => {
        startTransition(() => router.refresh())
      }, 2500)
    },
    [isClosed, isClientSubmitted, rawToken, router, uploadedFiles, recentUploads, uploadingFiles],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files)
      e.target.value = ''
    },
    [handleFiles],
  )

  const completedCount = isPayrollRequest ? 0 : checklistItems.filter((i) => i.status === 'completed').length
  const noneDeclaredCount = isPayrollRequest ? 0 : checklistItems.filter((i) => i.declaration === 'none').length
  const laterDeclaredCount = isPayrollRequest ? 0 : checklistItems.filter((i) => i.declaration === 'later').length
  const passwordSubmittableFiles = uploadedFiles.filter((file) => isPasswordSubmittable(file.passwordStatus))
  const recentUploadList = Object.values(recentUploads)
  const uploadedFileNames = new Set(uploadedFiles.map((file) => file.originalFilename))
  const pendingUploadedFiles = recentUploadList.filter((file) => !uploadedFileNames.has(file.name))
  const hasNewUploads = pendingUploadedFiles.length > 0 || recentUploadList.length > 0
  const hasUploadedFiles = uploadedFiles.length > 0 || recentUploadList.length > 0
  const hasAiInProgress =
    pendingUploadedFiles.length > 0 ||
    Object.values(uploadingFiles).some((file) => file.status === 'processing') ||
    uploadedFiles.some((file) => file.status === 'uploaded' || file.status === 'analyzing')
  const canSubmit = !isClosed && !isUploading && (isClientSubmitted ? hasNewUploads : hasUploadedFiles)
  const requestTitle = isPayrollRequest ? '급여정산 자료 제출' : '기장 자료 제출'
  const visibleUploadedFileCount = uploadedFiles.length + pendingUploadedFiles.length
  const submitSignalAccepted = optimisticSubmitted || (isClientSubmitted && !hasNewUploads)
  const showSubmissionProgress =
    isUploading || hasUploadedFiles || isSubmitInFlight || isClientSubmitted || optimisticSubmitted || hasAiInProgress
  const submissionProgressPercent = isClosed
    ? 100
    : isSubmitInFlight
      ? 62
      : submitSignalAccepted && hasAiInProgress
        ? 82
        : submitSignalAccepted
          ? 100
          : isClientSubmitted && hasNewUploads
            ? 45
            : hasUploadedFiles
              ? 35
              : isUploading
                ? 15
                : 0
  const submissionProgressTitle = isSubmitInFlight
    ? '제출 요청을 접수하는 중입니다'
    : submitSignalAccepted && hasAiInProgress
      ? '제출은 접수됐고 파일을 확인하고 있습니다'
      : submitSignalAccepted
        ? '제출이 접수되었습니다'
        : isClientSubmitted && hasNewUploads
          ? '새로 올린 파일은 추가 제출이 필요합니다'
          : hasUploadedFiles
            ? '검토 요청 전 단계입니다'
            : '파일을 올려 주세요'
  const submissionProgressDescription = isSubmitInFlight
    ? '서버가 제출 신호를 저장하고 있습니다. 잠시만 기다려 주세요.'
    : submitSignalAccepted && hasAiInProgress
      ? 'JARYO가 접수된 파일을 정리하는 중입니다. 화면은 자동으로 새로고침됩니다.'
      : submitSignalAccepted
        ? '담당자 검토 요청이 접수되었습니다. 기한 전까지 추가 업로드와 삭제는 계속 가능합니다.'
        : isClientSubmitted && hasNewUploads
          ? '새 파일을 담당자 검토 대상에 포함하려면 추가 제출 완료를 눌러 주세요.'
        : hasUploadedFiles
            ? '현재 파일은 업로드됐습니다. 담당자 검토를 요청하려면 제출 완료를 눌러 주세요.'
            : '파일을 선택하면 업로드와 접수 진행 상황이 여기에 표시됩니다.'
  const isFileCheckNoticeActive = submitSignalAccepted && hasAiInProgress
  const submissionInfoTitle = isSubmitInFlight
    ? '제출 요청을 접수하고 있습니다.'
    : isFileCheckNoticeActive
      ? '파일 확인 중입니다. 보통 30초-2분 정도 걸릴 수 있습니다.'
      : submitSignalAccepted
        ? '제출 완료되었습니다. 제출 기한 리마인드는 더 이상 발송되지 않습니다.'
        : isClientSubmitted && hasNewUploads
          ? '추가 제출 전입니다.'
          : '제출 완료 전입니다.'
  const submissionInfoDescription = isSubmitInFlight
    ? '완료되면 이 화면에서 자동으로 접수 상태가 갱신됩니다.'
    : isFileCheckNoticeActive
      ? '이 화면은 자동으로 상태를 확인합니다. 완료되면 상태가 갱신됩니다.'
      : submitSignalAccepted
        ? '제출 기한 전까지 빠뜨린 파일을 추가하거나 잘못 올린 파일을 삭제할 수 있습니다.'
        : isClientSubmitted && hasNewUploads
          ? '새 파일을 검토 대상에 포함하려면 추가 제출 완료를 눌러 주세요.'
          : '제출 완료를 누르면 제출 기한 리마인드 메일은 더 이상 발송되지 않습니다.'
  const submissionSteps: SubmissionStep[] = [
    {
      label: '파일 업로드',
      description: isUploading
        ? '파일을 올리는 중'
        : hasUploadedFiles
          ? `${visibleUploadedFileCount}건 준비됨`
          : '파일 선택 필요',
      status: isUploading ? 'active' : hasUploadedFiles ? 'done' : 'pending',
    },
    {
      label: '제출 요청',
      description: isSubmitInFlight
        ? '서버에 보내는 중'
        : submitSignalAccepted
          ? '요청 전송됨'
          : '버튼 클릭 필요',
      status: isSubmitInFlight ? 'active' : submitSignalAccepted ? 'done' : 'pending',
    },
    {
      label: '서버 접수',
      description: submitSignalAccepted ? '접수 완료' : '대기 중',
      status: submitSignalAccepted ? 'done' : 'pending',
    },
    {
      label: '파일 확인',
      description: hasAiInProgress ? '자동 확인 중' : submitSignalAccepted ? '진행 상태 반영됨' : '접수 후 시작',
      status: hasAiInProgress ? 'active' : submitSignalAccepted ? 'done' : 'pending',
    },
  ]

  useEffect(() => {
    if (!isClosed) return
    setDragging(false)
    setUploadingFiles({})
    setRecentUploads({})
    setOptimisticSubmitted(false)
  }, [isClosed])

  useEffect(() => {
    if (!hasAiInProgress) return

    const intervalId = window.setInterval(() => {
      startTransition(() => router.refresh())
    }, 4000)

    return () => window.clearInterval(intervalId)
  }, [hasAiInProgress, router, startTransition])

  const handleSubmitComplete = async () => {
    if (isSubmitInFlight) return

    setSubmitError(null)
    setSubmitMessage(null)
    setOptimisticSubmitted(false)
    setIsSubmitInFlight(true)

    try {
      const res = await fetch('/api/upload/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawToken }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error ?? '제출 완료 처리에 실패했습니다')
        return
      }

      setOptimisticSubmitted(true)
      setSubmitMessage(
        data.status === 'completed'
          ? '요청 항목 자료가 모두 확인되어 제출이 완료되었습니다.'
          : data.pendingAnalysis || data.payrollExtractionQueued
            ? '제출 완료되었습니다. 접수된 파일을 확인하고 있습니다.'
            : '제출 완료되었습니다. 제출 내용이 접수되었습니다.',
      )
      startTransition(() => router.refresh())
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '제출 완료 처리에 실패했습니다')
    } finally {
      setIsSubmitInFlight(false)
    }
  }

  const handleDeleteFile = (file: UploadedFile) => {
    if (isClosed || deletingFileId) return
    setSubmitError(null)
    setSubmitMessage(null)
    setDeletingFileId(file.id)

    fetch(`/api/upload/files/${file.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawToken }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error ?? '파일을 삭제하지 못했습니다')
        }
        setSubmitMessage('파일을 삭제했습니다. 현재 남아 있는 파일 기준으로 다시 확인합니다.')
        startTransition(() => router.refresh())
      })
      .catch((err) => {
        setSubmitError(err instanceof Error ? err.message : '파일을 삭제하지 못했습니다')
      })
      .finally(() => setDeletingFileId(null))
  }

  const handleDeclare = (itemId: string, declaration: 'none' | 'later' | null) => {
    if (isClosed || decidingItemId) return
    setSubmitError(null)
    setSubmitMessage(null)
    setDecidingItemId(itemId)

    fetch('/api/upload/declarations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawToken, checklistItemId: itemId, declaration }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error ?? '표시를 저장하지 못했습니다')
        }
        startTransition(() => router.refresh())
      })
      .catch((err) => {
        setSubmitError(err instanceof Error ? err.message : '표시를 저장하지 못했습니다')
      })
      .finally(() => setDecidingItemId(null))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-gray-500">{tenantName} · 담당: {staffName}</p>
          <h1 className="text-xl font-semibold text-gray-900 mt-0.5">
            {accountingPeriod} {requestTitle}
          </h1>
            <p className="text-sm text-gray-500 mt-1">제출 기한: {expiresAt}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {!isClosed && showSubmissionProgress && (
          <>
            <section
              className="rounded-xl border border-blue-100 bg-white px-4 py-3 shadow-sm"
              aria-live="polite"
              aria-busy={isSubmitInFlight || hasAiInProgress}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{submissionProgressTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    {submissionProgressDescription}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  {submissionProgressPercent}%
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out"
                  style={{ width: `${submissionProgressPercent}%` }}
                />
              </div>

              <ol className="mt-3 grid gap-2 sm:grid-cols-4">
                {submissionSteps.map((step, index) => (
                  <li key={step.label} className="flex items-start gap-2 sm:flex-col sm:gap-1.5">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${SUBMISSION_STEP_DOT_STYLE[step.status]}`}
                    >
                      {step.status === 'done' ? '✓' : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-xs font-medium ${SUBMISSION_STEP_TEXT_STYLE[step.status]}`}>
                        {step.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-gray-400">
                        {step.description}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <p className={`font-medium ${isFileCheckNoticeActive ? 'motion-safe:animate-pulse' : ''}`}>
                {submissionInfoTitle}
              </p>
              <p className="mt-1 text-blue-700">{submissionInfoDescription}</p>
            </div>
          </>
        )}

        {/* Upload Panel */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">파일 업로드</h2>
            <p className="text-xs text-gray-400 mt-0.5">PDF, Excel, 이미지 · 파일당 최대 50 MB</p>
          </div>

          <div className="p-5">
            {isClosed ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
                <p className="font-medium">자료 확인이 완료되었습니다.</p>
                <p className="mt-1 text-xs text-green-700">
                  추가 자료가 필요하면 담당 회계사에게 문의해 주세요.
                </p>
              </div>
            ) : (
              <>
                {/* Dropzone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer py-10 transition-colors ${
                    dragging
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg
                    className="w-8 h-8 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <p className="text-sm text-gray-500">
                    파일을 끌어다 놓거나{' '}
                    <span className="text-blue-600 font-medium">클릭하여 선택</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    제출 완료 후에도 기한 전까지 추가하거나 잘못 올린 파일을 삭제할 수 있습니다.
                  </p>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES}
                  onChange={onInputChange}
                  className="hidden"
                />
              </>
            )}

            {/* Uploading files */}
            {!isClosed && Object.values(uploadingFiles).length > 0 && (
              <ul className="mt-4 space-y-2">
                {Object.values(uploadingFiles).map((f) => (
                  <li key={f.name} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                    <div className="flex justify-between text-gray-700 mb-1">
                      <span className="truncate max-w-[75%]">{f.name}</span>
                      {f.error ? (
                        <span className="text-red-500 text-xs">{f.error}</span>
                      ) : (
                        <span className="text-gray-500 text-xs">
                          {UPLOAD_STATUS_LABEL[f.status]} · {f.progress}%
                        </span>
                      )}
                    </div>
                    {!f.error && (
                      <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${f.progress}%` }}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!isClosed && recentUploadList.length > 0 && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-sm font-medium text-green-900">업로드 완료</p>
                <ul className="mt-2 space-y-1">
                  {recentUploadList.map((file) => (
                    <li key={file.name} className="flex items-center justify-between gap-3 text-sm text-green-800">
                      <span className="truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-green-700">{file.uploadedAt}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-green-700">
                  파일은 접수되었습니다. 제출 완료 전까지 추가 자료를 더 올릴 수 있습니다.
                </p>
              </div>
            )}

            {hasAiInProgress && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <p className="font-medium">파일을 확인하고 있습니다.</p>
                <p className="mt-1 text-xs text-blue-700">
                  접수된 파일을 정리하는 중입니다. 잠시만 기다려 주세요.
                </p>
              </div>
            )}

            {passwordSubmittableFiles.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-medium">비밀번호가 걸린 파일 {passwordSubmittableFiles.length}건이 있습니다.</p>
                <p className="mt-1 text-xs text-amber-700">
                  아래에서 비밀번호를 입력하거나, 비밀번호 없는 파일로 다시 올려 주세요. 제출 완료는 다른 파일 기준으로
                  진행됩니다.
                </p>
              </div>
            )}

            {!isClosed && hasUploadedFiles && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-medium text-gray-900">제출 전 요약</p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-500">올린 파일</dt>
                    <dd className="font-medium text-gray-900">{uploadedFiles.length}건</dd>
                  </div>
                  {!isPayrollRequest && (
                    <>
                      <div className="flex items-center justify-between">
                        <dt className="text-gray-500">접수된 항목</dt>
                        <dd className="font-medium text-gray-900">{completedCount}건</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-gray-500">없음으로 표시한 항목</dt>
                        <dd className="font-medium text-gray-900">{noneDeclaredCount}건</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-gray-500">나중에 제출할 항목</dt>
                        <dd className="font-medium text-gray-900">{laterDeclaredCount}건</dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
            )}

            <div className="mt-5 border-t border-gray-100 pt-4">
              {sessionStatus === 'submitted' && !hasNewUploads ? (
                <div className="space-y-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <p>
                    {hasAiInProgress
                      ? '제출 완료되었습니다. 접수된 파일을 확인하고 있습니다. 제출 기한 리마인드는 더 이상 발송되지 않습니다.'
                      : '제출 완료되었습니다. 제출 기한 리마인드는 더 이상 발송되지 않습니다.'}
                  </p>
                  <p>제출 기한 전까지 빠뜨린 파일을 추가하거나 잘못 올린 파일을 삭제할 수 있습니다.</p>
                  <p className="text-xs text-blue-700/90">단, 모든 파일을 삭제하면 다시 제출 전 상태로 간주되어 리마인드 대상이 될 수 있습니다.</p>
                </div>
              ) : sessionStatus === 'completed' ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  모든 자료가 확인되어 제출이 완료되었습니다.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="space-y-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-500">
                    <p>제출 완료를 누르면 제출 기한 리마인드 메일은 더 이상 발송되지 않습니다. 제출 완료 후에도 제출 기한 전까지 파일을 추가하거나 잘못 올린 파일을 삭제할 수 있습니다.</p>
                    <p>단, 제출 완료 후 모든 파일을 삭제하면 다시 제출 전 상태로 간주되어 리마인드 대상이 될 수 있습니다.</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-500">
                      현재 올린 파일로 검토를 요청하려면 제출 완료를 눌러 주세요.
                    </p>
                    <button
                      type="button"
                      onClick={handleSubmitComplete}
                      disabled={!canSubmit || isSubmitInFlight}
                      className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {isSubmitInFlight ? '접수 중...' : isClientSubmitted ? '추가 제출 완료' : '제출 완료'}
                    </button>
                  </div>
                </div>
              )}
              {submitError && <p className="mt-2 text-sm text-red-500">{submitError}</p>}
              {submitMessage && <p className="mt-2 text-sm text-green-700">{submitMessage}</p>}
            </div>
          </div>
        </section>

        {isPayrollRequest ? (
          <>
            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-medium text-gray-900">급여정산 자료</h2>
              </div>
              <div className="px-5 py-5 text-sm leading-relaxed text-gray-600">
                <p>
                  급여정산에 사용하는 엑셀 파일을 그대로 업로드해 주세요. 직원정보, 근태, 수당,
                  공제 내역이 한 파일에 함께 있어도 됩니다.
                </p>
              </div>
            </section>
            <PayrollRulePortalUpload rawToken={rawToken} isClosed={isClosed} />
          </>
        ) : (
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-medium text-gray-900">필요 자료</h2>
              <span className="text-sm text-gray-500">
                {completedCount} / {checklistItems.length} 접수됨
              </span>
            </div>

            {checklistItems.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">
                담당 회계사가 자료 목록을 준비 중입니다.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {checklistItems.map((item) => {
                  const declared = item.declaration ?? null
                  const help = item.status === 'completed' || declared ? null : getMaterialItemHelp(item.name)
                  const helpOpen = expandedHelp[item.id] ?? false
                  const canDecide = !isClosed && item.status === 'pending' && item.canDeclare !== false
                  const deciding = decidingItemId === item.id
                  return (
                <li key={item.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.name}
                        {item.required && (
                          <span className="ml-1.5 text-blue-500 text-xs">요청 항목</span>
                        )}
                      </p>
                      {item.matchedFilename && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{item.matchedFilename}</p>
                      )}
                    </div>
                    {declared ? (
                      <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${DECLARATION_STYLE[declared]}`}>
                        {DECLARATION_LABEL[declared]}
                      </span>
                    ) : (
                      <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[item.status]}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    )}
                  </div>

                  {canDecide && declared && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>
                        {declared === 'none' ? '이번 기간 해당 없음으로 표시했어요.' : '나중에 제출로 표시했어요.'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeclare(item.id, null)}
                        disabled={deciding}
                        className="font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        취소
                      </button>
                    </div>
                  )}

                  {canDecide && !declared && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {help && (
                        <button
                          type="button"
                          onClick={() => setExpandedHelp((prev) => ({ ...prev, [item.id]: !helpOpen }))}
                          aria-expanded={helpOpen}
                          className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          어디서 받나요?
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeclare(item.id, 'none')}
                        disabled={deciding}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        없음 표시
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeclare(item.id, 'later')}
                        disabled={deciding}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        나중에 제출
                      </button>
                    </div>
                  )}

                  {help && helpOpen && !declared && (
                    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-600 leading-relaxed">
                      <p className="font-medium text-gray-800">{help.title}</p>
                      <ol className="mt-1.5 list-decimal pl-4 space-y-0.5">
                        {help.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                      {help.note && <p className="mt-1.5 text-gray-400">{help.note}</p>}
                    </div>
                  )}
                </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {/* Uploaded files */}
        {(uploadedFiles.length > 0 || pendingUploadedFiles.length > 0) && (
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-medium text-gray-900">업로드한 파일</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {pendingUploadedFiles.map((f) => (
                <li key={f.name} className="px-5 py-3 flex items-center justify-between gap-3 bg-green-50">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">{f.name}</p>
                    <p className="text-xs text-green-700 mt-0.5">{f.uploadedAt} · 목록 반영 중</p>
                  </div>
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    접수됨
                  </span>
                </li>
              ))}
              {uploadedFiles.map((f) => {
                const display = resolveUploadedFileDisplay(f)
                const matchedItemName = isPayrollRequest ? null : f.matchedItemName
                const showUnlinked = !isPayrollRequest && Boolean(f.isUnlinked && !display.isPasswordSubmittable)
                const badgeLabel = showUnlinked ? '미연결 파일' : display.label
                const badgeClassName = showUnlinked ? 'bg-amber-100 text-amber-800' : display.badgeClassName
                return (
                <li key={f.id} className="px-5 py-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 truncate">{f.originalFilename}</p>
                    {display.isPasswordSubmittable ? (
                      <>
                        <p className="text-xs text-amber-700 mt-0.5">
                          {display.isPasswordInvalid
                            ? '입력한 비밀번호가 맞지 않습니다. 다시 입력하거나 비밀번호 없는 파일로 다시 올려 주세요.'
                            : '비밀번호가 걸려 있어 자료를 확인하지 못했습니다. 아래에서 비밀번호를 입력하거나, 비밀번호 없는 파일로 다시 올려 주세요.'}
                        </p>
                        {!isClosed ? (
                          <FilePasswordInput
                            fileId={f.id}
                            mode="client"
                            rawToken={rawToken}
                            disabled={isUploading || deletingFileId === f.id}
                            className="mt-2"
                          />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-400 mt-0.5">{formatBytes(f.fileSize)}</p>
                        {matchedItemName ? (
                          <p className="text-xs text-green-700 mt-0.5">{matchedItemName}(으)로 접수됨</p>
                        ) : showUnlinked ? (
                          <p className="text-xs text-amber-700 mt-0.5">요청 항목과 연결되지 않은 미연결 파일입니다.</p>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2 self-end sm:self-start">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${badgeClassName}`}
                    >
                      {badgeLabel}
                    </span>
                    {!isClosed && (
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(f)}
                        disabled={deletingFileId === f.id || isUploading}
                        className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingFileId === f.id ? '삭제 중' : '삭제'}
                      </button>
                    )}
                  </div>
                </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* All completed banner */}
        {!isPayrollRequest &&
          checklistItems.length > 0 &&
          checklistItems.every((i) => i.status === 'completed') &&
          !isUploading && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 text-sm text-green-800">
              모든 자료가 접수되었습니다.
            </div>
          )}
      </main>
    </div>
  )
}
