import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollEmployeeLine, payrollPeriodSummary } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { buildPayrollRegisterRow, buildPayrollSummaryTotals, type PayrollSummaryTotals } from './summary'

export async function recalculatePayrollPeriodSummary({
  tenantId,
  periodSummaryId,
}: {
  tenantId: string
  periodSummaryId: string
}): Promise<PayrollSummaryTotals | null> {
  const [summary] = await db
    .select({
      id: payrollPeriodSummary.id,
      closeStatus: payrollPeriodSummary.closeStatus,
      noticeImportStatus: payrollPeriodSummary.noticeImportStatus,
    })
    .from(payrollPeriodSummary)
    .where(and(eq(payrollPeriodSummary.id, periodSummaryId), eq(payrollPeriodSummary.tenantId, tenantId)))
    .limit(1)

  if (!summary) return null

  const lines = await db
    .select({
      id: payrollEmployeeLine.id,
      employeeCode: payrollEmployeeLine.employeeCode,
      employeeName: payrollEmployeeLine.employeeName,
      department: payrollEmployeeLine.department,
      jobTitle: payrollEmployeeLine.jobTitle,
      jobType: payrollEmployeeLine.jobType,
      baseSalaryKrw: payrollEmployeeLine.baseSalaryKrw,
      mealAllowanceKrw: payrollEmployeeLine.mealAllowanceKrw,
      allowanceKrw: payrollEmployeeLine.allowanceKrw,
      incomeTaxKrw: payrollEmployeeLine.incomeTaxKrw,
      localIncomeTaxKrw: payrollEmployeeLine.localIncomeTaxKrw,
      nationalPensionKrw: payrollEmployeeLine.nationalPensionKrw,
      healthInsuranceKrw: payrollEmployeeLine.healthInsuranceKrw,
      longTermCareKrw: payrollEmployeeLine.longTermCareKrw,
      employmentInsuranceKrw: payrollEmployeeLine.employmentInsuranceKrw,
      otherDeductionKrw: payrollEmployeeLine.otherDeductionKrw,
      noticeMatchStatus: payrollEmployeeLine.noticeMatchStatus,
      status: payrollEmployeeLine.status,
      issueCode: payrollEmployeeLine.issueCode,
      issueMessage: payrollEmployeeLine.issueMessage,
    })
    .from(payrollEmployeeLine)
    .where(and(
      eq(payrollEmployeeLine.tenantId, tenantId),
      eq(payrollEmployeeLine.periodSummaryId, periodSummaryId),
    ))

  const registerRows = lines.map((line) => buildPayrollRegisterRow(line))
  const totals = buildPayrollSummaryTotals(registerRows, { closeStatus: summary.closeStatus })
  const ts = toDBString(now())
  const nextCloseStatus = summary.closeStatus === 'closed'
    ? 'closed'
    : totals.issueCount > 0 || summary.noticeImportStatus === 'partial'
      ? 'blocked'
      : 'open'

  await db
    .update(payrollPeriodSummary)
    .set({
      employeeCount: totals.employeeCount,
      issueCount: totals.issueCount,
      grossPayKrw: totals.grossPayKrw,
      withholdingTaxKrw: totals.withholdingTaxKrw,
      socialInsuranceKrw: totals.socialInsuranceKrw,
      deductionTotalKrw: totals.deductionTotalKrw,
      netPayKrw: totals.netPayKrw,
      closeStatus: nextCloseStatus,
      updatedAt: ts,
    })
    .where(and(eq(payrollPeriodSummary.id, periodSummaryId), eq(payrollPeriodSummary.tenantId, tenantId)))

  return totals
}
