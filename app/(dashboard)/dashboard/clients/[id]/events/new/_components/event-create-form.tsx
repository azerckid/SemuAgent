'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const PERIOD_PLACEHOLDER = '예: 2026-05'
const PERIOD_HINT = '캘린더 표시와 AI 기간 비교에 사용하는 내부 값입니다. 비워두면 제출 기한 기준으로 자동 설정됩니다.'

interface Props {
  clientId: string
  clientName: string
  initialPeriod: string
  staffPhone: string
  ccGroups: Array<{
    id: string
    name: string
    emails: string
    isDefault: boolean
  }>
  internalCcGroups: Array<{
    id: string
    name: string
    emails: string
    isDefault: boolean
  }>
}

function appendCcEmails(existing: string, addition: string) {
  const seen = new Set<string>()
  return `${existing}\n${addition}`
    .split(/[,;\n]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => {
      if (!email || seen.has(email)) return false
      seen.add(email)
      return true
    })
    .join(', ')
}

function formatRequestEventError(data: { error?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } }) {
  const fieldErrors = data.details?.fieldErrors
  const firstFieldError = fieldErrors
    ? Object.entries(fieldErrors).find(([, messages]) => messages.length > 0)
    : null
  if (firstFieldError) {
    const [field, messages] = firstFieldError
    return `${data.error ?? '입력값 오류'}: ${field} - ${messages[0]}`
  }
  const firstFormError = data.details?.formErrors?.[0]
  return firstFormError ? `${data.error ?? '입력값 오류'}: ${firstFormError}` : data.error
}

export function EventCreateForm({
  clientId,
  clientName,
  initialPeriod,
  staffPhone,
  ccGroups,
  internalCcGroups,
}: Props) {
  const router = useRouter()
  const defaultCcGroup = ccGroups.find((group) => group.isDefault) ?? ccGroups[0] ?? null
  const [selectedCcGroupId, setSelectedCcGroupId] = useState(defaultCcGroup?.id ?? '')
  const [selectedInternalCcGroupId, setSelectedInternalCcGroupId] = useState('')
  const [form, setForm] = useState({
    accountingPeriod: initialPeriod,
    title: '',
    dueAt: '',
    emailSubjectSnapshot: '',
    emailBodySnapshot: '',
    emailGreetingSnapshot: '',
    senderPhoneSnapshot: '',
    ccEmailSnapshot: defaultCcGroup?.emails ?? '',
    analysisCriteriaSnapshot: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [criteriaError, setCriteriaError] = useState('')

  const getInternalPeriod = () => form.accountingPeriod.trim() || form.dueAt.slice(0, 7) || initialPeriod.trim()
  const internalPeriod = getInternalPeriod()
  const defaultGreeting = `안녕하세요, ${clientName} 담당자님.`
  const defaultSubject = internalPeriod
    ? `[${clientName}] ${internalPeriod} 자료 제출 요청`
    : `[${clientName}] 자료 제출 요청`

  const handleExtractCriteria = async () => {
    setCriteriaError('')
    if (!form.emailBodySnapshot.trim()) {
      setCriteriaError('메일 본문을 먼저 입력해 주세요.')
      return
    }
    setExtracting(true)
    try {
      const res = await fetch('/api/sessions/extract-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestEmailSubject: form.emailSubjectSnapshot,
          requestEmailBody: form.emailBodySnapshot,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCriteriaError(data.error ?? '기준 정리에 실패했습니다.')
        return
      }
      setForm({ ...form, analysisCriteriaSnapshot: data.criteria ?? '' })
    } catch {
      setCriteriaError('네트워크 오류가 발생했습니다.')
    } finally {
      setExtracting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const dueAtISO = form.dueAt ? `${form.dueAt}T23:59:59+09:00` : ''
      const accountingPeriod = getInternalPeriod()

      const res = await fetch('/api/request-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          accountingPeriod,
          frequency: 'custom',
          title: form.title || `${accountingPeriod || '비정기'} 자료 요청`,
          dueAt: dueAtISO,
          emailSubjectSnapshot: form.emailSubjectSnapshot || undefined,
          emailBodySnapshot: form.emailBodySnapshot || undefined,
          emailGreetingSnapshot: form.emailGreetingSnapshot || undefined,
          senderPhoneSnapshot: form.senderPhoneSnapshot || undefined,
          ccEmailSnapshot: form.ccEmailSnapshot || undefined,
          analysisCriteriaSnapshot: form.analysisCriteriaSnapshot || undefined,
        }),
      })

      let data: { error?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } } = {}
      try { data = await res.json() } catch { /* non-JSON 무시 */ }

      if (!res.ok) {
        const message = formatRequestEventError(data) ?? '요청 일정 저장에 실패했습니다'
        setError(message)
        toast.error(message)
        return
      }

      router.push(`/dashboard/clients/${clientId}?toast=saved`)
      router.refresh()
    } catch {
      const message = '네트워크 오류가 발생했습니다. 다시 시도해 주세요.'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      {/* 제출 기한 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">자료 제출 기한</label>
        <input
          type="date"
          required
          value={form.dueAt}
          onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 고급 설정 */}
      <details className="rounded-lg border border-gray-200 bg-white">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700">
          고급 설정
        </summary>
        <div className="space-y-4 border-t border-gray-100 px-4 py-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              내부 분류 기간 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={form.accountingPeriod}
              onChange={(e) => setForm({ ...form, accountingPeriod: e.target.value })}
              placeholder={PERIOD_PLACEHOLDER}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">{PERIOD_HINT}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              캘린더 표시 제목 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={`${internalPeriod || '비정기'} 자료 요청`}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">고객사 캘린더에 표시되는 내부 제목입니다. 비워두면 자동 생성됩니다.</p>
          </div>
        </div>
      </details>

      {/* 메일 초안 */}
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">메일 초안</h2>
          <p className="text-xs text-gray-500 mt-0.5">발송 전 단계에서 수정할 수 있습니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">메일 제목</label>
          <input
            type="text"
            maxLength={200}
            value={form.emailSubjectSnapshot}
            onChange={(e) => setForm({ ...form, emailSubjectSnapshot: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && form.emailSubjectSnapshot.trim() === '') {
                e.preventDefault()
                setForm({ ...form, emailSubjectSnapshot: defaultSubject })
              }
            }}
            placeholder={defaultSubject}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">Tab 키로 제안 제목을 입력할 수 있습니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            인삿말 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <textarea
            maxLength={1000}
            rows={2}
            value={form.emailGreetingSnapshot}
            onChange={(e) => setForm({ ...form, emailGreetingSnapshot: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && form.emailGreetingSnapshot.trim() === '') {
                e.preventDefault()
                setForm({ ...form, emailGreetingSnapshot: defaultGreeting })
              }
            }}
            placeholder={defaultGreeting}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <p className="mt-1 text-xs text-gray-400">비워두면 고객사 이름 기준으로 자동 작성됩니다. Tab 키로 제안 문구를 입력할 수 있습니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">메일 본문</label>
          <textarea
            rows={8}
            maxLength={10000}
            value={form.emailBodySnapshot}
            onChange={(e) => setForm({ ...form, emailBodySnapshot: e.target.value })}
            placeholder="자료 요청 내용을 입력하세요."
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <p className="mt-1 text-xs text-gray-400">{form.emailBodySnapshot.length} / 10000</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            회계담당자 전화번호 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <input
            type="text"
            maxLength={100}
            value={form.senderPhoneSnapshot}
            onChange={(e) => setForm({ ...form, senderPhoneSnapshot: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !form.senderPhoneSnapshot.trim() && staffPhone) {
                e.preventDefault()
                setForm({ ...form, senderPhoneSnapshot: staffPhone })
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
          {ccGroups.length > 0 && (
            <select
              value={selectedCcGroupId}
              onChange={(e) => {
                const group = ccGroups.find((g) => g.id === e.target.value)
                setSelectedCcGroupId(e.target.value)
                setSelectedInternalCcGroupId('')
                setForm((prev) => ({ ...prev, ccEmailSnapshot: group?.emails ?? '' }))
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">그룹 선택 안 함</option>
              {ccGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}{group.isDefault ? ' · 기본' : ''}
                </option>
              ))}
            </select>
          )}
          {internalCcGroups.length > 0 && (
            <select
              value={selectedInternalCcGroupId}
              onChange={(e) => {
                const group = internalCcGroups.find((g) => g.id === e.target.value)
                setSelectedInternalCcGroupId(e.target.value)
                if (group) {
                  setForm((prev) => ({
                    ...prev,
                    ccEmailSnapshot: appendCcEmails(prev.ccEmailSnapshot, group.emails),
                  }))
                }
              }}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">내부 참조 그룹 추가 안 함</option>
              {internalCcGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}{group.isDefault ? ' · 기본' : ''}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            maxLength={1000}
            value={form.ccEmailSnapshot}
            onChange={(e) => {
              setSelectedCcGroupId('')
              setSelectedInternalCcGroupId('')
              setForm({ ...form, ccEmailSnapshot: e.target.value })
            }}
            placeholder="예: manager@example.com, tax@example.com"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">고객사 CC는 선택 시 입력값을 채우고, 내부 CC는 기존 참조 이메일에 추가됩니다.</p>
        </div>
      </section>

      {/* AI 검토 기준 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">AI 검토 기준</h2>
          <p className="text-xs text-gray-500 mt-0.5">클라이언트에게는 보이지 않습니다. 제출 자료 AI 검토 시 사용됩니다.</p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-1">
            <label className="block text-sm font-medium text-gray-700">본문에서 추출한 AI 판단 기준</label>
            <button
              type="button"
              onClick={handleExtractCriteria}
              disabled={extracting || !form.emailBodySnapshot.trim()}
              className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {extracting ? '정리 중...' : '본문 기준 정리'}
            </button>
          </div>
          <textarea
            value={form.analysisCriteriaSnapshot}
            onChange={(e) => setForm({ ...form, analysisCriteriaSnapshot: e.target.value })}
            maxLength={10000}
            rows={6}
            placeholder="메일 본문 작성 후 '본문 기준 정리'를 누르면 AI가 기준 초안을 정리합니다."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          {criteriaError && <p className="mt-1 text-xs text-red-600">{criteriaError}</p>}
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '일정 저장'}
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
