import { NextResponse } from 'next/server'
import { submitClientPurposeAnswers } from '@/lib/bookkeeping/transaction-purpose-public-service'

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => null)

  try {
    const result = await submitClientPurposeAnswers({ input: body })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      requestId: result.requestId,
      status: result.status,
      answeredRowCount: result.answeredRowCount,
    })
  } catch (err) {
    console.error('[POST /api/upload/purpose-request/answers]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
