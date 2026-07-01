'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { resolveBookkeepingPeriodRange, type BookkeepingPeriodType } from '@/lib/bookkeeping/period-range'

interface ClientOption { id: string; name: string; contactName: string | null; email: string }

interface Props {
  clients: ClientOption[]
  initialClientId?: string
  staffPhone?: string
}

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: '월별 (정기)' },
  { value: 'quarterly', label: '분기별 (정기)' },
  { value: 'semiannual', label: '반기별 (정기)' },
  { value: 'annual', label: '연간 (정기)' },
  { value: 'custom', label: '비정기' },
]

const PERIOD_PLACEHOLDER: Record<string, string> = {
  monthly: '2026-05',
  quarterly: '2026-Q2',
  semiannual: '2026-H1',
  annual: '2026',
  custom: '2026-05-15',
}

const PERIOD_HINT: Record<string, string> = {
  monthly: '형식: 2026-05',
  quarterly: '형식: 2026-Q2 (1~4분기)',
  semiannual: '형식: 2026-H1 또는 2026-H2',
  annual: '형식: 2026',
  custom: '형식: 2026-05 또는 2026-05-15',
}

const BOOKKEEPING_PERIOD_TYPE_BY_FREQUENCY: Record<string, BookkeepingPeriodType | null> = {
  monthly: 'monthly',
  quarterly: 'quarterly',
  annual: 'yearly',
  semiannual: null,
  custom: null,
}

const BOOKKEEPING_PERIOD_TYPE_LABEL: Record<BookkeepingPeriodType, string> = {
  monthly: '월별',
  quarterly: '분기별',
  yearly: '연간',
}

export function SessionCreateForm({ clients, initialClientId = '', staffPhone = '' }: Props) {
  const router = useRouter()
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(
    clients.some((c) => c.id === initialClientId) ? [initialClientId] : [],
  )
  const [form, setForm] = useState({
    frequency: 'monthly',
    accountingPeriod: '',
    closingDate: '',
    requestEmailSubject: '',
    requestEmailGreeting: '',
    requestEmailBody: '',
    senderPhone: '',
    requestEmailCc: '',
    analysisCriteriaSnapshot: '',
  })
  const [error, setError] = useState('')
  const [criteriaError, setCriteriaError] = useState('')
  const [extractingCriteria, setExtractingCriteria] = useState(false)
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<{ clientName: string; ok: boolean; error?: string }[]>([])
  const bookkeepingPeriodType = BOOKKEEPING_PERIOD_TYPE_BY_FREQUENCY[form.frequency]
  const bookkeepingPeriodRange = bookkeepingPeriodType
    ? resolveBookkeepingPeriodRange({
      accountingPeriod: form.accountingPeriod,
      periodType: bookkeepingPeriodType,
    })
    : null

  const toggleClient = (id: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  const selectAll = () => setSelectedClientIds(clients.map((c) => c.id))
  const clearAll = () => setSelectedClientIds([])

  const handleExtractCriteria = async () => {
    setCriteriaError('')
    if (!form.requestEmailBody.trim()) {
      setCriteriaError('요청 메일 본문을 먼저 입력해 주세요.')
      return
    }
    setExtractingCriteria(true)
    const res = await fetch('/api/sessions/extract-criteria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestEmailSubject: form.requestEmailSubject,
        requestEmailBody: form.requestEmailBody,
      }),
    })
    const data = await res.json()
    setExtractingCriteria(false)
    if (!res.ok) {
      setCriteriaError(data.error ?? '본문 기준 정리에 실패했습니다.')
      return
    }
    setForm({ ...form, analysisCriteriaSnapshot: data.criteria ?? '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedClientIds.length === 0) {
      setError('고객사를 1개 이상 선택해 주세요.')
      return
    }
    setSaving(true)
    setError('')
    setResults([])

    const dueAtISO = `${form.closingDate}T23:59:59+09:00`

    const outcomes: typeof results = []
    for (const clientId of selectedClientIds) {
      const clientRecord = clients.find((c) => c.id === clientId)
      const clientName = clientRecord?.name ?? clientId
      try {
        // 이벤트 생성
        const createRes = await fetch('/api/request-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            accountingPeriod: form.accountingPeriod,
            frequency: form.frequency,
            title: form.requestEmailSubject || `${form.accountingPeriod} 자료 요청`,
            dueAt: dueAtISO,
            emailSubjectSnapshot: form.requestEmailSubject || undefined,
            emailBodySnapshot: form.requestEmailBody || undefined,
            emailGreetingSnapshot: form.requestEmailGreeting || undefined,
            senderPhoneSnapshot: form.senderPhone || undefined,
            ccEmailSnapshot: form.requestEmailCc || undefined,
            analysisCriteriaSnapshot: form.analysisCriteriaSnapshot || undefined,
          }),
        })
        if (!createRes.ok) {
          const d = await createRes.json().catch(() => ({}))
          outcomes.push({ clientName, ok: false, error: d.error ?? '이벤트 생성 실패' })
          continue
        }
        const { id: eventId } = await createRes.json()

        // 즉시 발송
        const sendRes = await fetch(`/api/request-events/${eventId}/send`, { method: 'POST' })
        if (!sendRes.ok) {
          const d = await sendRes.json().catch(() => ({}))
          outcomes.push({ clientName, ok: false, error: d.error ?? '발송 실패' })
          continue
        }
        outcomes.push({ clientName, ok: true })
      } catch (err) {
        outcomes.push({ clientName, ok: false, error: err instanceof Error ? err.message : '오류 발생' })
      }
    }

    setSaving(false)
    setResults(outcomes)

    const allOk = outcomes.every((o) => o.ok)
    if (allOk) {
      setTimeout(() => router.push('/dashboard/clients'), 1500)
    }
  }

  if (results.length > 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">발송 결과</h2>
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.clientName} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${r.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <span>{r.ok ? '✓' : '✗'}</span>
              <span className="font-medium">{r.clientName}</span>
              {r.error && <span className="text-xs">{r.error}</span>}
            </li>
          ))}
        </ul>
        {results.every((r) => r.ok) && (
          <p className="text-sm text-gray-500">모두 발송됐습니다. 대시보드로 이동합니다...</p>
        )}
        {results.some((r) => !r.ok) && (
          <button onClick={() => setResults([])} className="text-sm text-blue-600 hover:underline">
            다시 시도
          </button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">

      {/* 고객사 선택 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">고객사 선택</label>
          <div className="flex gap-2 text-xs text-blue-600">
            <button type="button" onClick={selectAll} className="hover:underline">전체 선택</button>
            <span className="text-gray-300">|</span>
            <button type="button" onClick={clearAll} className="hover:underline">전체 해제</button>
          </div>
        </div>
        {clients.length === 0 ? (
          <p className="text-xs text-yellow-600">먼저 고객사를 추가해 주세요.</p>
        ) : (
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
            {clients.map((c) => (
              <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedClientIds.includes(c.id)}
                  onChange={() => toggleClient(c.id)}
                  className="rounded border-gray-300"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate">{c.contactName ?? ''} {c.email}</p>
                </div>
              </label>
            ))}
          </div>
        )}
        {selectedClientIds.length > 0 && (
          <p className="mt-1.5 text-xs text-blue-600">{selectedClientIds.length}개 고객사 선택됨</p>
        )}
      </div>

      {/* 요청 주기 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">요청 주기</label>
        <select
          value={form.frequency}
          onChange={(e) => setForm({ ...form, frequency: e.target.value, accountingPeriod: '' })}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {FREQUENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* 회계 기간 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">회계 기간</label>
        <input
          type="text"
          required
          value={form.accountingPeriod}
          onChange={(e) => setForm({ ...form, accountingPeriod: e.target.value })}
          placeholder={PERIOD_PLACEHOLDER[form.frequency]}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400">{PERIOD_HINT[form.frequency]}</p>
        {bookkeepingPeriodType && (
          <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <span className="font-medium">기장 대상 기간</span>
            <span className="ml-2">
              {bookkeepingPeriodRange
                ? `${BOOKKEEPING_PERIOD_TYPE_LABEL[bookkeepingPeriodRange.type]} · ${bookkeepingPeriodRange.start}~${bookkeepingPeriodRange.end}`
                : `${BOOKKEEPING_PERIOD_TYPE_LABEL[bookkeepingPeriodType]} · 기간을 입력하면 반영 범위가 표시됩니다.`}
            </span>
          </div>
        )}
      </div>

      {/* 자료 제출 기한 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">자료 제출 기한</label>
        <input
          type="date"
          required
          value={form.closingDate}
          onChange={(e) => setForm({ ...form, closingDate: e.target.value })}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 메일 작성 */}
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">요청 메일 작성</h2>
          <p className="text-xs text-gray-500 mt-0.5">클라이언트에게 실제 발송할 내용입니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">요청 제목</label>
          <input
            type="text"
            required
            maxLength={200}
            value={form.requestEmailSubject}
            onChange={(e) => setForm({ ...form, requestEmailSubject: e.target.value })}
            placeholder="예: 2026년 5월 기장 자료 제출 요청"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            인삿말 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <textarea
            maxLength={1000}
            rows={2}
            value={form.requestEmailGreeting}
            onChange={(e) => setForm({ ...form, requestEmailGreeting: e.target.value })}
            placeholder="안녕하세요, 담당자님."
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <p className="mt-1 text-xs text-gray-400">비워두면 고객사 이름 기준으로 자동 작성됩니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">요청 메일 본문</label>
          <textarea
            required
            maxLength={10000}
            rows={10}
            value={form.requestEmailBody}
            onChange={(e) => setForm({ ...form, requestEmailBody: e.target.value })}
            placeholder="예: 5월 기장 자료를 아래 기한까지 제출해 주세요..."
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <p className="mt-1 text-xs text-gray-400">{form.requestEmailBody.length} / 10000</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            회계담당자 전화번호 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <input
            type="text"
            maxLength={100}
            value={form.senderPhone}
            onChange={(e) => setForm({ ...form, senderPhone: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !form.senderPhone.trim() && staffPhone) {
                e.preventDefault()
                setForm({ ...form, senderPhone: staffPhone })
              }
            }}
            placeholder={staffPhone || '예: 02-1234-5678'}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            {staffPhone ? 'Tab 키로 설정된 전화번호를 채울 수 있습니다.' : '발송자 이름과 이메일은 로그인한 담당자 정보로 자동 구성됩니다.'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            참조 이메일 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <input
            type="text"
            maxLength={1000}
            value={form.requestEmailCc}
            onChange={(e) => setForm({ ...form, requestEmailCc: e.target.value })}
            placeholder="예: manager@example.com, tax@example.com"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">여러 명은 쉼표로 구분합니다. 고객에게 보내는 요청 메일에 참조됩니다.</p>
        </div>
      </section>

      {/* AI 검토 기준 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">AI 검토 기준</h2>
          <p className="text-xs text-gray-500 mt-0.5">클라이언트에게는 보이지 않습니다.</p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-1">
            <label className="block text-sm font-medium text-gray-700">본문에서 추출한 AI 판단 기준</label>
            <button
              type="button"
              onClick={handleExtractCriteria}
              disabled={extractingCriteria || !form.requestEmailBody.trim()}
              className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {extractingCriteria ? '정리 중...' : '본문 기준 정리'}
            </button>
          </div>
          <textarea
            value={form.analysisCriteriaSnapshot}
            onChange={(e) => setForm({ ...form, analysisCriteriaSnapshot: e.target.value })}
            maxLength={10000}
            rows={7}
            placeholder="메일 본문 작성 후 '본문 기준 정리'를 누르면 AI가 기준 초안을 정리합니다."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          {criteriaError && <p className="mt-1 text-xs text-red-600">{criteriaError}</p>}
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || clients.length === 0}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving
            ? `발송 중... (${selectedClientIds.length}개)`
            : `요청 메일 발송 (${selectedClientIds.length}개 고객사)`}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          취소
        </button>
      </div>
    </form>
  )
}
