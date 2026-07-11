import { and, asc, eq } from 'drizzle-orm'
import type { DateTime } from 'luxon'
import { getTenantBillingProfile } from '@/lib/billing/profile'
import { buildCompanyHomePeriod } from '@/lib/company-home/summary'
import { client, payrollPeriodSummary, tenant } from '@/lib/db/schema'
import {
  buildFilingPeriod,
  buildPayrollFilingSource,
} from '@/lib/filing-support/summary'
import {
  buildLocalIncomeTaxTotals,
  loadLocalIncomeTaxLines,
} from '@/lib/local-income-tax/summary'
import { employeeKeyOf } from '@/lib/payment-statements/summary'
import { buildWithholdingEfilingSummary } from './panel-summary'
import type { WithholdingBusinessContext } from './panel-summary'
import type { ValidateWithholdingPanelInput, WithholdingPayrollLine } from './types'

const DEFAULT_TZ = 'Asia/Seoul'

export type WithholdingEfilingContext = {
  panelInput: ValidateWithholdingPanelInput
  business: WithholdingBusinessContext
}

function buildWithholdingLines(
  lines: Array<{
    employeeCode: string | null
    employeeName: string
    grossPayKrw: number
    incomeTaxKrw: number
    status: 'ready' | 'needs_review' | 'closed'
  }>,
): WithholdingPayrollLine[] {
  return lines.map((line) => ({
    employeeKey: employeeKeyOf({ employeeCode: line.employeeCode, employeeName: line.employeeName }),
    employeeName: line.employeeName,
    grossPayKrw: line.grossPayKrw,
    incomeTaxKrw: line.incomeTaxKrw,
    status: line.status,
  }))
}

export async function loadWithholdingEfilingContext(params: {
  tenantId: string
  periodKey?: string | null
  today?: DateTime
}): Promise<WithholdingEfilingContext | null> {
  const { db } = await import('@/lib/db')

  const tenantRows = await db
    .select({ id: tenant.id, name: tenant.name, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, params.tenantId))
    .limit(1)
  const tenantRow = tenantRows[0] ?? { id: params.tenantId, name: '회사', timezone: DEFAULT_TZ }

  const companyPeriod = buildCompanyHomePeriod({
    periodKey: params.periodKey,
    today: params.today,
    timezone: tenantRow.timezone,
  })
  const period = buildFilingPeriod(companyPeriod)

  const businessEntityRows = await db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.tenantId, params.tenantId))
    .orderBy(asc(client.createdAt))
    .limit(1)
  const businessEntity = businessEntityRows[0]
  if (!businessEntity) return null

  const payrollRows = await db
    .select({
      id: payrollPeriodSummary.id,
      employeeCount: payrollPeriodSummary.employeeCount,
      grossPayKrw: payrollPeriodSummary.grossPayKrw,
      withholdingTaxKrw: payrollPeriodSummary.withholdingTaxKrw,
      socialInsuranceKrw: payrollPeriodSummary.socialInsuranceKrw,
      noticeImportStatus: payrollPeriodSummary.noticeImportStatus,
      closeStatus: payrollPeriodSummary.closeStatus,
      issueCount: payrollPeriodSummary.issueCount,
      withholdingStatementStatus: payrollPeriodSummary.withholdingStatementStatus,
      insuranceStatementStatus: payrollPeriodSummary.insuranceStatementStatus,
    })
    .from(payrollPeriodSummary)
    .where(and(
      eq(payrollPeriodSummary.tenantId, params.tenantId),
      eq(payrollPeriodSummary.clientId, businessEntity.id),
      eq(payrollPeriodSummary.payrollPeriod, period.payrollPeriodKey),
    ))
    .limit(1)

  const payrollBase = payrollRows[0]
  if (!payrollBase) return null

  const localIncomeTaxLines = await loadLocalIncomeTaxLines({
    tenantId: params.tenantId,
    clientId: businessEntity.id,
    periodSummaryId: payrollBase.id,
  })
  const localIncomeTaxTotals = buildLocalIncomeTaxTotals(localIncomeTaxLines)
  const payroll = buildPayrollFilingSource(payrollBase, localIncomeTaxTotals)

  const billing = await getTenantBillingProfile(params.tenantId)
  const business: WithholdingBusinessContext = {
    businessRegistrationNumber: billing?.businessRegistrationNumber ?? null,
    businessName: billing?.businessName ?? businessEntity.name,
    representativeName: billing?.representativeName ?? null,
    maskedBusinessRegistrationNumber: billing?.maskedBusinessRegistrationNumber ?? null,
  }

  const panelInput: ValidateWithholdingPanelInput = {
    payrollPeriodKey: period.payrollPeriodKey,
    closeStatus: payrollBase.closeStatus,
    periodEmployeeCount: payrollBase.employeeCount,
    periodGrossPayKrw: payrollBase.grossPayKrw,
    confirmedEmployeeCount: localIncomeTaxTotals.readyEmployees,
    confirmedGrossPayKrw: localIncomeTaxTotals.grossPayKrw,
    confirmedIncomeTaxKrw: localIncomeTaxTotals.incomeTaxKrw,
    localIncomeTaxKrw: localIncomeTaxTotals.localIncomeTaxKrw,
    guideEmployeeCount: payroll.employeeCount,
    guideGrossPayKrw: payroll.grossPayKrw,
    guideIncomeTaxKrw: payroll.incomeTaxKrw,
    businessRegistrationNumber: business.businessRegistrationNumber ?? '',
    businessName: business.businessName,
    representativeName: business.representativeName ?? '',
    lines: buildWithholdingLines(localIncomeTaxLines),
  }

  return { panelInput, business }
}

export async function loadWithholdingEfilingSummary(params: Parameters<typeof loadWithholdingEfilingContext>[0]) {
  const ctx = await loadWithholdingEfilingContext(params)
  if (!ctx) return null

  return buildWithholdingEfilingSummary({
    panelInput: ctx.panelInput,
    business: ctx.business,
  })
}
