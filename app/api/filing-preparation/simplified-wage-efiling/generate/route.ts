import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { assembleBuildInput } from '@/lib/efiling-simplified-wage/assemble-build-input'
import { buildSimplifiedWageRecords, serializeSimplifiedWageRecords } from '@/lib/efiling-simplified-wage/build-records'
import { loadSimplifiedWageEfilingContext } from '@/lib/efiling-simplified-wage/efiling-context'
import {
  periodKeyFromGenerateInput,
  simplifiedWageEfilingGenerateSchema,
} from '@/lib/validations/simplified-wage-efiling'

function contentDisposition(fileName: string) {
  const safe = fileName.replace(/[\\/\r\n"]/g, '_').slice(0, 120) || 'simplified-wage-efiling'
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantSession()

    let json: unknown
    try {
      json = await req.json()
    } catch {
      return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 })
    }

    const parsed = simplifiedWageEfilingGenerateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값 검증에 실패했습니다.', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const body = parsed.data
    const ctx = await loadSimplifiedWageEfilingContext({
      tenantId,
      periodKey: periodKeyFromGenerateInput(body),
    })

    if (!ctx) {
      return NextResponse.json({ error: '사업장을 먼저 등록해 주세요.' }, { status: 404 })
    }

    if (ctx.business.submitterKind === 'corporation' && !body.representativeId) {
      return NextResponse.json(
        { error: '법인 사업장은 법인등록번호(13자리) 입력이 필요합니다.', field: 'representativeId' },
        { status: 400 },
      )
    }

    const buildInput = assembleBuildInput(ctx, body)
    const result = buildSimplifiedWageRecords(buildInput)

    if (!result.ok) {
      return NextResponse.json({ errors: result.issues }, { status: 400 })
    }

    const fileBody = serializeSimplifiedWageRecords(result.records)

    return new Response(new Uint8Array(fileBody), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': contentDisposition(result.fileName),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
