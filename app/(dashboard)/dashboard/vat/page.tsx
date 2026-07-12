import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadVatSummary } from '@/lib/vat/summary'
import { resolveReclassificationCandidates } from '@/lib/vat/reclassification-evidence-resolver'
import { VatReclassificationSavingsSection } from './_components/vat-reclassification-savings'
import { VatBusinessEntityEmptyState, VatWorkspace } from './_components/vat-workspace'

type PageProps = {
  searchParams: Promise<{
    period?: string
  }>
}

export default async function VatPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadVatSummary({
    tenantId,
    periodKey: period,
    includeStoredTaxTreatmentAi: true,
  })

  if (!summary.businessEntity) {
    return <VatBusinessEntityEmptyState tenantName={summary.tenant.name} />
  }

  return (
    <VatWorkspace
      summary={summary}
      reclassificationSavings={(
        <Suspense fallback={null}>
          <VatReclassificationSavingsLoader
            tenantId={tenantId}
            clientId={summary.businessEntity.id}
            periodKey={summary.period.key}
          />
        </Suspense>
      )}
      initialProviderCallCount={0}
    />
  )
}

async function VatReclassificationSavingsLoader({
  tenantId,
  clientId,
  periodKey,
}: {
  readonly tenantId: string
  readonly clientId: string
  readonly periodKey: string
}) {
  const candidates = await resolveReclassificationCandidates({ tenantId, clientId, periodKey })
  return <VatReclassificationSavingsSection periodKey={periodKey} candidates={candidates} />
}
