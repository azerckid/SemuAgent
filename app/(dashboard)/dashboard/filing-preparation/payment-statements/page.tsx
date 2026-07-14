import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadSimplifiedWageEfilingSummary } from '@/lib/efiling-simplified-wage/summary'
import { buildPeriodNavigationHrefs } from '@/lib/filing-preparation/period-navigation'
import { loadPaymentStatementSummary, resolveReportingContext } from '@/lib/payment-statements/summary'
import { now } from '@/lib/time'
import { PaymentStatementEmptyState, PaymentStatementReview } from './_components/payment-statement-review'

type PageProps = {
  searchParams: Promise<{
    period?: string
  }>
}

export default async function PaymentStatementsPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const [summary, efiling] = await Promise.all([
    loadPaymentStatementSummary({ tenantId, periodKey: period }),
    loadSimplifiedWageEfilingSummary({ tenantId, periodKey: period }),
  ])

  if (!summary.businessEntity) {
    return <PaymentStatementEmptyState tenantName={summary.tenant.name} />
  }

  const latestContext = resolveReportingContext(now(summary.tenant.timezone))
  const periodContext = {
    label: '기간',
    value: summary.context.halfLabel,
    ...buildPeriodNavigationHrefs({
      pathname: '/dashboard/filing-preparation/payment-statements',
      periodKey: `${summary.context.year}-H${summary.context.half}`,
      latestPeriodKey: `${latestContext.year}-H${latestContext.half}`,
      granularity: 'half_year',
    }),
  }

  return <PaymentStatementReview efiling={efiling} periodContext={periodContext} summary={summary} />
}
