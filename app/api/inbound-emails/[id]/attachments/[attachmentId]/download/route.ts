import { get } from '@vercel/blob'
import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { inboundEmail, inboundEmailAttachment, staff, staffMailbox } from '@/lib/db/schema'

function contentDisposition(filename: string) {
  const fallback = filename
    .replace(/[\\/\r\n"]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .slice(0, 120) || 'inbound-attachment'

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function isAuthError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === 'Unauthorized' || err.message.startsWith('No active tenant'))
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id, attachmentId } = await params

    const [me] = await db
      .select({ id: staff.id, role: staff.role })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .limit(1)

    if (!me) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [row] = await db
      .select({
        attachment: inboundEmailAttachment,
        mailboxCurrentStaffId: staffMailbox.currentStaffId,
        mailboxState: staffMailbox.state,
      })
      .from(inboundEmailAttachment)
      .innerJoin(inboundEmail, eq(inboundEmailAttachment.inboundEmailId, inboundEmail.id))
      .innerJoin(staffMailbox, eq(inboundEmail.staffMailboxId, staffMailbox.id))
      .where(
        and(
          eq(inboundEmailAttachment.id, attachmentId),
          eq(inboundEmailAttachment.inboundEmailId, id),
          eq(inboundEmailAttachment.tenantId, tenantId),
          eq(inboundEmail.tenantId, tenantId),
        ),
      )
      .limit(1)

    // handoff_required(인계 필요) 메일함은 새 담당자가 배정되기 전까지 STAFF에게 노출하지 않는다.
    const isAccessible = row && (
      me.role === 'TENANT_ADMIN'
      || (row.mailboxState !== 'handoff_required' && row.mailboxCurrentStaffId === me.id)
    )
    if (!isAccessible) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    if (row.attachment.status !== 'stored' || !row.attachment.storageKey) {
      return Response.json({ error: '첨부 파일이 보관되어 있지 않습니다' }, { status: 409 })
    }

    const blob = await get(row.attachment.storageKey, { access: 'private' })
    if (!blob || blob.statusCode !== 200) {
      return Response.json({ error: '첨부 파일을 가져올 수 없습니다' }, { status: 502 })
    }

    const buffer = await new Response(blob.stream).arrayBuffer()
    const filename = row.attachment.originalFilename ?? 'inbound-attachment'

    return new Response(buffer, {
      headers: {
        'Content-Type': blob.blob.contentType ?? row.attachment.contentType ?? 'application/octet-stream',
        'Content-Disposition': contentDisposition(filename),
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (err) {
    if (isAuthError(err)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[GET /api/inbound-emails/[id]/attachments/[attachmentId]/download]', err instanceof Error ? err.name : 'UnknownError')
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
