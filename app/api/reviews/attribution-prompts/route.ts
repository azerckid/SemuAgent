import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForPeriodAttribution } from '@/lib/bookkeeping/period-attribution-service'
import {
  ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_MESSAGE,
  isMissingReviewAttributionSavedPromptTableError,
} from '@/lib/reviews/attribution-saved-prompt-errors'
import { listAttributionSavedPrompts } from '@/lib/reviews/attribution-saved-prompts'

const listQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantSession()
    const url = new URL(req.url)
    const parsedQuery = listQuerySchema.safeParse({
      includeInactive: url.searchParams.get('includeInactive') ?? undefined,
    })
    const includeInactive = parsedQuery.success ? parsedQuery.data.includeInactive : false

    const prompts = await listAttributionSavedPrompts({ tenantId, includeInactive })
    return NextResponse.json({ prompts, tableReady: true })
  } catch (err) {
    if (isMissingReviewAttributionSavedPromptTableError(err)) {
      return NextResponse.json({ prompts: [], tableReady: false })
    }
    console.error('[GET /api/reviews/attribution-prompts]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const body = await req.json()
    const { createAttributionSavedPromptSchema } = await import('@/lib/validations/attribution-saved-prompt')
    const parsed = createAttributionSavedPromptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForPeriodAttribution({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const { createAttributionSavedPrompt } = await import('@/lib/reviews/attribution-saved-prompts')
    const result = await createAttributionSavedPrompt({
      tenantId,
      staffId: staffRecord.id,
      name: parsed.data.name,
      description: parsed.data.description,
      promptText: parsed.data.promptText,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ prompt: result.prompt }, { status: 201 })
  } catch (err) {
    if (isMissingReviewAttributionSavedPromptTableError(err)) {
      return NextResponse.json({ error: ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_MESSAGE }, { status: 503 })
    }
    console.error('[POST /api/reviews/attribution-prompts]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
