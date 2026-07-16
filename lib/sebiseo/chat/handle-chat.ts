import { redactAssistantText } from '@/lib/assistant/text-redaction'
import {
  assertAndConsumeUsageHelpLlmRateLimit,
  UsageHelpRateLimitError,
} from '@/lib/usage-help/rate-limit'
import { sanitizeUsageHelpRoutePath } from '@/lib/usage-help/route-hint'
import {
  retrieveSebiseoDocSnippets,
  type SebiseoDocSnippet,
} from './docs-retrieval'
import {
  buildSebiseoRefusal,
  SEBISEO_CHAT_ERROR_ANSWER,
  SEBISEO_CHAT_NO_DOC_ANSWER,
} from './refusal'
import {
  recentSebiseoHistory,
  sebiseoChatResponseSchema,
  type SebiseoChatRequest,
  type SebiseoChatResponse,
  type SebiseoChatHistoryItem,
  type SebiseoModelOutput,
} from './schemas'
import { classifySebiseoScope } from './scope-classifier'
import { resolveSebiseoScreenActions } from './screen-actions'

export type SebiseoChatContext = {
  tenantId: string
  userId: string
}

export type SebiseoChatDependencies = {
  retrieve: (message: string) => Promise<SebiseoDocSnippet[]>
  generate: (params: {
    message: string
    history: readonly SebiseoChatHistoryItem[]
    routePath: string | null
    snippets: readonly SebiseoDocSnippet[]
  }) => Promise<SebiseoModelOutput>
  consumeRateLimit: (context: SebiseoChatContext) => void
}

const defaultDependencies: SebiseoChatDependencies = {
  retrieve: retrieveSebiseoDocSnippets,
  generate: async (params) => {
    const { generateSebiseoAnswer } = await import('./generate-answer')
    return generateSebiseoAnswer(params)
  },
  consumeRateLimit: assertAndConsumeUsageHelpLlmRateLimit,
}

const UNSAFE_ANSWER_PATTERNS = [
  /(?:확정|신고|제출|납부)(?:을|를)?\s*(?:했|해\s*드렸|완료)/,
  /(?:자료|파일|거래).*(?:확인했|읽었|분석했)/,
  /세무사(?:로서|처럼)/,
] as const

function sanitizeRequest(request: SebiseoChatRequest): SebiseoChatRequest {
  return {
    ...request,
    message: redactAssistantText(request.message).text,
    history: recentSebiseoHistory(request.history).map((item) => ({
      role: item.role,
      content: redactAssistantText(item.content).text,
    })),
    routePath: sanitizeUsageHelpRoutePath(request.routePath) ?? '/dashboard/sebiseo',
  }
}

function unsafeAnswer(output: SebiseoModelOutput) {
  return output.status === 'answered'
    && UNSAFE_ANSWER_PATTERNS.some((pattern) => pattern.test(output.answer))
}

export async function handleSebiseoChat(
  request: SebiseoChatRequest,
  context: SebiseoChatContext,
  dependencies: SebiseoChatDependencies = defaultDependencies,
): Promise<SebiseoChatResponse> {
  const sanitized = sanitizeRequest(request)
  const scope = classifySebiseoScope(sanitized.message)
  if (scope.kind === 'refused') return buildSebiseoRefusal(scope.reason)

  try {
    const snippets = await dependencies.retrieve(sanitized.message)
    if (snippets.length === 0) {
      return sebiseoChatResponseSchema.parse({
        status: 'answered',
        answer: SEBISEO_CHAT_NO_DOC_ANSWER,
        suggestedActions: [],
      })
    }

    dependencies.consumeRateLimit(context)
    const output = await dependencies.generate({
      message: sanitized.message,
      history: sanitized.history,
      routePath: sanitized.routePath ?? null,
      snippets,
    })
    if (output.status === 'refused' || unsafeAnswer(output)) {
      return buildSebiseoRefusal('unsafe_answer')
    }

    const redacted = redactAssistantText(output.answer)
    return sebiseoChatResponseSchema.parse({
      status: 'answered',
      answer: redacted.text,
      // CUI-3c: 허용된 답변에만 서버 고정 목록 기반 화면 이동 버튼을 붙인다.
      suggestedActions: resolveSebiseoScreenActions(sanitized.message),
    })
  } catch (error) {
    if (error instanceof UsageHelpRateLimitError) throw error
    console.info('[sebiseo-chat]', JSON.stringify({
      event: 'provider_error',
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }))
    return sebiseoChatResponseSchema.parse({
      status: 'error',
      answer: SEBISEO_CHAT_ERROR_ANSWER,
      suggestedActions: [],
    })
  }
}

export { UsageHelpRateLimitError as SebiseoRateLimitError }
