import { and, eq, isNull, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { checklistTemplate, client, requestTemplate, staff } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { createRequestTemplateSchema } from '@/lib/validations/scheduling'

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantSession()
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')

    const whereClause = clientId
      ? and(
          eq(requestTemplate.tenantId, tenantId),
          or(isNull(requestTemplate.clientId), eq(requestTemplate.clientId, clientId)),
        )
      : eq(requestTemplate.tenantId, tenantId)

    const rows = await db
      .select()
      .from(requestTemplate)
      .where(whereClause)

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/request-templates]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()

    const body = await req.json()
    const parsed = createRequestTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값 오류', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const {
      clientId,
      checklistTemplateId,
      name,
      workType,
      frequency,
      requestItems,
      emailSubjectTemplate,
      emailBodyTemplate,
      analysisCriteriaTemplate,
      dueRule,
      sendRule,
      sendPolicy,
      isDefaultForWorkType,
      isActive,
    } = parsed.data

    if (isDefaultForWorkType && clientId) {
      return NextResponse.json({ error: '업무유형 기본 템플릿은 공통 템플릿만 지정할 수 있습니다' }, { status: 400 })
    }
    if (isDefaultForWorkType && !workType) {
      return NextResponse.json({ error: '업무유형 기본 템플릿에는 업무유형이 필요합니다' }, { status: 400 })
    }

    // 고객사 소속 확인
    if (clientId) {
      const clientRow = await db
        .select({ id: client.id })
        .from(client)
        .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))
        .limit(1)

      if (!clientRow[0]) {
        return NextResponse.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 })
      }
    }

    // checklistTemplateId 테넌트 검증
    if (checklistTemplateId) {
      const clRow = await db
        .select({ id: checklistTemplate.id })
        .from(checklistTemplate)
        .where(and(eq(checklistTemplate.id, checklistTemplateId), eq(checklistTemplate.tenantId, tenantId)))
        .limit(1)
      if (!clRow[0]) {
        return NextResponse.json({ error: '체크리스트 템플릿을 찾을 수 없습니다' }, { status: 404 })
      }
    }

    // 담당자 확인
    const staffRow = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    if (!staffRow[0]) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const ts = toDBString(now())
    const templateId = randomUUID()

    await db.transaction(async (tx) => {
      if (isDefaultForWorkType) {
        const defaultWorkType = workType as NonNullable<typeof workType>
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

      await tx.insert(requestTemplate).values({
        id: templateId,
        tenantId,
        clientId: clientId ?? null,
        checklistTemplateId: checklistTemplateId ?? null,
        name,
        workType: workType ?? null,
        frequency,
        requestItems: requestItems ? JSON.stringify(requestItems) : null,
        emailSubjectTemplate,
        emailBodyTemplate,
        analysisCriteriaTemplate: analysisCriteriaTemplate ?? null,
        dueRule: dueRule ? JSON.stringify(dueRule) : null,
        sendRule: sendRule ? JSON.stringify(sendRule) : null,
        sendPolicy,
        isDefaultForWorkType,
        isActive,
        createdByStaffId: staffRow[0].id,
        createdAt: ts,
        updatedAt: ts,
      })
    })

    return NextResponse.json({
      template: {
        id: templateId,
        name,
        workType: workType ?? null,
        frequency,
        clientName: null,
        emailSubjectTemplate,
        emailBodyTemplate,
        analysisCriteriaTemplate: analysisCriteriaTemplate ?? null,
        isDefaultForWorkType,
        isActive,
        updatedAt: ts,
        createdAt: ts,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/request-templates]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
