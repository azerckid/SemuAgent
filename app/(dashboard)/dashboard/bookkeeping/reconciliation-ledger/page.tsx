import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import {
  isReconciliationDisplayFixtureMode,
  loadReconciliationLedgerDisplayFixture,
} from '@/lib/bookkeeping-review/reconciliation-display-loader'
import { normalizeReconciliationDisplayFilter } from '@/lib/bookkeeping-review/reconciliation-display-filters'
import { loadBookkeepingReviewSummary } from '@/lib/bookkeeping-review/summary'
import { BookkeepingReviewBusinessEntityEmptyState } from '../_components/bookkeeping-review'
import { ReconciliationLedgerDisplayFixtureView } from './_components/reconciliation-ledger-display-fixture-view'
import { ReconciliationLedgerView, normalizeReconciliationFilter } from './_components/reconciliation-ledger'

type PageProps = {
  searchParams: Promise<{
    period?: string
    source?: string
    display?: string
  }>
}

export default async function ReconciliationLedgerPage({ searchParams }: PageProps) {
  const { period, source, display } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  if (isReconciliationDisplayFixtureMode(display)) {
    const displayModel = loadReconciliationLedgerDisplayFixture()
    const summary = await loadBookkeepingReviewSummary({
      tenantId,
      periodKey: period,
      tab: 'all',
    })

    return (
      <ReconciliationLedgerDisplayFixtureView
        activeFilter={normalizeReconciliationDisplayFilter(source)}
        companyName={summary.businessEntity?.name ?? summary.tenant.name}
        displayModel={displayModel}
      />
    )
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
