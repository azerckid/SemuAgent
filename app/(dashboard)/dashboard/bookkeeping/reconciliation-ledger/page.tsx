import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import {
  isReconciliationDisplayFixtureMode,
  loadReconciliationLedgerDisplayFixture,
} from '@/lib/bookkeeping-review/reconciliation-display-loader'
import { buildLiveReconciliationLedgerDisplayModel } from '@/lib/bookkeeping-review/reconciliation-live-display-model'
import { normalizeReconciliationDisplayFilter } from '@/lib/bookkeeping-review/reconciliation-display-filters'
import { loadBookkeepingReviewSummary } from '@/lib/bookkeeping-review/summary'
import { BookkeepingReviewBusinessEntityEmptyState } from '../_components/bookkeeping-review'
import { ReconciliationLedgerDisplayFixtureView } from './_components/reconciliation-ledger-display-fixture-view'

type PageProps = {
  searchParams: Promise<{
    period?: string
    source?: string
    display?: string
    row?: string
  }>
}

export default async function ReconciliationLedgerPage({ searchParams }: PageProps) {
  const { period, source, display, row } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const isFixtureMode = isReconciliationDisplayFixtureMode(display)

  const summary = await loadBookkeepingReviewSummary({
    tenantId,
    periodKey: period,
    tab: 'all',
    // 자료대조원장은 제외 처리된 거래도 보이고 감사·되돌릴 수 있어야
    // 한다(분류 큐와 달리). filterRowsByTab의 excluded 숨김을 우회한다.
    includeExcluded: true,
  })

  if (!isFixtureMode && !summary.businessEntity) {
    return <BookkeepingReviewBusinessEntityEmptyState tenantName={summary.tenant.name} />
  }

  const displayModel = isFixtureMode
    ? loadReconciliationLedgerDisplayFixture()
    : buildLiveReconciliationLedgerDisplayModel(summary)

  return (
    <ReconciliationLedgerDisplayFixtureView
      activeFilter={normalizeReconciliationDisplayFilter(source)}
      companyName={summary.businessEntity?.name ?? summary.tenant.name}
      displayModel={displayModel}
      initialRowId={row ?? null}
      isFixtureMode={isFixtureMode}
    />
  )
}
