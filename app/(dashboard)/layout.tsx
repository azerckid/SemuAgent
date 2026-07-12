import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { loadBookkeepingReviewPendingCount } from '@/lib/bookkeeping-review/summary'
import { db } from '@/lib/db'
import { tenant } from '@/lib/db/schema'
import { loadFilingPreparationAttentionCount, loadPrimaryBusinessEntityType } from '@/lib/filing-preparation/summary'
import { loadFilingSupportAttentionCount } from '@/lib/filing-support/summary'
import { loadFirstRunSampleState } from '@/lib/first-run-sample/summary'
import { loadInternalReminderAttentionCount } from '@/lib/internal-reminders/summary'
import { loadPayrollSidebarEmployeeCount } from '@/lib/payroll-workspace/summary'
import { SampleDataBanner } from './_components/sample-data-banner'
import { Sidebar } from './_components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) redirect('/sign-in')

  const tenantId = session.session.activeOrganizationId

  // 활성 테넌트(회사)가 없으면 대시보드를 깨진 상태로 렌더하지 않고 회사 등록으로 보낸다(JC-020).
  // 회사가 이미 있는 사용자는 온보딩 페이지가 setActive 후 대시보드로 되돌려 준다.
  if (!tenantId) {
    redirect('/onboarding')
  }

  let tenantName = ''
  const tenantRows = await db
    .select({ name: tenant.name })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  tenantName = tenantRows[0]?.name ?? '회사'
  const [
    bookkeepingPendingCount,
    payrollEmployeeCount,
    filingAttentionCount,
    filingPrepAttentionCount,
    reminderAttentionCount,
    firstRunSampleState,
    businessType,
  ] = await Promise.all([
    loadBookkeepingReviewPendingCount(tenantId),
    loadPayrollSidebarEmployeeCount(tenantId),
    loadFilingSupportAttentionCount(tenantId),
    loadFilingPreparationAttentionCount(tenantId),
    loadInternalReminderAttentionCount(tenantId, session.user.id),
    loadFirstRunSampleState(tenantId),
    loadPrimaryBusinessEntityType(tenantId),
  ])

  return (
    <div className="grid min-h-screen grid-cols-1 bg-company-bg text-foreground md:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar
        userName={session.user.name}
        tenantName={tenantName}
        bookkeepingPendingCount={bookkeepingPendingCount}
        payrollEmployeeCount={payrollEmployeeCount}
        filingAttentionCount={filingAttentionCount}
        filingPrepAttentionCount={filingPrepAttentionCount}
        reminderAttentionCount={reminderAttentionCount}
        businessType={businessType}
      />
      <main className="flex min-w-0 flex-col bg-company-bg">
        <SampleDataBanner state={firstRunSampleState} />
        {children}
      </main>
    </div>
  )
}
