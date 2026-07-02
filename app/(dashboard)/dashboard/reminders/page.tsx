import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadInternalReminderSummary } from '@/lib/internal-reminders/summary'
import { InternalReminderBusinessEntityEmptyState, InternalRemindersWorkspace } from './_components/internal-reminders-workspace'

type PageProps = {
  searchParams: Promise<{
    period?: string
  }>
}

export default async function RemindersPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  let tenantId: string
  let userId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
    userId = session.user.id
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadInternalReminderSummary({ tenantId, userId, periodKey: period })

  if (!summary.businessEntity) {
    return <InternalReminderBusinessEntityEmptyState tenantName={summary.tenant.name} />
  }

  return <InternalRemindersWorkspace summary={summary} />
}
