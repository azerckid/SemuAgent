import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollPeriodSummary, vatPeriodSummary } from '@/lib/db/schema'
import type { DateTime } from '@/lib/time'
import type { CompanyScheduleApplicability } from '@/lib/tax-calendar'

export async function loadCompanyScheduleApplicability(params: {
  tenantId: string
  clientId: string
  vatPeriodKey: string
  today: DateTime
}): Promise<CompanyScheduleApplicability> {
  const payrollPeriod = params.today.minus({ months: 1 }).toFormat('yyyy-MM')
  const [vatRows, payrollRows] = await Promise.all([
    db
      .select({ id: vatPeriodSummary.id })
      .from(vatPeriodSummary)
      .where(and(
        eq(vatPeriodSummary.tenantId, params.tenantId),
        eq(vatPeriodSummary.clientId, params.clientId),
        eq(vatPeriodSummary.periodKey, params.vatPeriodKey),
      ))
      .limit(1),
    db
      .select({ employeeCount: payrollPeriodSummary.employeeCount })
      .from(payrollPeriodSummary)
      .where(and(
        eq(payrollPeriodSummary.tenantId, params.tenantId),
        eq(payrollPeriodSummary.clientId, params.clientId),
        eq(payrollPeriodSummary.payrollPeriod, payrollPeriod),
      ))
      .limit(1),
  ])

  return {
    vat: vatRows.length > 0,
    payroll: (payrollRows[0]?.employeeCount ?? 0) > 0,
  }
}
