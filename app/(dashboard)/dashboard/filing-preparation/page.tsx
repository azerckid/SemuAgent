import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
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

  return <FilingPreparationHub summary={summary} />
}
