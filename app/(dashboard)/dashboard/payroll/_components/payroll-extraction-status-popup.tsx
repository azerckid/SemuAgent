'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PayrollAdaptiveStructuringEligibility } from '@/lib/payroll/adaptive-structuring-eligibility'
import type { PayrollRow } from '@/lib/payroll/load-payroll-summary-by-event-id'
import type { PayrollDisplayStatus } from '@/lib/payroll/payroll-status'
import { cn } from '@/lib/utils'
import { PayrollAdaptiveStructuringButton } from './payroll-adaptive-structuring-button'
import { StatusModal } from '@/app/(dashboard)/dashboard/_components/status-modal'
import { RerunPayrollExtractionButton } from './rerun-payroll-extraction-button'

const EARNING_FIELD_KEYS = [
  'baseSalary',
  'bonus',
  'mealAllowance',
  'transportationAllowance',
  'holidayWorkAllowance',
  'domesticTravelAllowance',
  'annualLeaveAllowance',
  'rndAllowance',
  'otherAllowance',
  'performanceIncentive',
  'nightWorkAllowance',
  'vehicleMaintenanceAllowance',
  'retroactivePay',
  'overtimeAllowance',
  'childcareAllowance',
] as const satisfies readonly (keyof PayrollRow)[]

function sumEarnings(row: PayrollRow): number {
  return EARNING_FIELD_KEYS.reduce((sum, key) => sum + (row[key] ?? 0), 0)
}

function formatAmount(value: number | null) {
  if (value === null) return '-'
  return `${value.toLocaleString('ko-KR')}원`
}

const VERDICT_LABEL: Record<string, string> = {
  pass: '적합',
  fail: '부적합',
}

export function PayrollExtractionStatusPopup({
  status,
  displayClientName,
  accountingPeriod,
  rows,
  sessionId,
  reviewNotice,
  successMessage,
  rerunDisabled,
  sessionDetailLink,
  adaptiveStructuring,
}: {
  status: PayrollDisplayStatus
  displayClientName: string
  accountingPeriod: string
  rows: PayrollRow[]
  sessionId: string | null
  reviewNotice: string | null
  successMessage: string | null
  rerunDisabled: boolean
  sessionDetailLink: { show: boolean; label: string } | null
  adaptiveStructuring: {
    eligibility: PayrollAdaptiveStructuringEligibility
    candidateFiles: { id: string; originalFilename: string }[]
  } | null
}) {
  const needsReviewCount = rows.filter((row) => row.aiVerdict === 'fail').length

  return (
    <StatusModal
      status={status}
      title="추출 상태"
      subtitle={`${displayClientName} · ${accountingPeriod} 급여 자료`}
      wide
      summary={[
        { label: '추출 상태', value: status.label },
        { label: '인식 row', value: `${rows.length}건` },
        { label: '검토필요', value: `${needsReviewCount}건` },
      ]}
      footerActions={
        sessionId && (
          <>
            {adaptiveStructuring && (
              <PayrollAdaptiveStructuringButton
                sessionId={sessionId}
                eligibility={adaptiveStructuring.eligibility}
                candidateFiles={adaptiveStructuring.candidateFiles}
              />
            )}
            <RerunPayrollExtractionButton sessionId={sessionId} disabled={rerunDisabled} />
            {sessionDetailLink?.show && (
              <Link href={`/dashboard/sessions/${sessionId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                {sessionDetailLink.label}
              </Link>
            )}
          </>
        )
      }
    >
      {reviewNotice && (
        <div className="whitespace-pre-line rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {reviewNotice}
        </div>
      )}
      {successMessage && (
        <div className="whitespace-pre-line rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          아직 추출된 직원 row가 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>직원</TableHead>
                <TableHead>지급월</TableHead>
                <TableHead className="text-right">지급액</TableHead>
                <TableHead className="text-right">공제액</TableHead>
                <TableHead className="text-right">실지급액</TableHead>
                <TableHead>판정</TableHead>
                <TableHead>사유</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const grossPay = sumEarnings(row)
                const deduction = row.deductionAmount ?? 0
                const netPay = grossPay - deduction

                return (
                  <TableRow key={row.id} className={row.aiVerdict === 'fail' ? 'bg-red-50/50' : undefined}>
                    <TableCell className="whitespace-nowrap font-medium">{row.employeeName ?? '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">{row.payrollPeriod}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(grossPay)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(row.deductionAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(netPay)}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'rounded-md border px-1.5 py-0.5 text-[11px] font-semibold',
                          row.aiVerdict === 'fail'
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                        )}
                      >
                        {VERDICT_LABEL[row.aiVerdict ?? ''] ?? '미판정'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-xs text-muted-foreground" title={row.aiVerdictReason ?? undefined}>
                      {row.aiVerdictReason ?? '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </StatusModal>
  )
}
