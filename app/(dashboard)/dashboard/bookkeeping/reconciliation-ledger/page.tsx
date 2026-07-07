import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadBookkeepingReviewSummary } from '@/lib/bookkeeping-review/summary'
import { BookkeepingReviewBusinessEntityEmptyState } from '../_components/bookkeeping-review'
import { ReconciliationLedgerView, normalizeReconciliationFilter } from './_components/reconciliation-ledger'

type PageProps = {
  searchParams: Promise<{
    period?: string
    source?: string
  }>
}

export default async function ReconciliationLedgerPage({ searchParams }: PageProps) {
  const { period, source } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadBookkeepingReviewSummary({
    tenantId,
    periodKey: period,
    tab: 'all',
  })

  if (!summary.businessEntity) {
    return <BookkeepingReviewBusinessEntityEmptyState tenantName={summary.tenant.name} />
  }

  return <ReconciliationLedgerView activeFilter={normalizeReconciliationFilter(source)} summary={summary} />
}
