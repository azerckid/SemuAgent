import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { materialMatch, uploadFile, uploadSession, staff } from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { updateMatchSchema } from '@/lib/validations/match'
import { checkAndCompleteSession } from '@/lib/completion'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId, matchId } = await params

    const body = await req.json()
    const parsed = updateMatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    // 현재 사용자의 staff 레코드 조회
    const staffRows = await db
      .select({ id: staff.id, role: staff.role })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    const staffRecord = staffRows[0]

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    // STAFF는 자신이 생성한 세션의 매칭만 처리 가능
    if (staffRecord.role === 'STAFF') {
      const sessionRows = await db
        .select({ createdByStaffId: uploadSession.createdByStaffId })
        .from(uploadSession)
        .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
        .limit(1)

      if (sessionRows[0]?.createdByStaffId !== staffRecord.id) {
        return NextResponse.json({ error: '자신이 생성한 세션의 매칭만 처리할 수 있습니다' }, { status: 403 })
      }
    }

    // 매칭 레코드가 이 테넌트·세션에 속하는지 확인
    const matchRows = await db
      .select({ match: materialMatch, file: uploadFile })
      .from(materialMatch)
      .innerJoin(uploadFile, eq(materialMatch.uploadFileId, uploadFile.id))
      .where(
        and(
          eq(materialMatch.id, matchId),
          eq(materialMatch.tenantId, tenantId),
          eq(uploadFile.uploadSessionId, sessionId),
        ),
      )
      .limit(1)

    if (!matchRows[0]) {
      return NextResponse.json({ error: '매칭 레코드를 찾을 수 없습니다' }, { status: 404 })
    }

    await db
      .update(materialMatch)
      .set({ status: parsed.data.status })
      .where(eq(materialMatch.id, matchId))

    // manual_approved 시: 항목에 파일이 접수된 것이므로 고객의 없음/나중에 선언을
    // 해제하고, 세션 완료 여부를 자동 확인한다.
    if (parsed.data.status === 'manual_approved') {
      const { clearUploadItemDeclaration } = await import('@/lib/upload/item-declaration')
      await clearUploadItemDeclaration({
        tenantId,
        uploadSessionId: sessionId,
        checklistItemId: matchRows[0].match.checklistItemId,
      })
      await checkAndCompleteSession(sessionId, tenantId)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/sessions/[id]/matches/[matchId]]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
