'use client'

import { useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'
import { PER_ANSWER_CAUTION } from '@/lib/ai/consultation/disclaimer'
import { postLawSearch } from './law-search-client'
import type { ConsultationAnswerRelatedLaw } from '@/lib/ai/consultation/schemas'

const EXAMPLE_QUESTIONS = [
  '대표이사 가지급금 인정이자는 어떻게 되나요?',
  '일용직 4대보험 기준이 뭐죠?',
  '세금계산서 지연발급 가산세가 어떻게 되나요?',
]

const GENERIC_ERROR = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.'
const RATE_LIMITED = '요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도하세요.'

type LawSearchMessage =
  | { kind: 'loading'; question: string }
  | {
      kind: 'answered'
      question: string
      practicalGuidance: string
      legalBasis: string
      missingInputs: string[]
      summary: string
      practicalNote: string
      relatedLaws: ConsultationAnswerRelatedLaw[]
    }
  | {
      kind: 'needs_expert'
      question: string
      practicalGuidance: string
      missingInputs: string[]
      summary: string
      practicalNote: string
    }
  | { kind: 'no_relevant_source'; question: string; summary: string }
  | { kind: 'notice'; question: string; message: string }

export function LawSearchChat() {
  const [messages, setMessages] = useState<LawSearchMessage[]>([])
  const [draft, setDraft] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const replaceLoading = (question: string, next: Exclude<LawSearchMessage, { kind: 'loading' }>) => {
    setMessages((prev) => [
      ...prev.filter((m) => !(m.kind === 'loading' && m.question === question)),
      next,
    ])
  }

  const ask = async (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    setMessages((prev) => [...prev, { kind: 'loading', question: trimmed }])

    try {
      const result = await postLawSearch({ question: trimmed })

      if (result.kind === 'rate_limited') {
        replaceLoading(trimmed, { kind: 'notice', question: trimmed, message: RATE_LIMITED })
        return
      }
      if (result.kind === 'error') {
        replaceLoading(trimmed, { kind: 'notice', question: trimmed, message: result.message })
        return
      }

      const { status, practicalGuidance, legalBasis, missingInputs, summary, practicalNote, relatedLaws } = result.data
      if (status === 'answered') {
        replaceLoading(trimmed, {
          kind: 'answered',
          question: trimmed,
          practicalGuidance,
          legalBasis,
          missingInputs,
          summary,
          practicalNote,
          relatedLaws,
        })
      } else if (status === 'needs_expert') {
        replaceLoading(trimmed, {
          kind: 'needs_expert',
          question: trimmed,
          practicalGuidance,
          missingInputs,
          summary,
          practicalNote,
        })
      } else {
        replaceLoading(trimmed, { kind: 'no_relevant_source', question: trimmed, summary })
      }
    } catch {
      replaceLoading(trimmed, { kind: 'notice', question: trimmed, message: GENERIC_ERROR })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const question = draft
    setDraft('')
    await ask(question)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={isSubmitting}
                onClick={() => void ask(q)}
                className="rounded-full border border-blue-200 bg-background px-3 py-1.5 text-left text-xs text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}

        {messages.map((message, index) => (
          <article
            key={`${message.kind}-${index}-${message.question}`}
            className={cn(
              'rounded-lg border px-4 py-3 text-sm leading-relaxed',
              message.kind === 'loading' || message.kind === 'notice'
                ? 'border-border bg-muted/30 text-muted-foreground'
                : 'border-border bg-background text-foreground',
            )}
          >
            <p className="mb-2 text-xs font-semibold text-foreground">{message.question}</p>

            {message.kind === 'loading' ? (
              <p className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                관련 법령을 찾고 있습니다.
              </p>
            ) : message.kind === 'notice' ? (
              <p>{message.message}</p>
            ) : message.kind === 'no_relevant_source' ? (
              <p>{message.summary}</p>
            ) : message.kind === 'needs_expert' ? (
              <>
                <p className="mb-2 inline-flex rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  전문가 확인 필요
                </p>
                <p>{message.summary}</p>

                {message.practicalGuidance ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-foreground">일반 실무 안내</p>
                    <p className="whitespace-pre-line text-muted-foreground">{message.practicalGuidance}</p>
                  </div>
                ) : null}

                {message.missingInputs.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-foreground">추가 확인 필요</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {message.missingInputs.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {message.practicalNote ? (
                  <p className="mt-3 text-muted-foreground">{message.practicalNote}</p>
                ) : null}
              </>
            ) : (
              <>
                <p className="whitespace-pre-line">{message.summary}</p>

                {message.practicalGuidance ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-foreground">일반 실무 안내</p>
                    <p className="whitespace-pre-line text-muted-foreground">{message.practicalGuidance}</p>
                  </div>
                ) : null}

                {message.legalBasis ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-foreground">법령 근거 / 세무상 주의</p>
                    <p className="whitespace-pre-line text-muted-foreground">{message.legalBasis}</p>
                  </div>
                ) : null}

                {message.relatedLaws.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-foreground">관련 법령</p>
                    <ul className="space-y-1">
                      {message.relatedLaws.map((law) => (
                        <li key={law.sourceId}>
                          <a
                            href={law.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                          >
                            {law.title}
                            <ExternalLink className="size-3" aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {message.missingInputs.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-foreground">추가 확인 필요</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {message.missingInputs.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {message.practicalNote ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-foreground">실무 주의</p>
                    <p className="text-muted-foreground">{message.practicalNote}</p>
                  </div>
                ) : null}

                <p className="mt-3 text-xs text-muted-foreground">{PER_ANSWER_CAUTION}</p>
              </>
            )}
          </article>
        ))}
      </div>

      <form className="border-t border-border pt-3" onSubmit={(event) => void handleSubmit(event)}>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={isSubmitting}
            placeholder="회계·세무·노무·법률 관련 법령을 검색하세요"
            aria-label="법령 검색 질문 입력"
            maxLength={500}
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSubmitting || draft.trim().length === 0}
            className={cn(buttonVariants({ size: 'default' }), 'shrink-0')}
          >
            {isSubmitting ? '검색 중' : '검색'}
          </button>
        </div>
      </form>
    </div>
  )
}
