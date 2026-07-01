import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-helpers'
import { loadCompanyHomeSummary } from '@/lib/company-home/summary'
import { CompanyHomeView, NoTenantCompanyState } from './_components/company-home'

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function singleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const tenantId = session.session.activeOrganizationId
  if (!tenantId) {
    return <NoTenantCompanyState userName={session.user.name} />
  }

  const resolvedSearchParams = await searchParams
  const summary = await loadCompanyHomeSummary({
    tenantId,
    periodKey: singleSearchParam(resolvedSearchParams.period),
  })

  return <CompanyHomeView summary={summary} />
}
