'use client'

import Link from 'next/link'
import { Upload } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import type { PayrollDisplayStatus } from '@/lib/payroll/payroll-status'
import { cn } from '@/lib/utils'
import { CancelPayrollRequestButton } from './cancel-payroll-request-button'
import { StatusModal } from '@/app/(dashboard)/dashboard/_components/status-modal'
import { PayrollUploadedFilesPanel, type PayrollUploadedFile } from './payroll-uploaded-files-panel'

export function PayrollMaterialStatusPopup({
  status,
  eventId,
  displayClientName,
  accountingPeriod,
  files,
  sessionId,
  continueUploadHref,
  showCancelButton,
}: {
  status: PayrollDisplayStatus
  eventId: string
  displayClientName: string
  accountingPeriod: string
  files: PayrollUploadedFile[]
  sessionId: string | null
  continueUploadHref: string | null
  showCancelButton: boolean
}) {
  return (
    <StatusModal
      status={status}
      title="자료 상태"
      subtitle={`${displayClientName} · ${accountingPeriod} 급여 자료`}
      footerActions={
        <>
          {continueUploadHref && (
            <Link href={continueUploadHref} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              <Upload className="size-4" />
              업로드 이어하기
            </Link>
          )}
          {showCancelButton && (
            <CancelPayrollRequestButton
              eventId={eventId}
              clientName={displayClientName}
              accountingPeriod={accountingPeriod}
            />
          )}
        </>
      }
    >
      <PayrollUploadedFilesPanel files={files} sessionId={sessionId} />
    </StatusModal>
  )
}
