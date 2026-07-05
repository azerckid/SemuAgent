import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadLocalIncomeTaxSummary } from '@/lib/local-income-tax/summary'
import { LocalIncomeTaxEmptyState, LocalIncomeTaxReview } from './_components/local-income-tax-review'

type PageProps = {
  searchParams: Promise<{
    period?: string
  }>
}

export default async function LocalIncomeTaxPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadLocalIncomeTaxSummary({ tenantId, periodKey: period })

  if (!summary.businessEntity) {
    return <LocalIncomeTaxEmptyState tenantName={summary.tenant.name} />
  }

  return <LocalIncomeTaxReview summary={summary} />
}
