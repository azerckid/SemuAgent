import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyToken } from '@/lib/session'
import { submitFilePassword } from '@/lib/upload/file-password'

// 클라이언트 업로드 포털 경로: 토큰 인증.
// 비밀번호는 즉시 소비 후 폐기하며, 요청/응답/로그 어디에도 남기지 않는다.
const submitPasswordSchema = z.object({
  rawToken: z.string().min(1),
  password: z.string().min(1).max(255),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const body = await req.json().catch(() => null)
  const parsed = submitPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다' }, { status: 400 })
  }

  const session = await verifyToken(parsed.data.rawToken)
  if (!session) {
    return NextResponse.json({ error: '유효하지 않거나 만료된 세션입니다' }, { status: 401 })
  }

  const { fileId } = await params

  try {
    const result = await submitFilePassword({
      fileId,
      tenantId: session.tenantId,
      password: parsed.data.password,
      expectedSessionId: session.id,
      requireMutableSession: true,
    })

    if (result.ok) {
      const { overrideBuffer } = result
      after(async () => {
        try {
          const { analyzeFileAndMaybeFinalize } = await import('@/lib/ai/process')
          await analyzeFileAndMaybeFinalize(fileId, session.tenantId, { overrideBuffer })
        } catch (err) {
          console.error(`[upload-password] 복호화 후 재분석 실패 (${fileId}):`, err)
        }
      })
      return NextResponse.json({ status: 'consumed' })
    }

    if (result.status === 'invalid') {
      return NextResponse.json(
        { status: 'invalid', error: '비밀번호가 올바르지 않습니다' },
        { status: 400 },
      )
    }

    if (result.reason === 'file_not_found') {
      return NextResponse.json({ error: '대상 파일을 찾을 수 없습니다' }, { status: 404 })
    }
    if (result.reason === 'session_locked') {
      return NextResponse.json(
        { error: '이미 완료된 요청은 비밀번호를 입력할 수 없습니다' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: '비밀번호가 필요한 파일이 아닙니다' },
      { status: 409 },
    )
  } catch (err) {
    // 비밀번호가 섞여 나가지 않도록 에러 원문은 흘리지 않는다.
    console.error(`[upload-password] 처리 실패 (fileId=${fileId})`)
    void err
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
