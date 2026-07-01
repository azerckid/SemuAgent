import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { requestTemplate } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { updateRequestTemplateSchema } from '@/lib/validations/scheduling'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { id } = await params

    const body = await req.json()
    const parsed = updateRequestTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: '입력값 오류' }, { status: 400 })
    }

    const row = await db
      .select({
        id: requestTemplate.id,
        clientId: requestTemplate.clientId,
        name: requestTemplate.name,
        workType: requestTemplate.workType,
        frequency: requestTemplate.frequency,
        emailSubjectTemplate: requestTemplate.emailSubjectTemplate,
        emailBodyTemplate: requestTemplate.emailBodyTemplate,
        analysisCriteriaTemplate: requestTemplate.analysisCriteriaTemplate,
        requestItems: requestTemplate.requestItems,
        dueRule: requestTemplate.dueRule,
        sendRule: requestTemplate.sendRule,
        sendPolicy: requestTemplate.sendPolicy,
        isDefaultForWorkType: requestTemplate.isDefaultForWorkType,
        isActive: requestTemplate.isActive,
        createdAt: requestTemplate.createdAt,
      })
      .from(requestTemplate)
      .where(and(eq(requestTemplate.id, id), eq(requestTemplate.tenantId, tenantId)))
      .limit(1)

    const existing = row[0]
    if (!existing) {
      return NextResponse.json({ error: '템플릿을 찾을 수 없습니다' }, { status: 404 })
    }

    const nextWorkType = parsed.data.workType === undefined ? existing.workType : parsed.data.workType
    const nextIsDefault = parsed.data.isDefaultForWorkType ?? existing.isDefaultForWorkType

    if (nextIsDefault && existing.clientId) {
      return NextResponse.json({ error: '업무유형 기본 템플릿은 공통 템플릿만 지정할 수 있습니다' }, { status: 400 })
    }
    if (nextIsDefault && !nextWorkType) {
      return NextResponse.json({ error: '업무유형 기본 템플릿에는 업무유형이 필요합니다' }, { status: 400 })
    }

    const ts = toDBString(now())
    const updateValues = {
      name: parsed.data.name ?? existing.name,
      workType: nextWorkType,
      frequency: parsed.data.frequency ?? existing.frequency,
      emailSubjectTemplate: parsed.data.emailSubjectTemplate ?? existing.emailSubjectTemplate,
      emailBodyTemplate: parsed.data.emailBodyTemplate ?? existing.emailBodyTemplate,
      analysisCriteriaTemplate:
        parsed.data.analysisCriteriaTemplate === undefined
          ? existing.analysisCriteriaTemplate
          : parsed.data.analysisCriteriaTemplate || null,
      requestItems:
        parsed.data.requestItems === undefined
          ? existing.requestItems
          : JSON.stringify(parsed.data.requestItems),
      dueRule:
        parsed.data.dueRule === undefined
          ? existing.dueRule
          : JSON.stringify(parsed.data.dueRule),
      sendRule:
        parsed.data.sendRule === undefined
          ? existing.sendRule
          : JSON.stringify(parsed.data.sendRule),
      sendPolicy: parsed.data.sendPolicy ?? existing.sendPolicy,
      isDefaultForWorkType: nextIsDefault,
      isActive: parsed.data.isActive ?? existing.isActive,
      updatedAt: ts,
    }

    await db.transaction(async (tx) => {
      if (nextIsDefault) {
        const defaultWorkType = nextWorkType as NonNullable<typeof nextWorkType>
        await tx
          .update(requestTemplate)
          .set({ isDefaultForWorkType: false, updatedAt: ts })
          .where(and(
            eq(requestTemplate.tenantId, tenantId),
            isNull(requestTemplate.clientId),
            eq(requestTemplate.workType, defaultWorkType),
            eq(requestTemplate.isDefaultForWorkType, true),
          ))
      }

      await tx
        .update(requestTemplate)
        .set(updateValues)
        .where(and(eq(requestTemplate.id, id), eq(requestTemplate.tenantId, tenantId)))
    })

    return NextResponse.json({
      template: {
        id,
        name: updateValues.name,
        workType: updateValues.workType,
        frequency: updateValues.frequency,
        clientName: null,
        emailSubjectTemplate: updateValues.emailSubjectTemplate,
        emailBodyTemplate: updateValues.emailBodyTemplate,
        analysisCriteriaTemplate: updateValues.analysisCriteriaTemplate,
        isDefaultForWorkType: updateValues.isDefaultForWorkType,
        isActive: updateValues.isActive,
        updatedAt: ts,
        createdAt: existing.createdAt,
      },
    })
  } catch (err) {
    console.error('[PATCH /api/request-templates/[id]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
