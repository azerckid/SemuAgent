import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadEmployeeDirectorySummary } from '@/lib/employee-directory/summary'
import { EmployeeBusinessEntityEmptyState, EmployeeDirectoryWorkspace } from './_components/employee-directory-workspace'

export default async function EmployeesPage() {
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadEmployeeDirectorySummary({ tenantId })

  if (!summary.businessEntity) {
    return <EmployeeBusinessEntityEmptyState tenantName={summary.tenant.name} />
  }

  return <EmployeeDirectoryWorkspace summary={summary} />
}
