import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { analyzeFileAndMaybeFinalize } from '@/lib/ai/process'
import { db } from '@/lib/db'
import { analysisRun, materialMatch, uploadFile, uploadSession } from '@/lib/db/schema'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { fileId } = await params

    const rows = await db
      .select({
        id: uploadFile.id,
        status: uploadFile.status,
        source: uploadSession.source,
      })
      .from(uploadFile)
      .innerJoin(uploadSession, eq(uploadFile.uploadSessionId, uploadSession.id))
      .where(and(
        eq(uploadFile.id, fileId),
        eq(uploadFile.tenantId, tenantId),
        eq(uploadSession.tenantId, tenantId),
      ))
      .limit(1)

    const file = rows[0]
    if (!file) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 })
    }
    if (file.source !== 'staff_direct') {
      return NextResponse.json({ error: '이 파일은 다시 시도할 수 없습니다' }, { status: 403 })
    }
    if (file.status !== 'failed') {
      return NextResponse.json({ error: '실패한 파일만 다시 시도할 수 있습니다' }, { status: 409 })
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(materialMatch)
        .where(and(eq(materialMatch.uploadFileId, fileId), eq(materialMatch.tenantId, tenantId)))
      await tx
        .delete(analysisRun)
        .where(and(eq(analysisRun.uploadFileId, fileId), eq(analysisRun.tenantId, tenantId)))
      await tx
        .update(uploadFile)
        .set({ status: 'uploaded' })
        .where(and(eq(uploadFile.id, fileId), eq(uploadFile.tenantId, tenantId)))
    })

    await analyzeFileAndMaybeFinalize(fileId, tenantId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/upload/files/[fileId]/retry]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '다시 시도에 실패했습니다' }, { status: 500 })
  }
}
