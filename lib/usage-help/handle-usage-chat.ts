import { resolveRouteSuggestedQuestions, resolveUsageHelpRouteContext } from '@/lib/usage-help/route-context'
import { sanitizeUsageHelpRoutePath } from '@/lib/usage-help/route-hint'
import { resolveUiTermAnswer } from '@/lib/usage-help/ui-term-answers'
import { retrieveUsageHelpDocSnippets } from '@/lib/usage-help/docs-retrieval'
import { generateUsageHelpAnswer } from '@/lib/usage-help/generate-answer'
import { evaluateUsageHelpAnswerSafety } from '@/lib/usage-help/post-generation-guard'
import {
  assertAndConsumeUsageHelpLlmRateLimit,
  UsageHelpRateLimitError,
} from '@/lib/usage-help/rate-limit'
import { redactUsageHelpLlmAnswer } from '@/lib/usage-help/response-redaction'
import {
  buildUsageHelpRefusalResponse,
  USAGE_HELP_ERROR_ANSWER,
  USAGE_HELP_NO_DOC_ANSWER,
} from '@/lib/usage-help/refusal-templates'
import { classifyUsageHelpScope } from '@/lib/usage-help/scope-classifier'
import { normalizeSourceLabels } from '@/lib/usage-help/source-labels'
import {
  usageHelpChatResponseSchema,
  type UsageHelpChatRequest,
  type UsageHelpChatResponse,
} from '@/lib/usage-help/schemas'
import {
  logUsageHelpEvent,
  logUsageHelpProviderFailure,
} from '@/lib/usage-help/usage-help-events'

export type UsageHelpRequestContext = {
  tenantId: string
  userId: string
}

function buildSuggestedQuestions(routePath: string | null) {
  return resolveRouteSuggestedQuestions(routePath ?? '/dashboard').slice(0, 3)
}

function buildUiTermResponse(params: {
  question: string
  defaultSourceLabel: string
  suggestedQuestions: string[]
}): UsageHelpChatResponse | null {
  const uiTermAnswer = resolveUiTermAnswer(params.question)
  if (!uiTermAnswer) return null

  return usageHelpChatResponseSchema.parse({
    status: 'answered',
    answer: uiTermAnswer.body,
    sourceLabels: normalizeSourceLabels(
      [uiTermAnswer.sourceLabel],
      params.defaultSourceLabel,
    ),
    suggestedQuestions: params.suggestedQuestions,
  })
}

export async function handleUsageHelpChat(
  request: UsageHelpChatRequest,
  context: UsageHelpRequestContext,
): Promise<UsageHelpChatResponse> {
  const startedAt = Date.now()
  const routePath = sanitizeUsageHelpRoutePath(request.routePath)
  const routeContext = resolveUsageHelpRouteContext(routePath)
  const suggestedQuestions = buildSuggestedQuestions(routePath)

  const scope = classifyUsageHelpScope(request.question)
  if (scope.kind === 'refused') {
    logUsageHelpEvent({
      outcome: 'refused',
      routeKey: routeContext.routeKey,
      llmInvoked: false,
      durationMs: Date.now() - startedAt,
      scopeRefused: true,
    })
    return buildUsageHelpRefusalResponse({
      reason: scope.reason,
      suggestedQuestions,
    })
  }

  const uiTermResponse = buildUiTermResponse({
    question: request.question,
    defaultSourceLabel: routeContext.defaultSourceLabel,
    suggestedQuestions,
  })
  if (uiTermResponse) {
    logUsageHelpEvent({
      outcome: 'answered',
      routeKey: routeContext.routeKey,
      llmInvoked: false,
      durationMs: Date.now() - startedAt,
    })
    return uiTermResponse
  }

  try {
    const snippets = await retrieveUsageHelpDocSnippets(request.question)
    if (snippets.length === 0) {
      logUsageHelpEvent({
        outcome: 'answered',
        routeKey: routeContext.routeKey,
        llmInvoked: false,
        durationMs: Date.now() - startedAt,
      })
      return usageHelpChatResponseSchema.parse({
        status: 'answered',
        answer: USAGE_HELP_NO_DOC_ANSWER,
        sourceLabels: normalizeSourceLabels([], routeContext.defaultSourceLabel),
        suggestedQuestions,
      })
    }

    assertAndConsumeUsageHelpLlmRateLimit({
      tenantId: context.tenantId,
      userId: context.userId,
    })

    const modelOutput = await generateUsageHelpAnswer({
      question: request.question,
      routeContext,
      cautious: scope.kind === 'usage_cautious',
      snippets,
    })

    if (modelOutput.status === 'refused') {
      const fallback = buildUiTermResponse({
        question: request.question,
        defaultSourceLabel: routeContext.defaultSourceLabel,
        suggestedQuestions: modelOutput.suggestedQuestions.length > 0
          ? modelOutput.suggestedQuestions
          : suggestedQuestions,
      })
      if (fallback) {
        logUsageHelpEvent({
          outcome: 'answered',
          routeKey: routeContext.routeKey,
          llmInvoked: true,
          durationMs: Date.now() - startedAt,
        })
        return fallback
      }

      logUsageHelpEvent({
        outcome: 'refused',
        routeKey: routeContext.routeKey,
        llmInvoked: true,
        durationMs: Date.now() - startedAt,
      })
      return buildUsageHelpRefusalResponse({
        reason: 'unsafe_answer',
        suggestedQuestions: modelOutput.suggestedQuestions.length > 0
          ? modelOutput.suggestedQuestions
          : suggestedQuestions,
      })
    }

    const safety = evaluateUsageHelpAnswerSafety(modelOutput)
    if (!safety.safe) {
      logUsageHelpEvent({
        outcome: 'refused',
        routeKey: routeContext.routeKey,
        llmInvoked: true,
        durationMs: Date.now() - startedAt,
      })
      return buildUsageHelpRefusalResponse({
        reason: safety.reason,
        suggestedQuestions,
      })
    }

    const rawSourceLabels =
      modelOutput.sourceLabels.length > 0
        ? modelOutput.sourceLabels
        : snippets.slice(0, 1).map((snippet) => snippet.sourceLabel)

    const redaction = redactUsageHelpLlmAnswer(modelOutput.answer)

    logUsageHelpEvent({
      outcome: 'answered',
      routeKey: routeContext.routeKey,
      llmInvoked: true,
      durationMs: Date.now() - startedAt,
      redacted: redaction.redacted,
    })

    return usageHelpChatResponseSchema.parse({
      status: 'answered',
      answer: redaction.answer,
      sourceLabels: normalizeSourceLabels(rawSourceLabels, routeContext.defaultSourceLabel),
      suggestedQuestions:
        modelOutput.suggestedQuestions.length > 0
          ? modelOutput.suggestedQuestions
          : suggestedQuestions,
    })
  } catch (err) {
    if (err instanceof UsageHelpRateLimitError) {
      logUsageHelpEvent({
        outcome: 'rate_limited',
        routeKey: routeContext.routeKey,
        llmInvoked: false,
        durationMs: Date.now() - startedAt,
      })
      throw err
    }

    logUsageHelpProviderFailure({
      routeKey: routeContext.routeKey,
      errorName: err instanceof Error ? err.name : 'UnknownError',
    })
    logUsageHelpEvent({
      outcome: 'error',
      routeKey: routeContext.routeKey,
      llmInvoked: true,
      durationMs: Date.now() - startedAt,
    })

    return usageHelpChatResponseSchema.parse({
      status: 'error',
      answer: USAGE_HELP_ERROR_ANSWER,
      sourceLabels: [],
      suggestedQuestions,
    })
  }
}

export { UsageHelpRateLimitError }
