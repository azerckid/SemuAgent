import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { staff } from '@/lib/db/schema'

const updateProfileSchema = z.object({
  phone: z.string().max(100).optional(),
})

export async function PATCH(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const body = await req.json()
    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: '입력값 오류' }, { status: 400 })
    }

    await db
      .update(staff)
      .set({ phone: parsed.data.phone ?? null })
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/settings/staff/me]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
