import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getClientPurposeRequest } from '@/lib/bookkeeping/transaction-purpose-public-service'

const querySchema = z.object({
  token: z.string().min(1),
  purposeRequest: z.string().min(1),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const parsed = querySchema.safeParse({
    token: req.nextUrl.searchParams.get('token'),
    purposeRequest: req.nextUrl.searchParams.get('purposeRequest'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: '요청 링크가 올바르지 않습니다.' }, { status: 400 })
  }

  try {
    const result = await getClientPurposeRequest({
      rawToken: parsed.data.token,
      purposeRequestId: parsed.data.purposeRequest,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      request: result.request,
      header: result.header,
      rows: result.rows,
    })
  } catch (err) {
    console.error('[GET /api/upload/purpose-request]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
