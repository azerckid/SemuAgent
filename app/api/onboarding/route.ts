import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createTenantSchema } from '@/lib/validations/match'
import { createTenantWithOrg } from '@/lib/services/org-sync'
import { requireSession } from '@/lib/auth-helpers'

export async function POST(req: Request) {
  try {
    await requireSession()

    const body = await req.json()
    const parsed = createTenantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const org = await createTenantWithOrg(
      { name: parsed.data.name, subdomain: parsed.data.subdomain },
      await headers(),
    )

    return NextResponse.json({ orgId: org.id })
  } catch (err) {
    console.error('[POST /api/onboarding]', err)
    const message = err instanceof Error ? err.message : '서버 오류'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
