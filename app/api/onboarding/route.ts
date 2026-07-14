import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { randomUUID } from 'crypto'
import { createTenantSchema } from '@/lib/validations/match'
import { createTenantWithOrg } from '@/lib/services/org-sync'
import { ensureFirstRunSampleDataset } from '@/lib/first-run-sample/seed'
import { requireSession } from '@/lib/auth-helpers'
import { buildCompanyOrganizationSlug } from '@/lib/onboarding/company-organization-slug'

export async function POST(req: Request) {
  try {
    const session = await requireSession()

    const body = await req.json()
    const parsed = createTenantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const org = await createTenantWithOrg(
      {
        name: parsed.data.name,
        subdomain: buildCompanyOrganizationSlug(parsed.data.name, randomUUID()),
      },
      await headers(),
    )

    const sampleResult = await ensureFirstRunSampleDataset({
      tenantId: org.id,
      userId: session.user.id,
      source: 'first_run_onboarding',
    })
    if (sampleResult.status === 'failed') {
      console.error('[POST /api/onboarding] first-run sample seed failed', sampleResult.errorMessage)
    }

    return NextResponse.json({ orgId: org.id, sampleStatus: sampleResult.status })
  } catch (err) {
    console.error('[POST /api/onboarding]', err)
    const message = err instanceof Error ? err.message : '서버 오류'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
