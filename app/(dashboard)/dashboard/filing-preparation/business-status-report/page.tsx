import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import {
  loadBusinessStatusReportSummary,
  resolveBusinessStatusFiscalYear,
} from '@/lib/business-status-report/summary'
import { buildPeriodNavigationHrefs } from '@/lib/filing-preparation/period-navigation'
import { now } from '@/lib/time'
import { BusinessStatusReportEmptyState, BusinessStatusReportReview } from './_components/business-status-report-review'

type PageProps = {
  searchParams: Promise<{ period?: string }>
}

export default async function BusinessStatusReportPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadBusinessStatusReportSummary({ tenantId, periodKey: period })

  if (!summary.businessEntity) {
    return <BusinessStatusReportEmptyState tenantName={summary.tenant.name} />
  }

  const latestFiscalYear = resolveBusinessStatusFiscalYear(now(summary.tenant.timezone))
  const periodContext = {
    label: '귀속연도',
    value: `${summary.fiscalYear}년`,
    ...buildPeriodNavigationHrefs({
      pathname: '/dashboard/filing-preparation/business-status-report',
      periodKey: String(summary.fiscalYear),
      latestPeriodKey: String(latestFiscalYear),
      granularity: 'year',
    }),
  }

  return <BusinessStatusReportReview periodContext={periodContext} summary={summary} />
}
