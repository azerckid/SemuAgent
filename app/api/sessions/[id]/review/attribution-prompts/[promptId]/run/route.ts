import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForPeriodAttribution } from '@/lib/bookkeeping/period-attribution-service'
import { runAttributionSavedPrompt } from '@/lib/reviews/attribution-saved-prompt-run'
import {
  ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_MESSAGE,
  isMissingReviewAttributionSavedPromptTableError,
} from '@/lib/reviews/attribution-saved-prompt-errors'

const pathParamsSchema = z.object({
  id: z.string().trim().min(1).max(200),
  promptId: z.string().trim().min(1).max(200),
})

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; promptId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const resolvedParams = await params
    const parsedParams = pathParamsSchema.safeParse(resolvedParams)
    if (!parsedParams.success) {
      return NextResponse.json({ error: '잘못된 요청 경로입니다.' }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForPeriodAttribution({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const result = await runAttributionSavedPrompt({
      tenantId,
      sessionId: parsedParams.data.id,
      promptId: parsedParams.data.promptId,
      staffRecord,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      status: result.status,
      notReadyReason: result.notReadyReason,
      prompt: result.prompt,
      summary: result.summary,
      rows: result.rows,
    })
  } catch (err) {
    if (isMissingReviewAttributionSavedPromptTableError(err)) {
      return NextResponse.json({ error: ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_MESSAGE }, { status: 503 })
    }
    console.error('[POST /api/sessions/[id]/review/attribution-prompts/[promptId]/run]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
