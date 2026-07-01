'use client'

import { Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import type { PayrollDraftRow } from '@/lib/payroll/load-payroll-summary-by-event-id'
import type { PayrollResultExcelDownloadState } from '@/lib/sessions/payroll-source-download'
import { formatDateTimeLong } from '@/lib/client-format'
import type { PayrollDisplayStatus } from '@/lib/payroll/payroll-status'
import { cn } from '@/lib/utils'
import { GeneratePayrollDraftButton } from './generate-payroll-draft-button'
import { StatusModal } from '@/app/(dashboard)/dashboard/_components/status-modal'

export function PayrollExcelStatusPopup({
  status,
  displayClientName,
  accountingPeriod,
  selectionHref,
  sessionId,
  passCount,
  failCount,
  latestDraft,
  resultDownloadState,
}: {
  status: PayrollDisplayStatus
  displayClientName: string
  accountingPeriod: string
  selectionHref: string
  sessionId: string | null
  passCount: number
  failCount: number
  latestDraft: PayrollDraftRow | null
  resultDownloadState: PayrollResultExcelDownloadState
}) {
  return (
    <StatusModal
      status={status}
      title="엑셀 상태"
      subtitle={`${displayClientName} · ${accountingPeriod} 급여 자료`}
      summary={[
        { label: '엑셀 상태', value: status.label },
        { label: 'draft', value: latestDraft ? '1건' : '0건' },
        { label: '다운로드', value: resultDownloadState.enabled ? '가능' : '불가' },
      ]}
      footerActions={
        sessionId && (
          <GeneratePayrollDraftButton
            sessionId={sessionId}
            passCount={passCount}
            enabled={resultDownloadState.enabled}
            disabledReason={resultDownloadState.enabled ? undefined : resultDownloadState.detail}
            successHref={selectionHref}
            disabledLabel={
              resultDownloadState.enabled
                ? undefined
                : failCount > 0
                  ? `부적합 ${failCount}개 보완 후 작성`
                  : resultDownloadState.label
            }
          />
        )
      }
    >
      {latestDraft ? (
        <div className={cn('rounded-lg border px-3 py-3', latestDraft.status === 'failed' && 'border-red-200 bg-red-50')}>
          <p className="text-sm font-medium text-foreground">{latestDraft.filename}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            적합 {latestDraft.passRowCount}명 · 부적합 {latestDraft.excludedRowCount}명 · {formatDateTimeLong(latestDraft.generatedAt)}
          </p>
          {latestDraft.status === 'generated' && sessionId && (
            resultDownloadState.enabled ? (
              <a
                href={`/api/sessions/${sessionId}/payroll/drafts/${latestDraft.id}/download`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}
              >
                <Download className="size-4" />
                결과 엑셀 다운로드
              </a>
            ) : (
              <button
                type="button"
                disabled
                title={resultDownloadState.detail}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3 cursor-not-allowed opacity-50')}
              >
                <Download className="size-4" />
                결과 엑셀 다운로드
              </button>
            )
          )}
          {latestDraft.status === 'failed' && latestDraft.errorMessage && (
            <p className="mt-2 text-xs text-red-700">{latestDraft.errorMessage}</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          아직 생성된 결과 엑셀이 없습니다.
        </div>
      )}
    </StatusModal>
  )
}
