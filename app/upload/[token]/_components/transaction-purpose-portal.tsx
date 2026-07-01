'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'

type PurposeRow = {
  id: string
  date: string | null
  counterparty: string | null
  amountKrw: number | null
  memo: string | null
  question: string
  status: 'pending' | 'answered'
  purposeCode: string | null
  purposeMemo: string | null
  answeredAt: string | null
}

type PurposePortalData = {
  request: {
    id: string
    status: 'sent' | 'partially_answered' | 'submitted'
    dueAt: string | null
    submittedAt: string | null
  }
  header: {
    tenantName: string
    clientName: string
    staffName: string
    accountingPeriod: string
  }
  rows: PurposeRow[]
}

type AnswerState = Record<string, { memo: string }>

interface TransactionPurposePortalProps {
  rawToken: string
  purposeRequestId: string
}

function formatAmount(amount: number | null): string {
  if (amount == null) return '-'
  return `${amount.toLocaleString('ko-KR')}원`
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return value.replaceAll('-', '.')
}

function formatDueAt(value: string | null): string | null {
  if (!value) return null
  const [date] = value.split('T')
  return date ? formatDate(date) : value
}

function buildAnswerState(rows: PurposeRow[]): AnswerState {
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        memo: row.purposeMemo ?? '',
      },
    ]),
  )
}

export function TransactionPurposePortal({ rawToken, purposeRequestId }: TransactionPurposePortalProps) {
  const [data, setData] = useState<PurposePortalData | null>(null)
  const [answers, setAnswers] = useState<AnswerState>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadError(null)
      try {
        const params = new URLSearchParams({ token: rawToken, purposeRequest: purposeRequestId })
        const res = await fetch(`/api/upload/purpose-request?${params.toString()}`, { cache: 'no-store' })
        const payload = await res.json().catch(() => null)

        if (cancelled) return
        if (!res.ok) {
          setLoadError(payload?.error ?? '거래 용도 확인 요청을 불러올 수 없습니다.')
          return
        }

        const nextData = payload as PurposePortalData
        setData(nextData)
        setAnswers(buildAnswerState(nextData.rows))
        setIsEditing(false)
      } catch {
        if (!cancelled) {
          setLoadError('거래 용도 확인 요청을 불러올 수 없습니다.')
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [rawToken, purposeRequestId])

  const isSubmitted = data?.request.status === 'submitted'
  const isReadOnlySubmitted = Boolean(isSubmitted && !isEditing)
  const allRowsAnswered = useMemo(() => {
    if (!data || data.rows.length === 0) return false
    return data.rows.every((row) => Boolean(answers[row.id]?.memo.trim()))
  }, [answers, data])

  function updateAnswer(rowId: string, patch: Partial<{ memo: string }>) {
    setAnswers((prev) => ({
      ...prev,
      [rowId]: {
        memo: prev[rowId]?.memo ?? '',
        ...patch,
      },
    }))
  }

  function cancelEdit() {
    if (!data) return
    setAnswers(buildAnswerState(data.rows))
    setSubmitError(null)
    setSubmitMessage(null)
    setIsEditing(false)
  }

  function submitAnswers() {
    if (!data) return
    if (!allRowsAnswered) {
      setSubmitError('모든 거래의 사용 용도 설명을 입력해 주세요.')
      return
    }

    setSubmitError(null)
    setSubmitMessage(null)
    setIsSubmitting(true)
    void (async () => {
      try {
        const res = await fetch('/api/upload/purpose-request/answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: rawToken,
            purposeRequest: purposeRequestId,
            submit: true,
            rows: data.rows.map((row) => ({
              rowId: row.id,
              memo: answers[row.id]?.memo,
            })),
          }),
        })
        const payload = await res.json().catch(() => null)

        if (!res.ok) {
          setSubmitError(payload?.error ?? '답변 제출에 실패했습니다.')
          return
        }

        setData((prev) =>
          prev
            ? {
                ...prev,
                request: { ...prev.request, status: payload.status },
                rows: prev.rows.map((row) => ({
                  ...row,
                  status: 'answered',
                  purposeMemo: answers[row.id]?.memo.trim() ?? row.purposeMemo,
                })),
              }
            : prev,
        )
        setIsEditing(false)
        setSubmitMessage('답변이 제출되었습니다. 담당자가 확인 후 최종 계정항목을 정리합니다.')
      } catch {
        setSubmitError('답변 제출에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      } finally {
        setIsSubmitting(false)
      }
    })()
  }

  if (loadError) {
    return (
      <Shell>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-gray-900">거래 용도 확인 요청을 열 수 없습니다</h1>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            {loadError}
            <br />
            필요한 경우 담당 회계사에게 문의해 주세요.
          </p>
        </div>
      </Shell>
    )
  }

  if (!data) {
    return (
      <Shell>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          거래 용도 확인 요청을 불러오고 있습니다.
        </div>
      </Shell>
    )
  }

  const dueAt = formatDueAt(data.request.dueAt)

  return (
    <Shell>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <p className="text-sm text-gray-500">
            {data.header.tenantName} · 담당: {data.header.staffName}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-950">거래 용도 확인</h1>
          <p className="mt-2 text-sm text-gray-500">
            {data.header.clientName} · {data.header.accountingPeriod}
            {dueAt ? ` · 답변 기한: ${dueAt}` : ''}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm leading-6 text-blue-900">
          아래 거래가 어떤 업무 목적으로 사용되었는지 설명해 주세요. 계정항목은 담당자가 최종 확인합니다.
        </div>

        {isReadOnlySubmitted || submitMessage ? (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-800">
            {submitMessage ?? '답변이 제출되었습니다. 담당자가 확인 후 최종 계정항목을 정리합니다.'}
          </div>
        ) : null}

        {isSubmitted && isEditing ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
            답변 수정 중입니다. 수정한 내용을 다시 제출하면 담당자가 최신 답변을 확인합니다.
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {data.rows.map((row, index) => {
            const answer = answers[row.id] ?? { memo: '' }
            return (
              <section key={row.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400">거래 {index + 1}</p>
                    <h2 className="mt-1 text-base font-semibold text-gray-950">
                      {row.counterparty ?? row.memo ?? '거래처 정보 없음'}
                    </h2>
                  </div>
                  <p className="shrink-0 text-base font-bold text-gray-950">{formatAmount(row.amountKrw)}</p>
                </div>

                <dl className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-gray-400">거래일</dt>
                    <dd className="mt-1">{formatDate(row.date)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400">메모</dt>
                    <dd className="mt-1">{row.memo ?? '-'}</dd>
                  </div>
                </dl>

                <label className="mt-5 block text-sm font-medium text-gray-900" htmlFor={`memo-${row.id}`}>
                  사용 용도 설명
                </label>
                {isReadOnlySubmitted ? (
                  <div className="mt-2 min-h-[76px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-800">
                    {answer.memo || '제출된 설명이 없습니다.'}
                  </div>
                ) : (
                  <textarea
                    id={`memo-${row.id}`}
                    value={answer.memo}
                    disabled={isSubmitting}
                    onChange={(event) => updateAnswer(row.id, { memo: event.target.value })}
                    rows={3}
                    maxLength={1000}
                    placeholder="예: 직원 점심 식대, 거래처 미팅 비용, 대표 개인 사용 등"
                    className="mt-2 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                )}
              </section>
            )
          })}
        </div>

        {submitError ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        ) : null}

        {isReadOnlySubmitted ? (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSubmitError(null)
                setSubmitMessage(null)
                setIsEditing(true)
              }}
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
            >
              답변 수정
            </button>
          </div>
        ) : (
          <div className="mt-6 flex justify-end gap-2">
            {isSubmitted ? (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isSubmitting}
                className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              >
                취소
              </button>
            ) : null}
            <button
              type="button"
              onClick={submitAnswers}
              disabled={isSubmitting || !allRowsAnswered}
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSubmitting ? '제출 중' : isSubmitted ? '수정 내용 제출' : '제출 완료'}
            </button>
          </div>
        )}
      </main>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-gray-50 text-gray-950">{children}</div>
}
