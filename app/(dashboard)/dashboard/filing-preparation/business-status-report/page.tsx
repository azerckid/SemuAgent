import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadBusinessStatusReportSummary } from '@/lib/business-status-report/summary'
import { BusinessStatusReportEmptyState, BusinessStatusReportReview } from './_components/business-status-report-review'

type PageProps = {
  searchParams: Promise<{ period?: string }>
}

export default async function BusinessStatusReportPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadBusinessStatusReportSummary({ tenantId, periodKey: period })

  if (!summary.businessEntity) {
    return <BusinessStatusReportEmptyState tenantName={summary.tenant.name} />
  }

  return <BusinessStatusReportReview summary={summary} />
}
