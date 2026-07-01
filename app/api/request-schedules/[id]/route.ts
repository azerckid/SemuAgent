import { and, eq, inArray, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { clientRequestEvent, clientRequestSchedule, staff, uploadSession } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'

const patchSchema = z.object({
  isActive: z.boolean().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { id } = await params

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: '입력값 오류' }, { status: 400 })
    }

    await db
      .update(clientRequestSchedule)
      .set({ ...parsed.data, updatedAt: toDBString(now()) })
      .where(and(
        eq(clientRequestSchedule.id, id),
        eq(clientRequestSchedule.tenantId, tenantId),
        isNull(clientRequestSchedule.deletedAt),
      ))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/request-schedules/[id]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id } = await params

    const [staffRows, scheduleRows] = await Promise.all([
      db
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
        .limit(1),
      db
        .select({ id: clientRequestSchedule.id })
        .from(clientRequestSchedule)
        .where(and(
          eq(clientRequestSchedule.id, id),
          eq(clientRequestSchedule.tenantId, tenantId),
          isNull(clientRequestSchedule.deletedAt),
        ))
        .limit(1),
    ])

    const staffId = staffRows[0]?.id
    if (!staffId) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    if (!scheduleRows[0]) {
      return NextResponse.json({ error: '정기 요청 메일을 찾을 수 없습니다' }, { status: 404 })
    }

    const eventRows = await db
      .select({
        id: clientRequestEvent.id,
        status: clientRequestEvent.status,
        uploadSessionId: clientRequestEvent.uploadSessionId,
      })
      .from(clientRequestEvent)
      .where(
        and(
          eq(clientRequestEvent.requestScheduleId, id),
          eq(clientRequestEvent.tenantId, tenantId),
          isNull(clientRequestEvent.deletedAt),
        ),
      )

    const sessionIds = eventRows
      .map((event) => event.uploadSessionId)
      .filter((sessionId): sessionId is string => Boolean(sessionId))
    const ts = toDBString(now())

    await db.transaction(async (tx) => {
      if (sessionIds.length > 0) {
        await tx
          .update(uploadSession)
          .set({
            status: 'revoked',
            deletedAt: ts,
            deletedByStaffId: staffId,
          })
          .where(and(
            eq(uploadSession.tenantId, tenantId),
            inArray(uploadSession.id, sessionIds),
          ))
      }

      await tx
        .update(clientRequestEvent)
        .set({
          status: 'cancelled',
          deletedAt: ts,
          deletedByStaffId: staffId,
          updatedAt: ts,
        })
        .where(
          and(
            eq(clientRequestEvent.requestScheduleId, id),
            eq(clientRequestEvent.tenantId, tenantId),
            isNull(clientRequestEvent.deletedAt),
          ),
        )

      await tx
        .update(clientRequestSchedule)
        .set({
          isActive: false,
          deletedAt: ts,
          deletedByStaffId: staffId,
          updatedAt: ts,
        })
        .where(and(eq(clientRequestSchedule.id, id), eq(clientRequestSchedule.tenantId, tenantId)))
    })

    return NextResponse.json({ ok: true, deletedEvents: eventRows.length, revokedSessions: sessionIds.length })
  } catch (err) {
    console.error('[DELETE /api/request-schedules/[id]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
