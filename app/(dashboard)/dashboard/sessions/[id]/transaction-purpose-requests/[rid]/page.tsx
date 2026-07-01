import { notFound, redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { getPurposeRequestDraft } from '@/lib/bookkeeping/transaction-purpose-service'
import { TransactionPurposeDraftEditor } from './transaction-purpose-draft-editor'

type PageProps = {
  params: Promise<{ id: string; rid: string }>
}

export default async function TransactionPurposeDraftPage({ params }: PageProps) {
  const { id: sessionId, rid: requestId } = await params

  let auth: Awaited<ReturnType<typeof requireTenantSession>>
  try {
    auth = await requireTenantSession()
  } catch {
    redirect('/sign-in')
  }

  const staffRecord = await getActiveStaffForUser({ userId: auth.user.id, tenantId: auth.tenantId })
  if (!staffRecord) redirect('/dashboard/reviews')

  const result = await getPurposeRequestDraft({
    requestId,
    tenantId: auth.tenantId,
    staffRecord,
  })
  if (!result.ok) {
    if (result.status === 404) notFound()
    redirect(`/dashboard/sessions/${sessionId}/account-classification`)
  }

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-foreground">거래 용도 확인 요청</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          확정이 어려운 거래의 용도를 고객에게 확인 요청합니다. 발송 전 제목·본문·미리보기를 확인하세요.
        </p>
      </div>
      <TransactionPurposeDraftEditor
        sessionId={sessionId}
        requestId={requestId}
        initial={result}
      />
    </div>
  )
}
