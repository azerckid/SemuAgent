import { and, eq, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { staff } from '@/lib/db/schema'
import { listPayrollAdaptiveModels } from '@/lib/payroll/adaptive-structuring-registry'
import { AdaptiveModelCard } from './_components/adaptive-model-card'

export default async function PayrollAdaptiveModelsPage() {
  let tenantId: string
  let userId: string
  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
    userId = session.user.id
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') redirect('/sign-in')
    redirect('/dashboard/clients')
  }

  const currentStaffRows = await db
    .select({ role: staff.role })
    .from(staff)
    .where(and(eq(staff.userId, userId), eq(staff.tenantId, tenantId)))
    .limit(1)

  // 이 화면은 구조화 모델 매핑·마스킹된 샘플 row를 보여준다. 활성 organization만으로는
  // 부족하고, 이 tenant의 staff가 맞는지 확인한 뒤에만 보여준다.
  if (!currentStaffRows[0]) redirect('/dashboard/clients')
  const isTenantAdmin = currentStaffRows[0].role === 'TENANT_ADMIN'

  const models = await listPayrollAdaptiveModels({ tenantId })

  const staffIds = [...new Set(
    models.flatMap((model) => [model.createdByStaffId, model.approvedByStaffId])
      .filter((id): id is string => Boolean(id)),
  )]
  const staffRows = staffIds.length > 0
    ? await db.select({ id: staff.id, name: staff.name }).from(staff).where(and(
      inArray(staff.id, staffIds),
      eq(staff.tenantId, tenantId),
    ))
    : []
  const staffNameById = new Map(staffRows.map((row) => [row.id, row.name]))

  const sortedModels = [...models].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">구조화 모델 관리</h1>
        <p className="text-sm text-muted-foreground">
          승인된 모델은 같은 형식의 급여 워크북에 자동으로 재사용됩니다. 승인·폐기는 관리자만 할 수 있습니다.
        </p>
      </div>

      {sortedModels.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 구조화 모델이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {sortedModels.map((model) => (
            <AdaptiveModelCard
              key={model.id}
              model={model}
              createdByName={staffNameById.get(model.createdByStaffId) ?? '알 수 없음'}
              approvedByName={model.approvedByStaffId ? staffNameById.get(model.approvedByStaffId) ?? '알 수 없음' : null}
              isTenantAdmin={isTenantAdmin}
            />
          ))}
        </div>
      )}
    </div>
  )
}
