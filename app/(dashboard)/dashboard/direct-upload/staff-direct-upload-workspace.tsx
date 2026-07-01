'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { ArrowLeft, FileUp, RefreshCw, Square, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { nowYearMonthComponents, nowISOString } from '@/lib/client-format'
import { FilePasswordInput } from '@/components/upload/file-password-input'
import { verifyUploadClientTokenAvailable } from '@/lib/upload/client-token-preflight'
import { resolveUploadedFileDisplay } from '@/lib/upload/file-display'
import { cn } from '@/lib/utils'
import { resolveBookkeepingPeriodRange, type BookkeepingPeriodType } from '@/lib/bookkeeping/period-range'
import {
  isPayrollExtractionFinalStatus,
  isPayrollRunningBatchStale,
} from '@/lib/payroll/extraction-status'
import { formatPayrollExtractionMessageForDisplay } from '@/lib/payroll/extraction-message'
import type { staffDirectUploadWorkTypes } from '@/lib/validations/staff-direct-upload'

type WorkType = typeof staffDirectUploadWorkTypes[number]

type ClientOption = {
  id: string
  name: string
  email: string
  contactName: string | null
  staffName: string | null
}

type DirectSession = {
  id: string
  clientId: string
  clientName: string
  accountingPeriod: string
  status: string
  requestKind: 'general' | 'payroll'
  expiresAt: string
  rawToken: string | null
  resultPath: string
  payrollExtractionStatus: string | null
  payrollExtractionCreatedAt: string | null
  payrollExtractionErrorMessage: string | null
}

type UploadedFile = {
  id: string
  originalFilename: string
  fileSize: number
  status: string
  passwordStatus?: string | null
  uploadedAt: string
}

type OptimisticUploadedFile = UploadedFile & {
  optimistic: true
  sessionId: string
}

type DisplayedUploadedFile = UploadedFile & {
  optimistic?: boolean
}

type Props = {
  clients: ClientOption[]
  initialWorkType: WorkType
  session: DirectSession | null
  uploadedFiles: UploadedFile[]
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/jpeg',
  'image/png',
  'image/webp',
].join(',')

const WORK_TYPE_LABEL: Record<WorkType, string> = {
  bookkeeping: '기장',
  vat: '부가세',
  payroll: '급여',
  general: '기타 요청',
}

const BOOKKEEPING_PERIOD_OPTIONS: Array<{ value: BookkeepingPeriodType; label: string }> = [
  { value: 'monthly', label: '월별' },
  { value: 'quarterly', label: '분기별' },
  { value: 'yearly', label: '연간' },
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIdentity(file: Pick<UploadedFile, 'originalFilename' | 'fileSize'>) {
  return `${file.originalFilename}:${file.fileSize}`
}

function fileStatusLabel(file: DisplayedUploadedFile) {
  if (file.optimistic) {
    if (file.status === 'uploading') return '업로드 중'
    if (file.status === 'error') return '업로드 실패'
    return '서버 반영 중'
  }

  if (file.status === 'uploaded') return '업로드 완료'
  if (file.status === 'analyzing') return '분석 중'
  return file.status
}

function defaultPeriod(workType: WorkType) {
  const { year, month } = nowYearMonthComponents()
  if (workType === 'vat') {
    const quarter = Math.ceil(month / 3)
    return `${year}-Q${quarter}`
  }
  return `${year}-${String(month).padStart(2, '0')}`
}

function defaultBookkeepingPeriod(periodType: BookkeepingPeriodType) {
  const { year, month } = nowYearMonthComponents()
  if (periodType === 'yearly') return `${year}`
  if (periodType === 'quarterly') return `${year}-Q${Math.ceil(month / 3)}`
  return `${year}-${String(month).padStart(2, '0')}`
}

export function StaffDirectUploadWorkspace({
  clients,
  initialWorkType,
  session,
  uploadedFiles,
}: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [displayLabel, setDisplayLabel] = useState('')
  const [workType, setWorkType] = useState<WorkType>(initialWorkType)
  const [bookkeepingPeriodType, setBookkeepingPeriodType] = useState<BookkeepingPeriodType>('monthly')
  const [accountingPeriod, setAccountingPeriod] = useState(defaultPeriod(initialWorkType))
  const [analysisNotes, setAnalysisNotes] = useState('')
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [deletingSession, setDeletingSession] = useState(false)
  const [analysisStarted, setAnalysisStarted] = useState(false)
  const [cancellingAnalysis, setCancellingAnalysis] = useState(false)
  const [optimisticUploadedFiles, setOptimisticUploadedFiles] = useState<OptimisticUploadedFile[]>([])
  const [isPending, startTransition] = useTransition()
  const uploadedFileIdentities = new Set(uploadedFiles.map(fileIdentity))
  const optimisticVisibleFiles = optimisticUploadedFiles.filter((file) => (
    file.sessionId === session?.id && !uploadedFileIdentities.has(fileIdentity(file))
  ))
  const displayedFiles: DisplayedUploadedFile[] = [
    ...uploadedFiles,
    ...optimisticVisibleFiles,
  ]
  const hasUploadedFiles = displayedFiles.length > 0
  const hasSubmittableFiles = displayedFiles.some((file) => file.status !== 'uploading' && file.status !== 'error')
  const payrollExtractionDone = isPayrollExtractionFinalStatus(session?.payrollExtractionStatus)
  const payrollExtractionStale = isPayrollRunningBatchStale(
    session?.payrollExtractionStatus
      ? {
        status: session.payrollExtractionStatus,
        createdAt: session.payrollExtractionCreatedAt,
      }
      : null,
  )
  const isAnalyzing = Boolean(session && (
    displayedFiles.some((file) => file.status === 'analyzing')
    || (
      session.requestKind === 'payroll'
      && !payrollExtractionDone
      && !payrollExtractionStale
      && (analysisStarted || session.payrollExtractionStatus === 'pending' || session.payrollExtractionStatus === 'running')
    )
  ))
  const payrollExtractionErrorMessage = formatPayrollExtractionMessageForDisplay(session?.payrollExtractionErrorMessage)
  const canOpenResult = Boolean(session && (
    session.requestKind === 'payroll'
      ? payrollExtractionDone || payrollExtractionStale
      : session.status !== 'draft' && !isAnalyzing
  ))
  const canSelectFiles = Boolean(session?.rawToken && !uploading && !isPending && !isAnalyzing && !deletingSession)
  const canCancelAnalysis = Boolean(session?.requestKind === 'payroll' && isAnalyzing)
  const bookkeepingPeriodRange = workType === 'bookkeeping'
    ? resolveBookkeepingPeriodRange({
      accountingPeriod,
      periodType: bookkeepingPeriodType,
    })
    : null

  useEffect(() => {
    if (!isAnalyzing) return
    const timer = window.setInterval(() => router.refresh(), 4000)
    return () => window.clearInterval(timer)
  }, [isAnalyzing, router])

  const createSession = () => {
    setError(null)
    setMessage(null)
    const normalizedDisplayLabel = displayLabel.trim()
    if (!normalizedDisplayLabel) {
      setError('자료검토/급여정산 화면에 표시할 이름을 입력해 주세요.')
      return
    }
    startTransition(async () => {
      const res = await fetch('/api/staff-direct-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          displayLabel: normalizedDisplayLabel,
          workType,
          accountingPeriod,
          bookkeepingPeriodType: workType === 'bookkeeping' ? bookkeepingPeriodType : null,
          analysisNotes,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? '직접 업로드 세션을 만들지 못했습니다')
        return
      }
      router.push(`/dashboard/direct-upload?sessionId=${data.sessionId}`)
    })
  }

  const handleFiles = async (files: FileList | File[]) => {
    if (!session?.rawToken) return
    const targets = Array.from(files)
    if (targets.length === 0) return

    setError(null)
    setMessage(null)
    const blockedIdentities = new Set(
      displayedFiles
        .filter((file) => file.status !== 'error')
        .map(fileIdentity),
    )
    const acceptedTargets: File[] = []
    const acceptedIdentities = new Set<string>()
    const duplicateNames: string[] = []
    for (const file of targets) {
      const identity = fileIdentity({ originalFilename: file.name, fileSize: file.size })
      if (blockedIdentities.has(identity) || acceptedIdentities.has(identity)) {
        duplicateNames.push(file.name)
        continue
      }
      acceptedIdentities.add(identity)
      acceptedTargets.push(file)
    }

    if (acceptedTargets.length === 0) {
      setError('이미 업로드 중이거나 등록된 파일입니다. 아래 파일 목록을 확인해 주세요.')
      return
    }

    if (duplicateNames.length > 0) {
      setMessage(`중복 파일 ${duplicateNames.length}개는 제외하고 새 파일만 업로드합니다.`)
    }

    setUploading(true)
    const pendingFiles: OptimisticUploadedFile[] = acceptedTargets.map((file) => ({
      id: `optimistic-${crypto.randomUUID()}`,
      sessionId: session.id,
      originalFilename: file.name,
      fileSize: file.size,
      status: 'uploading',
      uploadedAt: nowISOString(),
      optimistic: true,
    }))
    const pendingIds = new Set(pendingFiles.map((file) => file.id))
    setOptimisticUploadedFiles((current) => [...current, ...pendingFiles])

    try {
      for (const [index, file] of acceptedTargets.entries()) {
        const pendingId = pendingFiles[index].id
        const pathname = `uploads/${crypto.randomUUID()}-${file.name}`
        const clientPayload = JSON.stringify({
          rawToken: session.rawToken,
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
        setOptimisticUploadedFiles((current) => current.map((item) => (
          item.id === pendingId
            ? { ...item, status: 'uploaded', uploadedAt: nowISOString() }
            : item
        )))
      }
      setMessage('파일을 업로드했습니다. 제출 완료를 누르면 분석이 시작됩니다.')
      router.refresh()
      window.setTimeout(() => router.refresh(), 1200)
    } catch (err) {
      setOptimisticUploadedFiles((current) => current.map((item) => (
        pendingIds.has(item.id) && item.status === 'uploading'
          ? { ...item, status: 'error' }
          : item
      )))
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

  const submitFiles = () => {
    if (!session?.rawToken) return
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await fetch('/api/upload/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawToken: session.rawToken }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? '제출 완료 처리에 실패했습니다')
        return
      }
      setAnalysisStarted(Boolean(data.payrollExtractionQueued || data.pendingAnalysis))
      setMessage(data.payrollExtractionQueued ? '급여 추출을 시작했습니다.' : '자료 분석을 시작했습니다.')
      router.refresh()
    })
  }

  const cancelAnalysis = () => {
    if (!session || session.requestKind !== 'payroll') return
    setError(null)
    setMessage(null)
    setCancellingAnalysis(true)
    fetch(`/api/sessions/${session.id}/payroll/extract/cancel`, { method: 'POST' })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error ?? '급여 추출 중단에 실패했습니다')
        setAnalysisStarted(false)
        setMessage(data?.cancelled ? '급여 추출을 중단했습니다. 파일을 확인한 뒤 다시 분석할 수 있습니다.' : '실행 중인 급여 추출이 없습니다.')
        router.refresh()
      })
      .catch((err) => setError(err instanceof Error ? err.message : '급여 추출 중단에 실패했습니다'))
      .finally(() => setCancellingAnalysis(false))
  }

  const deleteFile = (fileId: string) => {
    if (!session?.rawToken) return
    setError(null)
    setMessage(null)
    setDeletingFileId(fileId)
    fetch(`/api/upload/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawToken: session.rawToken }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error ?? '파일 삭제에 실패했습니다')
        setOptimisticUploadedFiles((current) => current.filter((file) => file.id !== fileId))
        setMessage('파일을 삭제했습니다. 필요한 파일을 다시 업로드해 주세요.')
        router.refresh()
      })
      .catch((err) => setError(err instanceof Error ? err.message : '파일 삭제에 실패했습니다'))
      .finally(() => setDeletingFileId(null))
  }

  const deleteSession = () => {
    if (!session) return
    const ok = window.confirm('이 테스트 세션을 화면에서 삭제할까요? 기존 업로드 링크도 더 이상 열리지 않습니다.')
    if (!ok) return

    setError(null)
    setMessage(null)
    setDeletingSession(true)
    fetch(`/api/sessions/${session.id}`, { method: 'DELETE' })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error ?? '테스트 세션 삭제에 실패했습니다')
        router.push(session.requestKind === 'payroll' ? '/dashboard/payroll' : '/dashboard/reviews')
        router.refresh()
      })
      .catch((err) => setError(err instanceof Error ? err.message : '테스트 세션 삭제에 실패했습니다'))
      .finally(() => setDeletingSession(false))
  }

  const resultPath = session?.resultPath ?? (
    session?.requestKind === 'payroll'
      ? '/dashboard/payroll'
      : `/dashboard/reviews?sessionId=${session?.id ?? ''}`
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">담당자 직접 업로드</h1>
            <Badge variant="info">테스트</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            고객 메일을 보내지 않고, 담당자가 준비한 자료를 직접 올려 기존 분석 흐름을 확인합니다.
          </p>
        </div>
        <Link href={session?.requestKind === 'payroll' ? '/dashboard/payroll' : '/dashboard/reviews'} className={buttonVariants({ variant: 'outline' })}>
          <ArrowLeft className="size-4" />
          돌아가기
        </Link>
      </div>

      {!session ? (
        <Card>
          <CardHeader>
            <CardTitle>직접 업로드 세션 만들기</CardTitle>
            <CardDescription>테스트용 고객사, 업무유형, 기간을 선택합니다. 메일은 발송되지 않습니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">고객사</span>
              <Select value={clientId} onChange={(event) => setClientId(event.target.value)}>
                {clients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">표시 이름</span>
              <Input
                value={displayLabel}
                onChange={(event) => setDisplayLabel(event.target.value)}
                placeholder="예: 솔메이트 6월 급여 테스트"
              />
              <span className="block text-xs text-muted-foreground">
                자료검토·급여정산 목록에 이 이름으로 표시됩니다.
              </span>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">업무유형</span>
              <Select
                value={workType}
                onChange={(event) => {
                  const nextWorkType = event.target.value as WorkType
                  setWorkType(nextWorkType)
                  if (nextWorkType === 'bookkeeping') {
                    setBookkeepingPeriodType('monthly')
                    setAccountingPeriod(defaultBookkeepingPeriod('monthly'))
                  } else {
                    setAccountingPeriod(defaultPeriod(nextWorkType))
                  }
                }}
              >
                {Object.entries(WORK_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </label>
            {workType === 'bookkeeping' && (
              <label className="space-y-1.5">
                <span className="text-sm font-medium">기장 대상 기간</span>
                <Select
                  value={bookkeepingPeriodType}
                  onChange={(event) => {
                    const nextType = event.target.value as BookkeepingPeriodType
                    setBookkeepingPeriodType(nextType)
                    setAccountingPeriod(defaultBookkeepingPeriod(nextType))
                  }}
                >
                  {BOOKKEEPING_PERIOD_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </Select>
              </label>
            )}
            <label className="space-y-1.5">
              <span className="text-sm font-medium">요청 기간</span>
              <Input
                value={accountingPeriod}
                onChange={(event) => setAccountingPeriod(event.target.value)}
                placeholder={workType === 'bookkeeping' && bookkeepingPeriodType === 'yearly'
                  ? '2026'
                  : workType === 'bookkeeping' && bookkeepingPeriodType === 'quarterly'
                    ? '2026-Q2 또는 2026-04'
                    : '2026-06 또는 2026-04~2026-06'}
              />
            </label>
            {workType === 'bookkeeping' && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800 md:col-span-2">
                <span className="font-medium">반영 범위</span>
                <span className="ml-2">
                  {bookkeepingPeriodRange
                    ? `${bookkeepingPeriodRange.start}~${bookkeepingPeriodRange.end}`
                    : '요청 기간을 입력하면 계정항목정리에 반영할 기간이 표시됩니다.'}
                </span>
              </div>
            )}
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-medium">테스트 메모</span>
              <textarea
                value={analysisNotes}
                onChange={(event) => setAnalysisNotes(event.target.value)}
                className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="예: 4~6월 혼합 자료, 잘못 올린 파일 포함"
              />
            </label>
            {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
            <div className="md:col-span-2">
              <Button onClick={createSession} disabled={!clientId || !displayLabel.trim() || isPending}>
                {isPending ? '생성 중...' : '직접 업로드 시작'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{session.clientName} · {session.accountingPeriod}</CardTitle>
                  <CardDescription>담당자 직접 업로드 세션입니다. 파일을 교체한 뒤 다시 제출할 수 있습니다.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">담당자 직접 업로드</Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deletingSession || isPending || uploading}
                    onClick={deleteSession}
                  >
                    <Trash2 className="size-3.5" />
                    {deletingSession ? '삭제 중' : '테스트 삭제'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAnalyzing && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                  <div className="flex min-w-0 items-center gap-2">
                    <RefreshCw className="size-4 shrink-0 animate-spin" />
                    <span>
                      {session.requestKind === 'payroll'
                        ? '급여 원자료가 크면 몇 분 걸릴 수 있습니다. 완료되면 화면이 자동으로 갱신됩니다.'
                        : '파일 분석이 진행 중입니다. 완료되면 화면이 자동으로 갱신됩니다.'}
                    </span>
                  </div>
                  {canCancelAnalysis && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-white"
                      onClick={cancelAnalysis}
                      disabled={cancellingAnalysis}
                    >
                      <Square className="size-3.5" />
                      {cancellingAnalysis ? '중단 중' : '분석 중단'}
                    </Button>
                  )}
                </div>
              )}

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
                  handleFiles(event.dataTransfer.files)
                }}
                onClick={() => {
                  if (canSelectFiles) inputRef.current?.click()
                }}
                className={cn(
                  'flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
                  canSelectFiles && dragging && 'border-primary bg-primary/5',
                  canSelectFiles && !dragging && 'border-border hover:bg-muted/40',
                  !canSelectFiles && 'cursor-not-allowed border-border bg-muted/30 text-muted-foreground',
                )}
                aria-disabled={!canSelectFiles}
              >
                {uploading ? (
                  <RefreshCw className="size-8 animate-spin text-blue-600" />
                ) : (
                  <FileUp className="size-8 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">{uploading ? '파일 등록 중...' : '파일을 끌어다 놓거나 클릭해서 선택'}</p>
                <p className="text-xs text-muted-foreground">
                  {uploading ? '등록이 끝날 때까지 같은 파일을 다시 올리지 마세요.' : 'PDF, Excel, 이미지 · 파일당 최대 50MB'}
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                className="hidden"
                disabled={!canSelectFiles}
                onChange={(event) => {
                  if (event.target.files) handleFiles(event.target.files)
                  event.target.value = ''
                }}
              />

              {hasUploadedFiles ? (
                <div className="space-y-2">
                  {displayedFiles.map((file) => {
                    const display = file.optimistic ? null : resolveUploadedFileDisplay(file)
                    const passwordSubmittable = display?.isPasswordSubmittable ?? false
                    const passwordDisabled = uploading || isPending || isAnalyzing || deletingFileId === file.id

                    return (
                      <div key={file.id} className="rounded-lg border px-3 py-2 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">{file.originalFilename}</p>
                            {passwordSubmittable ? (
                              <p className="mt-1 text-xs text-amber-700">
                                {display?.isPasswordInvalid
                                  ? '입력한 비밀번호가 맞지 않습니다. 다시 입력하거나 비밀번호 없는 파일로 다시 올려 주세요.'
                                  : '비밀번호가 걸려 있어 자료를 확인하지 못했습니다. 아래에서 비밀번호를 입력하거나, 비밀번호 없는 파일로 다시 올려 주세요.'}
                              </p>
                            ) : (
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                {formatBytes(file.fileSize)} · {fileStatusLabel(file)}
                                {(file.status === 'analyzing' || file.status === 'uploading') && (
                                  <RefreshCw className="size-3 animate-spin text-blue-600" />
                                )}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {display ? (
                              <span className={`rounded-full px-2 py-0.5 text-xs ${display.badgeClassName}`}>
                                {display.label}
                              </span>
                            ) : null}
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={file.status === 'uploading' || (Boolean(file.optimistic) && file.status !== 'error') || deletingFileId === file.id || uploading || isPending}
                              onClick={() => {
                                if (file.optimistic) {
                                  setOptimisticUploadedFiles((current) => current.filter((item) => item.id !== file.id))
                                  return
                                }
                                deleteFile(file.id)
                              }}
                              title={file.optimistic && file.status !== 'error' ? '서버 반영 후 삭제할 수 있습니다' : undefined}
                            >
                              <Trash2 className="size-3.5" />
                              {file.status === 'uploading' ? '업로드 중' : file.optimistic ? '목록 제거' : deletingFileId === file.id ? '삭제 중' : '삭제'}
                            </Button>
                          </div>
                        </div>
                        {passwordSubmittable && !file.optimistic ? (
                          <FilePasswordInput
                            fileId={file.id}
                            mode="staff"
                            variant="dashboard"
                            disabled={passwordDisabled}
                            className="mt-3"
                          />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  아직 업로드한 파일이 없습니다.
                </div>
              )}

              {message && <p className="text-sm text-emerald-700">{message}</p>}
              {payrollExtractionErrorMessage && (
                <p className="whitespace-pre-line text-sm text-amber-700">{payrollExtractionErrorMessage}</p>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">다음 작업</CardTitle>
              <CardDescription>파일 업로드 후 제출 완료를 누르면 분석이 시작됩니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={submitFiles} disabled={!hasSubmittableFiles || isPending || uploading || isAnalyzing}>
                <RefreshCw className={cn('size-4', (isPending || isAnalyzing) && 'animate-spin')} />
                {isAnalyzing ? '분석 중...' : uploading ? '파일 등록 중...' : isPending ? '처리 중...' : '제출 완료 / 분석 시작'}
              </Button>
              {canCancelAnalysis && (
                <Button type="button" variant="outline" className="w-full" onClick={cancelAnalysis} disabled={cancellingAnalysis}>
                  <Square className="size-4" />
                  {cancellingAnalysis ? '중단 중...' : '분석 중단'}
                </Button>
              )}
              {canOpenResult ? (
                <Link href={resultPath} className={buttonVariants({ className: 'w-full' })}>
                  결과 화면 열기
                </Link>
              ) : (
                <Button type="button" variant="outline" className="w-full" disabled title="분석 완료 후 열 수 있습니다">
                  결과 화면 열기
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
