import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { loadBookkeepingReviewPendingCount } from '@/lib/bookkeeping-review/summary'
import { db } from '@/lib/db'
import { tenant } from '@/lib/db/schema'
import { loadFilingSupportAttentionCount } from '@/lib/filing-support/summary'
import { loadPayrollSidebarEmployeeCount } from '@/lib/payroll-workspace/summary'
import { Sidebar } from './_components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) redirect('/sign-in')

  const tenantId = session.session.activeOrganizationId

  if (!tenantId) {
    return <>{children}</>
  }

  let tenantName = ''
  const tenantRows = await db
    .select({ name: tenant.name })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  tenantName = tenantRows[0]?.name ?? '회사'
  const [bookkeepingPendingCount, payrollEmployeeCount, filingAttentionCount] = await Promise.all([
    loadBookkeepingReviewPendingCount(tenantId),
    loadPayrollSidebarEmployeeCount(tenantId),
    loadFilingSupportAttentionCount(tenantId),
  ])

  return (
    <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)] bg-company-bg text-foreground">
      <Sidebar
        userName={session.user.name}
        tenantName={tenantName}
        bookkeepingPendingCount={bookkeepingPendingCount}
        payrollEmployeeCount={payrollEmployeeCount}
        filingAttentionCount={filingAttentionCount}
      />
      <main className="flex min-w-0 flex-col bg-company-bg">{children}</main>
    </div>
  )
}
