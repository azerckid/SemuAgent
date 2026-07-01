'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'
import { postUsageHelpChat } from './usage-help-client'
import {
  getStaticAnswer,
  resolveSuggestedQuestions,
} from './usage-help-suggested-questions'
import { resolveUsageHelpRouteContext } from '@/lib/usage-help/route-context'
import { normalizeSourceLabels } from '@/lib/usage-help/source-labels'

import { USAGE_HELP_ERROR_ANSWER } from '@/lib/usage-help/refusal-templates'

type UsageHelpMessage =
  | { kind: 'answer'; question: string; answer: string; sourceLabels: string[] }
  | { kind: 'refused'; question: string; answer: string; suggestedQuestions: string[] }
  | { kind: 'error'; question: string; answer: string; suggestedQuestions: string[] }
  | { kind: 'rate_limited'; question: string; answer: string }
  | { kind: 'loading'; question: string }

export interface UsageHelpPanelProps {
  pathname: string
  onClose: () => void
}

export function UsageHelpPanel({ pathname, onClose }: UsageHelpPanelProps) {
  const [messages, setMessages] = useState<UsageHelpMessage[]>([])
  const [draft, setDraft] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const suggestedQuestions = resolveSuggestedQuestions(pathname)
  const routeContext = resolveUsageHelpRouteContext(pathname)

  const replaceLoadingMessage = (
    question: string,
    next: Exclude<UsageHelpMessage, { kind: 'loading' }>,
  ) => {
    setMessages((prev) => {
      const withoutLoading = prev.filter(
        (message) => !(message.kind === 'loading' && message.question === question),
      )
      return [...withoutLoading, next]
    })
  }

  const askQuestion = async (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || isSubmitting) return

    const staticAnswer = getStaticAnswer(trimmed, pathname)
    if (staticAnswer) {
      setMessages((prev) => [
        ...prev,
        {
          kind: 'answer',
          question: trimmed,
          answer: staticAnswer.body,
          sourceLabels: normalizeSourceLabels(
            [staticAnswer.sourceLabel],
            routeContext.defaultSourceLabel,
          ),
        },
      ])
      return
    }

    setIsSubmitting(true)
    setMessages((prev) => [...prev, { kind: 'loading', question: trimmed }])

    try {
      const result = await postUsageHelpChat({
        question: trimmed,
        routePath: pathname,
      })

      if (result.kind === 'rate_limited') {
        replaceLoadingMessage(trimmed, {
          kind: 'rate_limited',
          question: trimmed,
          answer: result.answer,
        })
        return
      }

      const response = result.response

      if (response.status === 'answered') {
        replaceLoadingMessage(trimmed, {
          kind: 'answer',
          question: trimmed,
          answer: response.answer,
          sourceLabels: normalizeSourceLabels(
            response.sourceLabels,
            routeContext.defaultSourceLabel,
          ),
        })
        return
      }

      if (response.status === 'refused') {
        replaceLoadingMessage(trimmed, {
          kind: 'refused',
          question: trimmed,
          answer: response.answer,
          suggestedQuestions: response.suggestedQuestions,
        })
        return
      }

      replaceLoadingMessage(trimmed, {
        kind: 'error',
        question: trimmed,
        answer: response.answer,
        suggestedQuestions: response.suggestedQuestions,
      })
    } catch {
      replaceLoadingMessage(trimmed, {
        kind: 'error',
        question: trimmed,
        answer: USAGE_HELP_ERROR_ANSWER,
        suggestedQuestions,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const question = draft
    setDraft('')
    await askQuestion(question)
  }

  return (
    <section
      role="complementary"
      aria-label="JARYO 사용 안내"
      className="fixed inset-x-3 bottom-3 z-50 flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[390px] sm:max-h-[min(620px,calc(100dvh-2rem))]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-foreground">JARYO 사용 안내</h2>
          <p className="mt-1 text-xs text-muted-foreground">JARYO 사용법만 안내합니다.</p>
          <p className="mt-1 text-xs font-medium text-foreground">현재: {routeContext.screenLabel}</p>
        </div>
        <button
          type="button"
          aria-label="사용 안내 패널 닫기"
          onClick={onClose}
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((question) => (
              <button
                key={question}
                type="button"
                disabled={isSubmitting}
                onClick={() => void askQuestion(question)}
                className="rounded-full border border-blue-200 bg-background px-3 py-1.5 text-left text-xs text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>

          {messages.map((message, index) => (
            <article
              key={`${message.kind}-${index}-${message.question}`}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-sm leading-relaxed',
                message.kind === 'loading'
                  || message.kind === 'error'
                  || message.kind === 'rate_limited'
                  ? 'border-border bg-muted/30 text-muted-foreground'
                  : 'border-border bg-background text-foreground',
              )}
            >
              <p className="mb-1 text-xs font-semibold text-foreground">{message.question}</p>
              {message.kind === 'loading' ? (
                <p className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  안내를 준비하고 있습니다.
                </p>
              ) : message.kind === 'answer' ? (
                <>
                  <p>{message.answer}</p>
                  {message.sourceLabels.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      기준: {message.sourceLabels.join(' · ')}
                    </p>
                  ) : null}
                </>
              ) : message.kind === 'refused' ? (
                <>
                  <p>{message.answer}</p>
                  {message.suggestedQuestions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.suggestedQuestions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void askQuestion(question)}
                          className="rounded-full border border-border bg-muted/20 px-2.5 py-1 text-left text-xs text-foreground hover:bg-muted/40 disabled:opacity-50"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : message.kind === 'error' ? (
                <>
                  <p>{message.answer}</p>
                  {message.suggestedQuestions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.suggestedQuestions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void askQuestion(question)}
                          className="rounded-full border border-border bg-muted/20 px-2.5 py-1 text-left text-xs text-foreground hover:bg-muted/40 disabled:opacity-50"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p>{message.answer}</p>
              )}
            </article>
          ))}
        </div>

        <form className="border-t border-border p-3" onSubmit={(event) => void handleSubmit(event)}>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={isSubmitting}
              placeholder="JARYO 사용법 질문"
              aria-label="JARYO 사용법 질문 입력"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSubmitting || draft.trim().length === 0}
              className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}
            >
              {isSubmitting ? '처리 중' : '질문'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
