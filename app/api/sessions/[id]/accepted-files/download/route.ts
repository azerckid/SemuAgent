import { get } from '@vercel/blob'
import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { staff, uploadSession } from '@/lib/db/schema'
import { getAcceptedStoredFilesForSession } from '@/lib/sessions/accepted-files'

const querySchema = z.object({
  fileId: z.string().min(1).optional(),
})

const DOWNLOADABLE_STATUSES = ['ready_for_accountant', 'completed'] as const

function contentDisposition(filename: string) {
  const fallback = filename
    .replace(/[\\/\r\n"]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .slice(0, 120) || 'accepted-file'

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function contentTypeFor(fileType: string) {
  switch (fileType) {
    case 'pdf':
      return 'application/pdf'
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'image':
      return 'image/*'
    default:
      return 'application/octet-stream'
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId } = await params
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const [staffRecord] = await db
      .select({ id: staff.id, role: staff.role })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .limit(1)

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const [session] = await db
      .select({
        id: uploadSession.id,
        createdByStaffId: uploadSession.createdByStaffId,
        requestKind: uploadSession.requestKind,
        status: uploadSession.status,
      })
      .from(uploadSession)
      .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
      .limit(1)

    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
    }
    if (staffRecord.role === 'STAFF' && session.createdByStaffId !== staffRecord.id) {
      return NextResponse.json({ error: '자신이 생성한 세션의 자료만 다운로드할 수 있습니다' }, { status: 403 })
    }
    if (session.requestKind !== 'general') {
      return NextResponse.json({ error: '일반 자료 세션에서만 사용할 수 있습니다' }, { status: 409 })
    }
    if (!DOWNLOADABLE_STATUSES.includes(session.status as typeof DOWNLOADABLE_STATUSES[number])) {
      return NextResponse.json({ error: '자료 충족 검토 상태에서만 다운로드할 수 있습니다' }, { status: 409 })
    }

    const accepted = await getAcceptedStoredFilesForSession({ sessionId, tenantId })
    if (accepted.files.length === 0) {
      return NextResponse.json({ error: '다운로드할 수 있는 부합 자료가 없습니다' }, { status: 404 })
    }

    const file = parsed.data.fileId
      ? accepted.files.find((row) => row.id === parsed.data.fileId)
      : accepted.files.length === 1 ? accepted.files[0] : null

    if (!file) {
      return NextResponse.json({ error: '다운로드할 파일을 선택해 주세요' }, { status: 409 })
    }

    const blob = await get(file.storageKey, { access: 'private' })
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: '파일을 가져올 수 없습니다' }, { status: 502 })
    }

    const buffer = await new Response(blob.stream).arrayBuffer()

    return new Response(buffer, {
      headers: {
        'Content-Type': blob.blob.contentType ?? contentTypeFor(file.fileType),
        'Content-Disposition': contentDisposition(file.originalFilename),
      },
    })
  } catch (err) {
    console.error('[GET /api/sessions/[id]/accepted-files/download]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
