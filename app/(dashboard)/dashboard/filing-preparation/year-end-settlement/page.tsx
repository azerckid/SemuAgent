import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { buildPeriodNavigationHrefs } from '@/lib/filing-preparation/period-navigation'
import { loadYearEndSettlementSummary, resolveYearEndPeriodKey } from '@/lib/payment-statements/summary'
import { now } from '@/lib/time'
import {
  YearEndSettlementEmptyState,
  YearEndSettlementReview,
} from './_components/year-end-settlement-review'

type PageProps = {
  searchParams: Promise<{
    period?: string
  }>
}

export default async function YearEndSettlementPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadYearEndSettlementSummary({ tenantId, periodKey: period })

  if (!summary.businessEntity) {
    return <YearEndSettlementEmptyState tenantName={summary.tenant.name} />
  }

  const latestYear = resolveYearEndPeriodKey(now(summary.tenant.timezone)).slice(0, 4)
  const isYearOpen = summary.context.yearPeriodStatus === 'open'
  const periodContext = {
    label: '귀속연도',
    value: `${summary.context.year}년${isYearOpen ? ' · 진행 중' : ''}`,
    ...buildPeriodNavigationHrefs({
      pathname: '/dashboard/filing-preparation/year-end-settlement',
      periodKey: String(summary.context.year),
      latestPeriodKey: latestYear,
      granularity: 'year',
    }),
  }

  return <YearEndSettlementReview periodContext={periodContext} summary={summary} />
}
