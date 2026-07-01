import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForPeriodAttribution } from '@/lib/bookkeeping/period-attribution-service'
import {
  ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_MESSAGE,
  isMissingReviewAttributionSavedPromptTableError,
} from '@/lib/reviews/attribution-saved-prompt-errors'
import { updateAttributionSavedPrompt } from '@/lib/reviews/attribution-saved-prompts'

const promptIdSchema = z.string().trim().min(1).max(200)

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ promptId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { promptId: rawPromptId } = await params
    const promptIdParsed = promptIdSchema.safeParse(rawPromptId)
    if (!promptIdParsed.success) {
      return NextResponse.json({ error: '잘못된 프롬프트 ID입니다.' }, { status: 400 })
    }

    const body = await req.json()
    const { updateAttributionSavedPromptSchema } = await import('@/lib/validations/attribution-saved-prompt')
    const parsed = updateAttributionSavedPromptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForPeriodAttribution({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const result = await updateAttributionSavedPrompt({
      tenantId,
      staffId: staffRecord.id,
      promptId: promptIdParsed.data,
      ...parsed.data,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ prompt: result.prompt })
  } catch (err) {
    if (isMissingReviewAttributionSavedPromptTableError(err)) {
      return NextResponse.json({ error: ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_MESSAGE }, { status: 503 })
    }
    console.error('[PATCH /api/reviews/attribution-prompts/[promptId]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
