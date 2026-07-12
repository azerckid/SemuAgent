import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadVatSummary } from '@/lib/vat/summary'
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
      initialProviderCallCount={0}
    />
  )
}
