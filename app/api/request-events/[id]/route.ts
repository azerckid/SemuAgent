import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { clientRequestEvent, staff, uploadSession } from '@/lib/db/schema'
import { deleteSessionBlobObjects } from '@/lib/sessions/blob-cleanup'
import { now, toDBString } from '@/lib/time'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id } = await params

    const [staffRows, eventRows] = await Promise.all([
      db
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
        .limit(1),
      db
        .select({
          id: clientRequestEvent.id,
          uploadSessionId: clientRequestEvent.uploadSessionId,
        })
        .from(clientRequestEvent)
        .where(and(
          eq(clientRequestEvent.id, id),
          eq(clientRequestEvent.tenantId, tenantId),
          isNull(clientRequestEvent.deletedAt),
        ))
        .limit(1),
    ])

    const staffId = staffRows[0]?.id
    if (!staffId) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const event = eventRows[0]
    if (!event) {
      return NextResponse.json({ error: '요청 일정을 찾을 수 없습니다' }, { status: 404 })
    }

    const ts = toDBString(now())

    if (event.uploadSessionId) {
      await deleteSessionBlobObjects({ tenantId, sessionIds: [event.uploadSessionId] })
    }

    await db.transaction(async (tx) => {
      if (event.uploadSessionId) {
        await tx
          .update(uploadSession)
          .set({
            status: 'revoked',
            deletedAt: ts,
            deletedByStaffId: staffId,
          })
          .where(and(
            eq(uploadSession.id, event.uploadSessionId),
            eq(uploadSession.tenantId, tenantId),
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
        .where(and(
          eq(clientRequestEvent.id, id),
          eq(clientRequestEvent.tenantId, tenantId),
          isNull(clientRequestEvent.deletedAt),
        ))
    })

    return NextResponse.json({ ok: true, revokedSession: Boolean(event.uploadSessionId) })
  } catch (err) {
    console.error('[DELETE /api/request-events/[id]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
