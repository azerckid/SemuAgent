import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadYearEndSettlementSummary } from '@/lib/payment-statements/summary'
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

  return <YearEndSettlementReview summary={summary} />
}
