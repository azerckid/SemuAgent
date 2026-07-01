import { and, desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientCcGroup, internalCcGroup, requestTemplate, staff } from '@/lib/db/schema'
import { ScheduleCreateForm } from './_components/schedule-create-form'

export default async function NewSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { user, tenantId } = await requireTenantSession()
  const { id: clientId } = await params

  const [clientRows, staffRows, templateRows, ccGroupRows, internalCcGroupRows] = await Promise.all([
    db
      .select({ id: client.id, name: client.name })
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
        id: requestTemplate.id,
        name: requestTemplate.name,
        frequency: requestTemplate.frequency,
        emailSubjectTemplate: requestTemplate.emailSubjectTemplate,
        emailBodyTemplate: requestTemplate.emailBodyTemplate,
        analysisCriteriaTemplate: requestTemplate.analysisCriteriaTemplate,
        sendRule: requestTemplate.sendRule,
        dueRule: requestTemplate.dueRule,
      })
      .from(requestTemplate)
      .where(
        and(
          eq(requestTemplate.clientId, clientId),
          eq(requestTemplate.tenantId, tenantId),
          eq(requestTemplate.isActive, true),
        ),
      ),
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
        <h1 className="mt-1 text-xl font-semibold text-gray-900">정기 요청 메일 만들기</h1>
        <p className="mt-1 text-sm text-gray-500">
          월별·분기별·반기별·연간 반복 요청 규칙을 저장합니다.
          정해진 날짜가 되면 담당자 검토용 초안이 자동 생성됩니다.
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          단건 요청은 고객사 상세의 비정기 요청 메일에서 만듭니다.
        </p>
      </div>
      <ScheduleCreateForm
        clientId={clientId}
        clientName={currentClient.name}
        staffPhone={staffRows[0]?.phone ?? ''}
        templates={templateRows}
        ccGroups={ccGroupRows.filter((group) => group.purpose === 'general' || group.purpose === 'all')}
        internalCcGroups={internalCcGroupRows.filter((group) => group.purpose === 'general' || group.purpose === 'all')}
      />
    </div>
  )
}
