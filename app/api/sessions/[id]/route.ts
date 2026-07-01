import { NextResponse } from 'next/server'
import { eq, and, inArray, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  uploadSession, client, staff, tenant,
  uploadFile, materialMatch, analysisRun,
  clientChecklist, checklistTemplate, checklistItem,
  clientRequestEvent,
} from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { deleteSessionBlobObjects } from '@/lib/sessions/blob-cleanup'
import { now, toDBString } from '@/lib/time'
import { resolveStoredUploadUrl } from '@/lib/upload/resolve-upload-url'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { id } = await params

    const sessionRows = await db
      .select({
        session: uploadSession,
        clientRecord: client,
        tenantRecord: tenant,
        staffRecord: staff,
      })
      .from(uploadSession)
      .innerJoin(client, eq(uploadSession.clientId, client.id))
      .innerJoin(tenant, eq(uploadSession.tenantId, tenant.id))
      .innerJoin(staff, eq(uploadSession.createdByStaffId, staff.id))
      .where(and(eq(uploadSession.id, id), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
      .limit(1)

    if (!sessionRows[0]) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
    }

    const { session, clientRecord, tenantRecord, staffRecord } = sessionRows[0]

    const files = await db
      .select()
      .from(uploadFile)
      .where(and(eq(uploadFile.uploadSessionId, id), eq(uploadFile.tenantId, tenantId)))

    const matches = files.length > 0
      ? await db.select().from(materialMatch).where(
          and(
            inArray(materialMatch.uploadFileId, files.map((f) => f.id)),
            eq(materialMatch.tenantId, tenantId),
          ),
        )
      : []

    const runs = files.length > 0
      ? await db.select().from(analysisRun).where(
          and(
            inArray(analysisRun.uploadFileId, files.map((f) => f.id)),
            eq(analysisRun.tenantId, tenantId),
          ),
        )
      : []

    const itemRows = await db
      .select({ item: checklistItem })
      .from(clientChecklist)
      .innerJoin(checklistTemplate, eq(clientChecklist.templateId, checklistTemplate.id))
      .innerJoin(checklistItem, eq(checklistItem.templateId, checklistTemplate.id))
      .where(and(eq(clientChecklist.clientId, clientRecord.id), eq(clientChecklist.tenantId, tenantId)))
      .orderBy(checklistItem.sortOrder)

    return NextResponse.json({
      session: {
        ...session,
        uploadUrl: resolveStoredUploadUrl(session.uploadUrl),
      },
      client: clientRecord,
      tenant: tenantRecord,
      staff: staffRecord,
      files,
      matches,
      runs,
      checklistItems: itemRows.map((r) => r.item),
    })
  } catch (err) {
    console.error('[GET /api/sessions/[id]]', err)
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

    const [staffRows, sessionRows] = await Promise.all([
      db
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
        .limit(1),
      db
        .select({
          id: uploadSession.id,
          requestEventId: uploadSession.requestEventId,
        })
        .from(uploadSession)
        .where(and(eq(uploadSession.id, id), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
        .limit(1),
    ])

    const staffId = staffRows[0]?.id
    if (!staffId) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const session = sessionRows[0]
    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
    }

    const ts = toDBString(now())

    await deleteSessionBlobObjects({ tenantId, sessionIds: [id] })

    await db.transaction(async (tx) => {
      await tx
        .update(uploadSession)
        .set({
          status: 'revoked',
          deletedAt: ts,
          deletedByStaffId: staffId,
        })
        .where(and(eq(uploadSession.id, id), eq(uploadSession.tenantId, tenantId)))

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
            eq(clientRequestEvent.tenantId, tenantId),
            isNull(clientRequestEvent.deletedAt),
            or(
              eq(clientRequestEvent.uploadSessionId, id),
              session.requestEventId
                ? eq(clientRequestEvent.id, session.requestEventId)
                : eq(clientRequestEvent.uploadSessionId, id),
            ),
          ),
        )
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/sessions/[id]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
