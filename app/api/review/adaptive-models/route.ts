import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { staff } from '@/lib/db/schema'
import { createProposedReviewAdaptiveModel } from '@/lib/reviews/adaptive-structuring-registry'

export const maxDuration = 300

const createReviewAdaptiveModelSchema = z.object({
  sessionId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()

    const body = await req.json().catch(() => null)
    const parsed = createReviewAdaptiveModelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'sessionId가 필요합니다' }, { status: 400 })
    }

    const staffRow = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    if (!staffRow[0]) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const result = await createProposedReviewAdaptiveModel({
      tenantId,
      sessionId: parsed.data.sessionId,
      createdByStaffId: staffRow[0].id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ modelId: result.modelId }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/review/adaptive-models]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
