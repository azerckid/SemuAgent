import { and, desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientCcGroup, internalCcGroup, staff } from '@/lib/db/schema'
import { EventCreateForm } from './_components/event-create-form'

export default async function NewEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const { user, tenantId } = await requireTenantSession()
  const { id: clientId } = await params
  const { period } = await searchParams

  const [clientRows, staffRows, ccGroupRows, internalCcGroupRows] = await Promise.all([
    db
      .select({ id: client.id, name: client.name, contactName: client.contactName })
      .from(client)
      .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))
      .limit(1),
    db
      .select({ phone: staff.phone })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1),
    db
      .select({
        id: clientCcGroup.id,
        name: clientCcGroup.name,
        purpose: clientCcGroup.purpose,
        emails: clientCcGroup.emails,
        isDefault: clientCcGroup.isDefault,
      })
      .from(clientCcGroup)
      .where(and(eq(clientCcGroup.clientId, clientId), eq(clientCcGroup.tenantId, tenantId)))
      .orderBy(desc(clientCcGroup.isDefault), desc(clientCcGroup.createdAt)),
    db
      .select({
        id: internalCcGroup.id,
        name: internalCcGroup.name,
        purpose: internalCcGroup.purpose,
        emails: internalCcGroup.emails,
        isDefault: internalCcGroup.isDefault,
      })
      .from(internalCcGroup)
      .where(eq(internalCcGroup.tenantId, tenantId))
      .orderBy(desc(internalCcGroup.isDefault), desc(internalCcGroup.createdAt)),
  ])

  const currentClient = clientRows[0]
  if (!currentClient) notFound()

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="mb-6">
        <p className="text-sm text-gray-500">{currentClient.name}</p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">비정기 요청 메일 만들기</h1>
        <p className="mt-1 text-sm text-gray-500">
          이번 한 번 보낼 자료 요청을 저장합니다. 저장 후 일정 상세에서 발송을 승인합니다.
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          정기 반복 요청은 고객사 상세의 정기 요청 설정에서 등록합니다.
        </p>
      </div>
      <EventCreateForm
        clientId={clientId}
        clientName={currentClient.name}
        initialPeriod={period ?? ''}
        staffPhone={staffRows[0]?.phone ?? ''}
        ccGroups={ccGroupRows.filter((group) => group.purpose === 'general' || group.purpose === 'all')}
        internalCcGroups={internalCcGroupRows.filter((group) => group.purpose === 'general' || group.purpose === 'all')}
      />
    </div>
  )
}
