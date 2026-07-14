import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { buildCompanyHomePeriod } from '@/lib/company-home/summary'
import { buildPeriodNavigationHrefs } from '@/lib/filing-preparation/period-navigation'
import { loadLocalIncomeTaxSummary } from '@/lib/local-income-tax/summary'
import { LocalIncomeTaxEmptyState, LocalIncomeTaxReview } from './_components/local-income-tax-review'

type PageProps = {
  searchParams: Promise<{
    period?: string
  }>
}

export default async function LocalIncomeTaxPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadLocalIncomeTaxSummary({ tenantId, periodKey: period })

  if (!summary.businessEntity) {
    return <LocalIncomeTaxEmptyState tenantName={summary.tenant.name} />
  }

  const latestPeriod = buildCompanyHomePeriod({ timezone: summary.tenant.timezone })
  const periodContext = {
    label: '귀속기간',
    value: summary.period.periodLabel,
    ...buildPeriodNavigationHrefs({
      pathname: '/dashboard/filing-preparation/local-income-tax',
      periodKey: summary.period.periodKey,
      latestPeriodKey: latestPeriod.endMonth,
      granularity: 'month',
    }),
  }

  return <LocalIncomeTaxReview periodContext={periodContext} summary={summary} />
}
