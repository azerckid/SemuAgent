import { NextResponse } from 'next/server'
import { eq, and, inArray, ne, sql } from 'drizzle-orm'
import { del } from '@vercel/blob'
import { db } from '@/lib/db'
import {
  analysisRun,
  auditProof,
  client,
  clientCcGroup,
  clientChecklist,
  materialMatch,
  outboundEmail,
  staff,
  uploadFile,
  uploadSession,
} from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { updateClientSchema } from '@/lib/validations/client'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id } = await params

    const clientRows = await db
      .select()
      .from(client)
      .where(and(eq(client.id, id), eq(client.tenantId, tenantId)))
      .limit(1)

    const existing = clientRows[0]
    if (!existing) {
      return NextResponse.json({ error: '클라이언트를 찾을 수 없습니다' }, { status: 404 })
    }

    // STAFF는 자신이 배정된 클라이언트만 수정 가능
    const staffRows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    const staffRecord = staffRows[0]
    if (staffRecord?.role === 'STAFF' && existing.staffId !== staffRecord.id) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const updates: Partial<typeof client.$inferInsert> = {}
    if (parsed.data.name !== undefined) updates.name = parsed.data.name
    if (parsed.data.contactName !== undefined) updates.contactName = parsed.data.contactName
    if (parsed.data.email !== undefined) {
      const duplicateRows = await db
        .select({ id: client.id })
        .from(client)
        .where(
          and(
            eq(client.tenantId, tenantId),
            ne(client.id, id),
            sql`lower(${client.email}) = ${parsed.data.email}`,
          ),
        )
        .limit(1)

      if (duplicateRows[0]) {
        return NextResponse.json(
          { error: '이미 등록된 고객사 이메일입니다. 기존 고객사를 수정하거나 담당 회계사를 변경해 주세요.' },
          { status: 409 },
        )
      }

      updates.email = parsed.data.email
    }
    if (parsed.data.staffId !== undefined) {
      if (parsed.data.staffId) {
        const targetStaffRows = await db
          .select({ id: staff.id })
          .from(staff)
          .where(and(eq(staff.id, parsed.data.staffId), eq(staff.tenantId, tenantId)))
          .limit(1)
        if (!targetStaffRows[0]) {
          return NextResponse.json({ error: '담당자를 찾을 수 없습니다' }, { status: 404 })
        }
      }
      updates.staffId = parsed.data.staffId
    }
    if (parsed.data.address !== undefined) updates.address = parsed.data.address
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone
    if (parsed.data.analysisNotes !== undefined) updates.analysisNotes = parsed.data.analysisNotes

    if (Object.keys(updates).length > 0) {
      await db.update(client).set(updates).where(and(eq(client.id, id), eq(client.tenantId, tenantId)))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/clients/[id]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { id } = await params

    const clientRows = await db
      .select({ id: client.id })
      .from(client)
      .where(and(eq(client.id, id), eq(client.tenantId, tenantId)))
      .limit(1)

    if (!clientRows[0]) {
      return NextResponse.json({ error: '클라이언트를 찾을 수 없습니다' }, { status: 404 })
    }

    const sessions = await db
      .select({ id: uploadSession.id })
      .from(uploadSession)
      .where(and(eq(uploadSession.clientId, id), eq(uploadSession.tenantId, tenantId)))
    const sessionIds = sessions.map((session) => session.id)

    const files = sessionIds.length > 0
      ? await db
          .select({ id: uploadFile.id, storageKey: uploadFile.storageKey })
          .from(uploadFile)
          .where(and(inArray(uploadFile.uploadSessionId, sessionIds), eq(uploadFile.tenantId, tenantId)))
      : []
    const fileIds = files.map((file) => file.id)
    const blobUrls = files.map((file) => file.storageKey).filter(Boolean)

    if (blobUrls.length > 0) {
      await del(blobUrls)
    }

    if (fileIds.length > 0) {
      await db.delete(materialMatch).where(
        and(inArray(materialMatch.uploadFileId, fileIds), eq(materialMatch.tenantId, tenantId)),
      )
      await db.delete(analysisRun).where(
        and(inArray(analysisRun.uploadFileId, fileIds), eq(analysisRun.tenantId, tenantId)),
      )
      await db.delete(auditProof).where(
        and(inArray(auditProof.uploadFileId, fileIds), eq(auditProof.tenantId, tenantId)),
      )
    }

    if (sessionIds.length > 0) {
      await db.delete(auditProof).where(
        and(inArray(auditProof.uploadSessionId, sessionIds), eq(auditProof.tenantId, tenantId)),
      )
      await db.delete(outboundEmail).where(
        and(inArray(outboundEmail.uploadSessionId, sessionIds), eq(outboundEmail.tenantId, tenantId)),
      )
      await db.delete(uploadFile).where(
        and(inArray(uploadFile.uploadSessionId, sessionIds), eq(uploadFile.tenantId, tenantId)),
      )
      await db.delete(uploadSession).where(
        and(inArray(uploadSession.id, sessionIds), eq(uploadSession.tenantId, tenantId)),
      )
    }

    await db.delete(clientChecklist).where(
      and(eq(clientChecklist.clientId, id), eq(clientChecklist.tenantId, tenantId)),
    )
    await db.delete(clientCcGroup).where(
      and(eq(clientCcGroup.clientId, id), eq(clientCcGroup.tenantId, tenantId)),
    )
    await db.delete(client).where(and(eq(client.id, id), eq(client.tenantId, tenantId)))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/clients/[id]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
