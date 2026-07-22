import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { loadBookkeepingReviewPendingCount } from '@/lib/bookkeeping-review/summary'
import { db } from '@/lib/db'
import { tenant } from '@/lib/db/schema'
import { loadFilingPreparationAttentionCount, loadPrimaryBusinessEntityType, type FilingPrepBusinessType } from '@/lib/filing-preparation/summary'
import { loadFilingSupportAttentionCount } from '@/lib/filing-support/summary'
import { loadFirstRunSampleState } from '@/lib/first-run-sample/summary'
import { purgeFirstRunSampleDataset } from '@/lib/first-run-sample/cleanup'
import { shouldBlockDashboardForSampleCleanup } from '@/lib/first-run-sample/shared'
import { loadInternalReminderAttentionCount } from '@/lib/internal-reminders/summary'
import { loadPayrollSidebarEmployeeCount } from '@/lib/payroll-workspace/summary'
import { DashboardShell } from './_components/dashboard-shell'
import { SampleCleanupTransition } from './_components/sample-cleanup-transition'
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
  const firstRunSampleState = await loadFirstRunSampleState(tenantId)
  const blockDashboardForSampleCleanup = shouldBlockDashboardForSampleCleanup(firstRunSampleState)
  const [
    bookkeepingPendingCount,
    payrollEmployeeCount,
    filingAttentionCount,
    filingPrepAttentionCount,
    reminderAttentionCount,
    businessType,
  ]: [number, number, number, number, number, FilingPrepBusinessType] = blockDashboardForSampleCleanup
    ? [0, 0, 0, 0, 0, 'unknown']
    : await Promise.all([
      loadBookkeepingReviewPendingCount(tenantId),
      loadPayrollSidebarEmployeeCount(tenantId),
      loadFilingSupportAttentionCount(tenantId),
      loadFilingPreparationAttentionCount(tenantId),
      loadInternalReminderAttentionCount(tenantId, session.user.id),
      loadPrimaryBusinessEntityType(tenantId),
    ])

  if (blockDashboardForSampleCleanup && firstRunSampleState.status === 'deleted') {
    after(async () => {
      try {
        await purgeFirstRunSampleDataset({ tenantId, datasetId: firstRunSampleState.datasetId })
      } catch (err) {
        console.error('[dashboard sample cleanup retry]', err)
      }
    })
  }

  return (
    <DashboardShell
      sidebar={
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
      }
    >
      <SampleDataBanner state={firstRunSampleState} />
      {blockDashboardForSampleCleanup
        ? <SampleCleanupTransition />
        : children}
    </DashboardShell>
  )
}
