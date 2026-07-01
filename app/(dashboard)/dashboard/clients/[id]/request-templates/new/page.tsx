import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { checklistTemplate, client } from '@/lib/db/schema'
import { TemplateCreateForm } from './_components/template-create-form'

export default async function NewRequestTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { tenantId } = await requireTenantSession()
  const { id: clientId } = await params

  const [clientRows, checklistRows] = await Promise.all([
    db
      .select({ id: client.id, name: client.name })
      .from(client)
      .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))
      .limit(1),
    db
      .select({ id: checklistTemplate.id, name: checklistTemplate.name })
      .from(checklistTemplate)
      .where(eq(checklistTemplate.tenantId, tenantId)),
  ])

  const currentClient = clientRows[0]
  if (!currentClient) notFound()

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="mb-6">
        <p className="text-sm text-gray-500">{currentClient.name}</p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">요청 템플릿 만들기</h1>
        <p className="mt-1 text-sm text-gray-500">
          정기 요청 메일에 불러올 자료 요구사항과 AI 판단 기준을 저장합니다.
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          담당자 이름, 인삿말, 전화번호는 정기 요청 메일 작성 시 입력합니다.
        </p>
      </div>
      <TemplateCreateForm
        clientId={clientId}
        clientName={currentClient.name}
        checklistTemplates={checklistRows}
      />
    </div>
  )
}
