'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Download, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type CompletionAcceptedFile = {
  id: string
  originalFilename: string
  fileType: string
  fileSize: number
  uploadedAt: string
}

export function formatCompletionPeriod(period: string) {
  if (/^\d{4}-Q[1-4]$/.test(period)) {
    const [year, q] = period.split('-Q')
    return `${year}년 ${q}분기`
  }
  if (/^\d{4}-H[1-2]$/.test(period)) {
    const [year, h] = period.split('-H')
    return `${year}년 ${h === '1' ? '상반기' : '하반기'}`
  }
  if (/^\d{4}$/.test(period)) return `${period}년`
  const [year, month] = period.split('-')
  return `${year}년 ${Number.parseInt(month, 10)}월`
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CompletionApprovalPanel({
  sessionId,
  status,
  clientName,
  clientEmail,
  staffName,
  accountingPeriod,
  acceptedFiles,
  completionKind = null,
  className,
}: {
  sessionId: string
  status: string
  clientName: string
  clientEmail: string
  staffName: string | null
  accountingPeriod: string
  acceptedFiles: CompletionAcceptedFile[]
  completionKind?: 'normal' | 'exception' | null
  className?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  if (!['ready_for_accountant', 'completed'].includes(status)) return null

  const isExceptionCompletion = completionKind === 'exception'
  const formattedPeriod = formatCompletionPeriod(accountingPeriod)
  const senderName = staffName ?? '담당자'
  const subject = `[${senderName}] ${formattedPeriod} 기장 자료 제출 완료 안내`
  const canComplete = status === 'ready_for_accountant' && acceptedFiles.length > 0
  const panelTitle = isExceptionCompletion ? '예외 승인 완료 처리' : '자료 충족 완료 처리'
  const panelDescription = isExceptionCompletion
    ? '담당자 예외 검토로 완료 가능 상태입니다. 부합 자료를 확인한 뒤 완료 감사메일을 발송합니다.'
    : '부합 자료를 내려받고, 완료 감사메일을 확인한 뒤 담당자가 직접 발송합니다.'
  const completeButtonLabel = isExceptionCompletion
    ? '예외 승인으로 완료 처리 및 메일 발송'
    : '완료 처리 및 메일 발송'

  const handleComplete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/completion`, { method: 'POST' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(body?.error ?? '완료 처리에 실패했습니다')
        return
      }
      toast.success(body?.alreadyCompleted ? '이미 완료 처리된 세션입니다' : '완료 감사메일을 발송하고 세션을 완료했습니다')
      startTransition(() => router.refresh())
    } catch {
      toast.error('완료 처리에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={cn(
      isExceptionCompletion ? 'border-violet-200 bg-violet-50/40' : 'border-emerald-200 bg-emerald-50/40',
      className,
    )}>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className={cn(
              'flex flex-wrap items-center gap-2',
              isExceptionCompletion ? 'text-violet-900' : 'text-emerald-900',
            )}>
              <CheckCircle2 className="size-4" />
              {panelTitle}
            </CardTitle>
            <CardDescription>{panelDescription}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {isExceptionCompletion ? (
              <Badge variant="outline">담당자 예외 검토</Badge>
            ) : null}
            <Badge variant={status === 'completed' ? 'success' : 'warning'}>
              {status === 'completed'
                ? (isExceptionCompletion ? '예외 승인 완료' : '완료됨')
                : (isExceptionCompletion ? '예외 승인 필요' : '승인 필요')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <section className={cn(
          'rounded-lg border bg-background p-3',
          isExceptionCompletion ? 'border-violet-100' : 'border-emerald-100',
        )}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-foreground">부합 자료 다운로드</h3>
              <p className="text-xs text-muted-foreground">
                AI 검증에서 충족으로 연결된 파일만 표시합니다.
              </p>
            </div>
            <Badge variant={acceptedFiles.length > 0 ? 'success' : 'destructive'}>
              {acceptedFiles.length > 0 ? `${acceptedFiles.length}개` : '없음'}
            </Badge>
          </div>
          {acceptedFiles.length > 0 ? (
            <ul className="grid gap-2">
              {acceptedFiles.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{file.originalFilename}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.fileSize)} · {file.fileType}</p>
                  </div>
                  <a
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    href={`/api/sessions/${sessionId}/accepted-files/download?fileId=${encodeURIComponent(file.id)}`}
                  >
                    <Download className="size-3.5" />
                    다운로드
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn(
              'rounded-md border border-dashed px-3 py-4 text-center text-sm',
              isExceptionCompletion
                ? 'border-violet-200 bg-violet-50 text-violet-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800',
            )}>
              부합 파일 연결 정보가 없어 완료 처리를 진행할 수 없습니다.
            </p>
          )}
        </section>

        <section className={cn(
          'rounded-lg border bg-background p-3',
          isExceptionCompletion ? 'border-violet-100' : 'border-emerald-100',
        )}>
          <div className="mb-2">
            <h3 className="text-sm font-medium text-foreground">완료 감사메일 미리보기</h3>
            <p className="text-xs text-muted-foreground">{clientEmail}로 발송됩니다.</p>
          </div>
          {isExceptionCompletion ? (
            <p className="mb-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
              담당자 예외 검토로 완료 처리됩니다. 고객 메일 본문은 기존 완료 안내 문구를 사용합니다.
            </p>
          ) : null}
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium text-foreground">{subject}</p>
            <p className="mt-2 leading-6 text-muted-foreground">
              안녕하세요, {clientName} 담당자님.
              <br />
              {formattedPeriod} 기장 처리를 위한 자료 제출이 완료되었습니다.
              <br />
              신속한 자료 제출에 감사드립니다. 기장 처리 후 별도로 안내드리겠습니다.
            </p>
          </div>
        </section>

        {status === 'ready_for_accountant' ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              버튼을 누르면 완료 감사메일이 발송되고 세션이 완료 상태로 닫힙니다.
            </p>
            <Button onClick={handleComplete} disabled={!canComplete || loading}>
              <Send className="size-4" />
              {loading ? '처리 중...' : completeButtonLabel}
            </Button>
          </div>
        ) : (
          <p className={cn(
            'rounded-md border px-3 py-2 text-sm',
            isExceptionCompletion
              ? 'border-violet-200 bg-violet-50 text-violet-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800',
          )}>
            {isExceptionCompletion
              ? '이 세션은 담당자 예외 검토 후 완료 처리되었습니다. 부합 자료 다운로드는 계속 사용할 수 있습니다.'
              : '이 세션은 완료 처리되었습니다. 부합 자료 다운로드는 계속 사용할 수 있습니다.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
