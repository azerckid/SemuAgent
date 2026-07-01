import Anthropic from '@anthropic-ai/sdk'
import { requireAnthropicEnv } from '@/lib/env'
import type { UsageHelpDocSnippet } from '@/lib/usage-help/docs-retrieval'
import type { UsageHelpRouteContext } from '@/lib/usage-help/route-context'
import {
  usageHelpModelOutputSchema,
  type UsageHelpModelOutput,
} from '@/lib/usage-help/schemas'

const USAGE_HELP_MODEL = 'claude-haiku-4-5-20251001'

function extractJsonFromResponse(text: string): string | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return jsonMatch ? jsonMatch[0] : null
}

function buildSystemPrompt() {
  return [
    '당신은 JARYO B2B SaaS의 내부 사용 안내 도우미입니다.',
    'JARYO 화면, 메뉴, 버튼, 상태 라벨, 업무 흐름 사용법만 짧게 안내합니다.',
    '다음 UI 용어 설명 질문은 JARYO 사용법이므로 반드시 status=answered로 답합니다:',
    '사유 입력, 제출 없음, 제출됨, 확인 필요, 잘못 올린 파일, 담당자 승인, 해당 없음/제외, 직접 업로드 등.',
    'status=refused는 일반 세무·법률·고객사별 자료·액션 실행·웹 검색 요청에만 사용합니다.',
    '세무·노무·법률·회계 판단, 고객사별 자료 분석, 웹 검색, 데이터 변경·발송·승인·삭제 실행은 하지 않습니다.',
    '제공된 JARYO 문서 발췌 범위를 넘어 추정하지 마세요.',
    '답변은 2~4문장으로 간결하게 작성합니다.',
    'sourceLabels에는 canonical 화면명 또는 workspace 이름만 넣습니다.',
    '반드시 JSON만 출력합니다.',
  ].join('\n')
}

function buildUserPrompt(params: {
  question: string
  routeContext: UsageHelpRouteContext
  cautious: boolean
  snippets: UsageHelpDocSnippet[]
}) {
  const snippetText =
    params.snippets.length > 0
      ? params.snippets
          .map(
            (snippet, index) =>
              `[${index + 1}] source=${snippet.sourceLabel}\nheading=${snippet.heading}\n${snippet.body}`,
          )
          .join('\n\n')
      : '(관련 문서 발췌 없음)'

  return [
    `질문: ${params.question}`,
    `현재 화면: ${params.routeContext.screenLabel}`,
    `화면 역할: ${params.routeContext.screenRole}`,
    `권장 source label: ${params.routeContext.defaultSourceLabel}`,
    params.cautious
      ? '질문이 다소 모호합니다. JARYO 사용법으로만 답하고, 필요하면 화면 이름을 다시 확인하도록 안내하세요.'
      : '질문이 JARYO 사용법 범위라면 문서 발췌와 현재 화면 맥락을 근거로 답하세요.',
    '문서 발췌:',
    snippetText,
    '출력 JSON 형식:',
    '{',
    '  "status": "answered" | "refused",',
    '  "answer": "짧은 한국어 답변",',
    '  "sourceLabels": ["자료 검토 화면"],',
    '  "suggestedQuestions": ["대안 질문"]',
    '}',
  ].join('\n')
}

export async function generateUsageHelpAnswer(params: {
  question: string
  routeContext: UsageHelpRouteContext
  cautious: boolean
  snippets: UsageHelpDocSnippet[]
}): Promise<UsageHelpModelOutput> {
  const { ANTHROPIC_API_KEY } = requireAnthropicEnv()
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: USAGE_HELP_MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(),
    messages: [{
      role: 'user',
      content: buildUserPrompt(params),
    }],
  })

  const rawOutput = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const json = extractJsonFromResponse(rawOutput)
  if (!json) {
    throw new Error('Usage help model output JSON not found')
  }

  const parsed = usageHelpModelOutputSchema.safeParse(JSON.parse(json))
  if (!parsed.success) {
    throw new Error(`Usage help model output validation failed: ${parsed.error.message}`)
  }

  return parsed.data
}
