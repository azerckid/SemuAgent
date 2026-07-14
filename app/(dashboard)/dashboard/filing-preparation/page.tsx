import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { buildCompanyHomePeriod } from '@/lib/company-home/summary'
import { buildPeriodNavigationHrefs } from '@/lib/filing-preparation/period-navigation'
import { loadFilingPreparationSummary } from '@/lib/filing-preparation/summary'
import { FilingPreparationBusinessEntityEmptyState, FilingPreparationHub } from './_components/filing-preparation-hub'

type PageProps = {
  searchParams: Promise<{
    period?: string
  }>
}

export default async function FilingPreparationPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadFilingPreparationSummary({ tenantId, periodKey: period })

  if (!summary.businessEntity) {
    return <FilingPreparationBusinessEntityEmptyState tenantName={summary.tenant.name} />
  }

  const latestPeriod = buildCompanyHomePeriod({ timezone: summary.tenant.timezone })
  const periodContext = {
    label: '기준 기간',
    value: summary.period.label,
    ...buildPeriodNavigationHrefs({
      pathname: '/dashboard/filing-preparation',
      periodKey: summary.period.key,
      latestPeriodKey: latestPeriod.key,
      granularity: 'half_year',
    }),
  }

  return <FilingPreparationHub periodContext={periodContext} summary={summary} />
}
