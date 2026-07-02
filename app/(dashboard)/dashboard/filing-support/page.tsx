import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadFilingSupportSummary } from '@/lib/filing-support/summary'
import { FilingSupportBusinessEntityEmptyState, FilingSupportWorkspace } from './_components/filing-support-workspace'

type PageProps = {
  searchParams: Promise<{
    period?: string
  }>
}

export default async function FilingSupportPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadFilingSupportSummary({ tenantId, periodKey: period })

  if (!summary.businessEntity) {
    return <FilingSupportBusinessEntityEmptyState tenantName={summary.tenant.name} />
  }

  return <FilingSupportWorkspace summary={summary} />
}
