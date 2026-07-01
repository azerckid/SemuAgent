import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { requireAnthropicEnv } from '@/lib/env'

const bodySchema = z.object({
  requestEmailSubject: z.string().trim().max(200).optional(),
  requestEmailBody: z.string().trim().min(1).max(10000),
})

const criteriaSchema = z.object({
  criteria: z.string().trim().min(1).max(10000),
})

export async function POST(req: Request) {
  try {
    await requireTenantSession()

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { ANTHROPIC_API_KEY } = requireAnthropicEnv()
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1600,
      system: [
        '당신은 한국 회계법인의 자료 요청 메일을 AI 검토 기준으로 정리하는 도우미입니다.',
        '클라이언트에게 보낸 메일 원문에서 자료 제출 조건만 추출하세요.',
        '없는 내용을 추정하지 말고, 불명확한 조건은 "확인 필요"로 표시하세요.',
        '반드시 JSON만 출력하세요.',
      ].join('\n'),
      messages: [{
        role: 'user',
        content: `다음 요청 메일에서 AI가 제출 자료를 검토할 때 사용할 기준을 정리해 주세요.

제목:
${parsed.data.requestEmailSubject || '(제목 없음)'}

본문:
${parsed.data.requestEmailBody}

출력 JSON 형식:
{
  "criteria": "- 필수 제출 자료: ...\\n- 조건부/선택 자료: ...\\n- 파일 형식/제출 방식: ...\\n- 금액/기간/비밀번호 등 검토 조건: ...\\n- 확인 필요: ..."
}`,
      }],
    })

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const json = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!json) {
      return Response.json({ error: 'AI 응답에서 기준 JSON을 찾을 수 없습니다' }, { status: 502 })
    }

    const criteria = criteriaSchema.safeParse(JSON.parse(json))
    if (!criteria.success) {
      return Response.json({ error: criteria.error.flatten() }, { status: 502 })
    }

    return Response.json({ criteria: criteria.data.criteria })
  } catch (err) {
    console.error('[POST /api/sessions/extract-criteria]', err)
    return Response.json({ error: '판단 기준 추출에 실패했습니다' }, { status: 500 })
  }
}
