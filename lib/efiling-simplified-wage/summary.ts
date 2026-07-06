import { and, eq, inArray } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { getTenantBillingProfile } from '@/lib/billing/profile'
import { client, employeeProfile, payrollEmployeeLine, payrollPeriodSummary } from '@/lib/db/schema'
import {
  employeeKeyOf,
  loadPaymentStatementSummary,
  type EmployeeProfileInput,
  type PaymentStatementSummary,
  type PayrollLineInput,
  type ReportingContext,
} from '@/lib/payment-statements/summary'
import { now } from '@/lib/time'
import { buildEmployeeSegments } from './employee-segments'
import {
  buildSimplifiedWageEfilingSummary,
  type EfilingBusinessContext,
  type SimplifiedWageEfilingSummary,
} from './panel-summary'
import type { SubmitterKind } from './types'

export type {
  EfilingFormatCheck,
  EfilingPanelTone,
  EfilingValidationDisplayItem,
  SimplifiedWageEfilingSummary,
} from './panel-summary'

export { buildSimplifiedWageEfilingSummary } from './panel-summary'

function submitterKindFromTaxEntity(taxEntityType: string | null | undefined): SubmitterKind {
  return taxEntityType === 'corporation' ? 'corporation' : 'individual'
}

function missingPayrollMonths(
  context: ReportingContext,
  periodMonthsPresent: Set<string>,
): string[] {
  return context.halfMonths.filter((m) => !periodMonthsPresent.has(m))
}

async function loadPayrollDetail(tenantId: string, clientId: string, context: ReportingContext) {
  const { db } = await import('@/lib/db')

  const periodRows = await db
    .select({ id: payrollPeriodSummary.id, period: payrollPeriodSummary.payrollPeriod })
    .from(payrollPeriodSummary)
    .where(and(
      eq(payrollPeriodSummary.tenantId, tenantId),
      eq(payrollPeriodSummary.clientId, clientId),
      inArray(payrollPeriodSummary.payrollPeriod, context.yearMonths),
    ))
  const periodById = new Map(periodRows.map((r) => [r.id, r.period]))

  const lineRows = periodRows.length > 0
    ? await db
        .select({
          periodSummaryId: payrollEmployeeLine.periodSummaryId,
          employeeCode: payrollEmployeeLine.employeeCode,
          employeeName: payrollEmployeeLine.employeeName,
          grossPayKrw: payrollEmployeeLine.grossPayKrw,
          incomeTaxKrw: payrollEmployeeLine.incomeTaxKrw,
          status: payrollEmployeeLine.status,
        })
        .from(payrollEmployeeLine)
        .where(and(
          eq(payrollEmployeeLine.tenantId, tenantId),
          eq(payrollEmployeeLine.clientId, clientId),
          inArray(payrollEmployeeLine.periodSummaryId, [...periodById.keys()]),
        ))
    : []

  const lines: PayrollLineInput[] = lineRows.map((r) => ({
    employeeCode: r.employeeCode,
    employeeName: r.employeeName,
    period: periodById.get(r.periodSummaryId) ?? '',
    grossPayKrw: r.grossPayKrw,
    incomeTaxKrw: r.incomeTaxKrw,
    status: r.status,
  }))

  const profileRows = await db
    .select({
      employeeCode: employeeProfile.employeeCode,
      displayName: employeeProfile.displayName,
      employeeStatus: employeeProfile.employeeStatus,
      hireDate: employeeProfile.hireDate,
      terminationDate: employeeProfile.terminationDate,
    })
    .from(employeeProfile)
    .where(and(
      eq(employeeProfile.tenantId, tenantId),
      eq(employeeProfile.clientId, clientId),
    ))

  const profiles: EmployeeProfileInput[] = profileRows.map((r) => ({
    employeeCode: r.employeeCode,
    displayName: r.displayName,
    employeeStatus: r.employeeStatus,
    hireDate: r.hireDate,
    terminationDate: r.terminationDate,
  }))

  return { lines, profiles }
}

function groupLinesAndProfiles(
  lines: PayrollLineInput[],
  profiles: EmployeeProfileInput[],
  simplified: PaymentStatementSummary['simplified'],
) {
  const linesByEmployeeKey = new Map<string, PayrollLineInput[]>()
  const profilesByEmployeeKey = new Map<string, EmployeeProfileInput>()

  for (const line of lines) {
    const key = employeeKeyOf({ employeeCode: line.employeeCode, employeeName: line.employeeName })
    const bucket = linesByEmployeeKey.get(key) ?? []
    bucket.push(line)
    linesByEmployeeKey.set(key, bucket)
  }

  for (const profile of profiles) {
    const key = employeeKeyOf({ employeeCode: profile.employeeCode, displayName: profile.displayName })
    profilesByEmployeeKey.set(key, profile)
  }

  for (const row of simplified) {
    if (!linesByEmployeeKey.has(row.employeeKey)) {
      linesByEmployeeKey.set(row.employeeKey, [])
    }
  }

  return { linesByEmployeeKey, profilesByEmployeeKey }
}

export async function loadSimplifiedWageEfilingSummary(params: {
  tenantId: string
  periodKey?: string | null
  today?: DateTime
}): Promise<SimplifiedWageEfilingSummary | null> {
  const paymentSummary = await loadPaymentStatementSummary({
    tenantId: params.tenantId,
    periodKey: params.periodKey,
    today: params.today,
  })

  if (!paymentSummary.businessEntity) {
    return null
  }

  const { db } = await import('@/lib/db')
  const clientRows = await db
    .select({ taxEntityType: client.taxEntityType })
    .from(client)
    .where(eq(client.id, paymentSummary.businessEntity.id))
    .limit(1)

  const billing = await getTenantBillingProfile(params.tenantId)
  const submitterKind = submitterKindFromTaxEntity(clientRows[0]?.taxEntityType)

  const business: EfilingBusinessContext = {
    businessRegistrationNumber: billing?.businessRegistrationNumber ?? null,
    businessName: billing?.businessName ?? paymentSummary.businessEntity.name,
    representativeName: billing?.representativeName ?? null,
    submitterKind,
    maskedBusinessRegistrationNumber: billing?.maskedBusinessRegistrationNumber ?? null,
  }

  const { lines, profiles } = await loadPayrollDetail(
    params.tenantId,
    paymentSummary.businessEntity.id,
    paymentSummary.context,
  )

  const periodMonthsPresent = new Set(
    lines
      .filter((l) => paymentSummary.context.halfMonths.includes(l.period))
      .map((l) => l.period),
  )

  const { linesByEmployeeKey, profilesByEmployeeKey } = groupLinesAndProfiles(
    lines,
    profiles,
    paymentSummary.simplified,
  )

  const employees = buildEmployeeSegments({
    simplified: paymentSummary.simplified,
    linesByEmployeeKey,
    profilesByEmployeeKey,
    context: paymentSummary.context,
  })

  const submittedOn = (params.today ?? now('Asia/Seoul')).toFormat('yyyyMMdd')

  return buildSimplifiedWageEfilingSummary({
    paymentSummary,
    business,
    employees,
    missingPayrollMonths: missingPayrollMonths(paymentSummary.context, periodMonthsPresent),
    submittedOn,
  })
}
