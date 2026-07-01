import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { BOOKKEEPING_ACCOUNT_CATEGORIES } from '@/lib/bookkeeping/account-categories'
import {
  getActiveStaffForUser,
  getClassificationEligibility,
  getLatestBookkeepingClassification,
} from '@/lib/bookkeeping/classification-service'
import { attachPurposeAnswersToClassificationRows } from '@/lib/bookkeeping/transaction-purpose-classification-answers'
import { db } from '@/lib/db'
import { client, uploadSession } from '@/lib/db/schema'
import { AccountClassificationWorkspace } from './account-classification-workspace'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AccountClassificationPage({ params }: PageProps) {
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

  const [classification, eligibility] = await Promise.all([
    getLatestBookkeepingClassification({ sessionId, tenantId: auth.tenantId }),
    getClassificationEligibility({ sessionId, tenantId: auth.tenantId, staffRecord }),
  ])
  const rows = await attachPurposeAnswersToClassificationRows({
    tenantId: auth.tenantId,
    uploadSessionId: sessionId,
    currentClassificationRunId: classification.displayRun?.id,
    rows: classification.rows,
  })

  return (
    <AccountClassificationWorkspace
      sessionId={sessionId}
      clientName={sessionRow.clientName}
      accountingPeriod={sessionRow.session.accountingPeriod}
      initialData={{
        categories: [...BOOKKEEPING_ACCOUNT_CATEGORIES],
        eligibility,
        run: classification.run,
        displayRun: classification.displayRun,
        progressRun: classification.progressRun,
        latestAttemptRun: classification.latestAttemptRun,
        rows,
      }}
    />
  )
}
