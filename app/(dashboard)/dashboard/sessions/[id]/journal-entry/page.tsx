import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import {
  getActiveStaffForUser,
  getLatestBookkeepingJournalEntry,
} from '@/lib/bookkeeping/journal-entry-service'
import { db } from '@/lib/db'
import { client, uploadSession } from '@/lib/db/schema'
import { JournalEntryWorkspace } from './journal-entry-workspace'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function JournalEntryPage({ params }: PageProps) {
  const { id: sessionId } = await params
  let auth: Awaited<ReturnType<typeof requireTenantSession>>

  try {
    auth = await requireTenantSession()
  } catch {
    redirect('/sign-in')
  }

  const staffRecord = await getActiveStaffForUser({ userId: auth.user.id, tenantId: auth.tenantId })
  if (!staffRecord) redirect('/dashboard/reviews')

  const [sessionRow] = await db
    .select({
      session: uploadSession,
      clientName: client.name,
    })
    .from(uploadSession)
    .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, auth.tenantId)))
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, auth.tenantId), isNull(uploadSession.deletedAt)))
    .limit(1)

  if (!sessionRow) redirect('/dashboard/reviews')
  if (staffRecord.role === 'STAFF' && sessionRow.session.createdByStaffId !== staffRecord.id) {
    redirect('/dashboard/reviews')
  }

  const journalEntry = await getLatestBookkeepingJournalEntry({ sessionId, tenantId: auth.tenantId })

  return (
    <JournalEntryWorkspace
      sessionId={sessionId}
      clientName={sessionRow.clientName}
      accountingPeriod={sessionRow.session.accountingPeriod}
      initialData={journalEntry}
    />
  )
}
