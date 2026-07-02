import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { db } from '@/lib/db'
import { filingChecklistItem, filingItem } from '@/lib/db/schema'
import {
  buildChecklistItemId,
  buildDefaultFilingItemRecord,
  checklistDefinitionForCode,
  loadFilingSupportSummary,
} from '@/lib/filing-support/summary'
import { now, toDBString } from '@/lib/time'
import { filingChecklistPatchSchema } from '@/lib/validations/filing-support'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { itemId } = await params
    const parsed = filingChecklistPatchSchema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const definition = checklistDefinitionForCode(parsed.data.code)
    if (!definition) {
      return NextResponse.json({ error: '체크리스트 항목을 찾을 수 없습니다.' }, { status: 404 })
    }

    const summary = await loadFilingSupportSummary({
      tenantId,
      periodKey: parsed.data.filingPeriodKey,
    })
    const businessEntity = summary.businessEntity
    if (!businessEntity) {
      return NextResponse.json({ error: '사업장을 먼저 등록해 주세요.' }, { status: 404 })
    }

    const expectedId = buildChecklistItemId({
      tenantId,
      clientId: businessEntity.id,
      filingPeriodKey: parsed.data.filingPeriodKey,
      code: parsed.data.code,
    })
    if (itemId !== expectedId) {
      return NextResponse.json({ error: '체크리스트 범위가 올바르지 않습니다.' }, { status: 400 })
    }

    const linkedItem = definition.itemType
      ? summary.items.find((candidate) => candidate.type === definition.itemType) ?? null
      : null
    const ts = toDBString(now(summary.tenant.timezone))

    if (linkedItem) {
      await db
        .insert(filingItem)
        .values(buildDefaultFilingItemRecord({
          tenantId,
          clientId: businessEntity.id,
          period: summary.period,
          item: linkedItem,
          timestamp: ts,
        }))
        .onConflictDoNothing({
          target: [
            filingItem.tenantId,
            filingItem.clientId,
            filingItem.filingPeriodKey,
            filingItem.itemType,
          ],
        })
    }

    await db
      .insert(filingChecklistItem)
      .values({
        id: expectedId,
        tenantId,
        clientId: businessEntity.id,
        filingPeriodKey: parsed.data.filingPeriodKey,
        filingItemId: linkedItem?.id ?? null,
        code: definition.code,
        label: definition.label,
        description: definition.description,
        sortOrder: definition.sortOrder,
        completed: parsed.data.completed,
        completedByStaffId: parsed.data.completed ? staffRecord.id : null,
        completedAt: parsed.data.completed ? ts : null,
        createdAt: ts,
        updatedAt: ts,
      })
      .onConflictDoUpdate({
        target: [
          filingChecklistItem.tenantId,
          filingChecklistItem.clientId,
          filingChecklistItem.filingPeriodKey,
          filingChecklistItem.code,
        ],
        set: {
          completed: parsed.data.completed,
          completedByStaffId: parsed.data.completed ? staffRecord.id : null,
          completedAt: parsed.data.completed ? ts : null,
          updatedAt: ts,
        },
      })

    revalidatePath('/dashboard/filing-support')
    revalidatePath('/dashboard')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/filing/checklist-items/[itemId]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
