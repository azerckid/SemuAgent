'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const FREQ_OPTIONS = [
  { value: 'monthly', label: '월별' },
  { value: 'quarterly', label: '분기별' },
  { value: 'semiannual', label: '반기별' },
  { value: 'annual', label: '연간' },
]

interface RequestTemplate {
  id: string
  name: string
  frequency: string
  emailSubjectTemplate: string | null
  emailBodyTemplate: string | null
  analysisCriteriaTemplate: string | null
  sendRule: string | null
  dueRule: string | null
}

interface Props {
  clientId: string
  clientName: string
  staffPhone: string
  templates: RequestTemplate[]
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

export function ScheduleCreateForm({
  clientId,
  clientName,
  staffPhone,
  templates,
  ccGroups,
  internalCcGroups,
}: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const defaultCcGroup = ccGroups.find((group) => group.isDefault) ?? ccGroups[0] ?? null
  const [selectedCcGroupId, setSelectedCcGroupId] = useState(defaultCcGroup?.id ?? '')
  const [selectedInternalCcGroupId, setSelectedInternalCcGroupId] = useState('')

  const defaultGreeting = `안녕하세요, ${clientName} 담당자님.`
  const defaultSubject = `[${clientName}] 자료 제출 요청`

  const parseSendRuleToForm = (raw: string | null) => {
    if (!raw) return {}
    try {
      const r = JSON.parse(raw)
      if (r.type === 'day_of_month') return { sendType: 'day_of_month', sendDayOfMonth: String(r.dayOfMonth) }
      if (r.type === 'days_before_period_end') return { sendType: 'days_before_period_end', sendDaysBefore: String(r.daysBefore) }
    } catch { /* ignore */ }
    return {}
  }

  const parseDueRuleToForm = (raw: string | null) => {
    if (!raw) return {}
    try {
      const r = JSON.parse(raw)
      if (r.type === 'day_of_month') return { dueType: 'day_of_month', dueDayOfMonth: String(r.dayOfMonth) }
      if (r.type === 'days_after_period_end') return { dueType: 'days_after_period_end', dueDaysAfter: String(r.daysAfterPeriodEnd) }
    } catch { /* ignore */ }
    return {}
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (!templateId) return
    const tmpl = templates.find((t) => t.id === templateId)
    if (!tmpl) return

    const isNonMonthly = tmpl.frequency !== 'monthly'
    setForm((prev) => ({
      ...prev,
      frequency: tmpl.frequency,
      ...(isNonMonthly
        ? { sendType: 'days_before_period_end', dueType: 'days_after_period_end' }
        : { sendType: 'day_of_month', dueType: 'day_of_month' }),
      ...parseSendRuleToForm(tmpl.sendRule),
      ...parseDueRuleToForm(tmpl.dueRule),
      emailSubject: tmpl.emailSubjectTemplate ?? prev.emailSubject,
      emailBody: tmpl.emailBodyTemplate ?? prev.emailBody,
      analysisCriteria: tmpl.analysisCriteriaTemplate ?? prev.analysisCriteria,
    }))
  }

  const [form, setForm] = useState({
    frequency: 'monthly',
    // 발송 날짜 규칙
    sendType: 'day_of_month',
    sendDayOfMonth: '10',
    sendDaysBefore: '20',
    // 제출 기한 규칙
    dueType: 'day_of_month',
    dueDayOfMonth: '25',
    dueDaysAfter: '15',
    // 반복 적용 기간
    startsOn: '',
    endsOn: '',
    // 요청 메일 내용
    emailSubject: '',
    emailGreeting: '',
    emailBody: '',
    senderPhone: '',
    ccEmail: defaultCcGroup?.emails ?? '',
    // AI 판단 기준
    analysisCriteria: '',
  })

  const isMonthly = form.frequency === 'monthly'

  const buildSendRule = () => {
    if (form.sendType === 'day_of_month') {
      return { type: 'day_of_month', dayOfMonth: Number(form.sendDayOfMonth) }
    }
    return { type: 'days_before_period_end', daysBefore: Number(form.sendDaysBefore) }
  }

  const buildDueRule = () => {
    if (form.dueType === 'day_of_month') {
      return { type: 'day_of_month', dayOfMonth: Number(form.dueDayOfMonth) }
    }
    return { type: 'days_after_period_end', daysAfterPeriodEnd: Number(form.dueDaysAfter) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await fetch('/api/request-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          requestTemplateId: selectedTemplateId || undefined,
          frequency: form.frequency,
          startsOn: form.startsOn,
          endsOn: form.endsOn || undefined,
          generationPolicy: 'auto_generate_draft',
          sendPolicy: 'approval_required',
          sendRule: buildSendRule(),
          dueRule: buildDueRule(),
          emailSubjectTemplate: form.emailSubject,
          emailBodyTemplate: form.emailBody,
          emailGreetingTemplate: form.emailGreeting || undefined,
          senderPhoneTemplate: form.senderPhone || undefined,
          ccEmailTemplate: form.ccEmail || undefined,
          analysisCriteriaTemplate: form.analysisCriteria || undefined,
        }),
      })

      let data: { error?: string } = {}
      try { data = await res.json() } catch { /* non-JSON 무시 */ }

      if (!res.ok) {
        const message = data.error ?? '정기 요청 저장에 실패했습니다'
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
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">

      {/* 요청 템플릿 선택 */}
      {templates.length > 0 && (
        <section className="rounded-lg border border-blue-100 bg-blue-50/40 p-4 space-y-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">요청 템플릿 선택 <span className="font-normal text-gray-400">(선택사항)</span></label>
            <p className="text-xs text-gray-500 mt-0.5">선택하면 본문, AI 기준, 주기, 규칙이 자동으로 채워집니다. 수정 가능합니다.</p>
          </div>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">템플릿 없이 직접 작성</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {selectedTemplateId && (
            <p className="text-xs text-blue-600">템플릿 내용이 아래 폼에 채워졌습니다. 수정 후 저장하면 원본 템플릿은 바뀌지 않습니다.</p>
          )}
        </section>
      )}

      {/* 반복 규칙 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">반복 규칙</h2>
          <p className="text-xs text-gray-500 mt-0.5">정해진 날짜마다 발송 전 초안이 자동 생성됩니다.</p>
        </div>

        {/* 주기 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">요청 주기</label>
          <select
            value={form.frequency}
            onChange={(e) => {
              const isNonMonthly = e.target.value !== 'monthly'
              setForm((prev) => ({
                ...prev,
                frequency: e.target.value,
                sendType: isNonMonthly ? 'days_before_period_end' : 'day_of_month',
                dueType: isNonMonthly ? 'days_after_period_end' : 'day_of_month',
              }))
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* 초안 생성일 규칙 */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">초안 생성일 규칙</p>
          <p className="text-xs text-gray-500">이 날짜가 되면 담당자 검토용 초안이 자동 생성됩니다.</p>
          {isMonthly ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">매월</span>
              <input
                type="number" min={1} max={28}
                value={form.sendDayOfMonth}
                onChange={(e) => setForm((prev) => ({ ...prev, sendDayOfMonth: e.target.value, sendType: 'day_of_month' }))}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">일</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">기간 종료</span>
              <input
                type="number" min={1} max={90}
                value={form.sendDaysBefore}
                onChange={(e) => setForm((prev) => ({ ...prev, sendDaysBefore: e.target.value, sendType: 'days_before_period_end' }))}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">일 전</span>
            </div>
          )}
        </div>

        {/* 제출 기한 규칙 */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">제출 기한 규칙</p>
          {isMonthly ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">해당 월</span>
              <input
                type="number" min={1} max={28}
                value={form.dueDayOfMonth}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDayOfMonth: e.target.value, dueType: 'day_of_month' }))}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">일</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">기간 종료 후</span>
              <input
                type="number" min={1} max={90}
                value={form.dueDaysAfter}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDaysAfter: e.target.value, dueType: 'days_after_period_end' }))}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">일</span>
            </div>
          )}
        </div>

        {/* 반복 적용 기간 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">반복 적용 시작일</label>
            <p className="text-xs text-gray-400 mt-0.5">이 날 이후부터 초안이 생성됩니다.</p>
            <input
              type="date"
              required
              value={form.startsOn}
              onChange={(e) => setForm((prev) => ({ ...prev, startsOn: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">반복 적용 종료일 <span className="font-normal text-gray-400">(선택)</span></label>
            <p className="text-xs text-gray-400 mt-0.5">비워두면 계속 반복됩니다.</p>
            <input
              type="date"
              value={form.endsOn}
              onChange={(e) => setForm((prev) => ({ ...prev, endsOn: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* 반복 요청 메일 내용 */}
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">반복 요청 메일 내용</h2>
          <p className="text-xs text-gray-500 mt-0.5">정해진 날짜마다 생성될 초안의 제목과 본문입니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">메일 제목</label>
          <input
            type="text"
            required
            maxLength={200}
            value={form.emailSubject}
            onChange={(e) => setForm((prev) => ({ ...prev, emailSubject: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && form.emailSubject.trim() === '') {
                e.preventDefault()
                setForm((prev) => ({ ...prev, emailSubject: defaultSubject }))
              }
            }}
            placeholder={defaultSubject}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">Tab 키로 제안 제목을 입력할 수 있습니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            인삿말 <span className="font-normal text-gray-400">(선택)</span>
          </label>
          <textarea
            maxLength={1000}
            rows={2}
            value={form.emailGreeting}
            onChange={(e) => setForm((prev) => ({ ...prev, emailGreeting: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && form.emailGreeting.trim() === '') {
                e.preventDefault()
                setForm((prev) => ({ ...prev, emailGreeting: defaultGreeting }))
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
            required
            rows={8}
            maxLength={10000}
            value={form.emailBody}
            onChange={(e) => setForm((prev) => ({ ...prev, emailBody: e.target.value }))}
            placeholder="매번 반복 발송할 자료 요청 안내문을 작성하세요."
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <p className="mt-1 text-xs text-gray-400">{form.emailBody.length} / 10000</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            회계담당자 전화번호 <span className="font-normal text-gray-400">(선택)</span>
          </label>
          <input
            type="text"
            maxLength={100}
            value={form.senderPhone}
            onChange={(e) => setForm((prev) => ({ ...prev, senderPhone: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !form.senderPhone.trim() && staffPhone) {
                e.preventDefault()
                setForm((prev) => ({ ...prev, senderPhone: staffPhone }))
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
            참조 이메일 <span className="font-normal text-gray-400">(선택)</span>
          </label>
          {ccGroups.length > 0 && (
            <select
              value={selectedCcGroupId}
              onChange={(e) => {
                const group = ccGroups.find((g) => g.id === e.target.value)
                setSelectedCcGroupId(e.target.value)
                setSelectedInternalCcGroupId('')
                setForm((prev) => ({ ...prev, ccEmail: group?.emails ?? '' }))
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
                  setForm((prev) => ({ ...prev, ccEmail: appendCcEmails(prev.ccEmail, group.emails) }))
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
            value={form.ccEmail}
            onChange={(e) => {
              setSelectedCcGroupId('')
              setSelectedInternalCcGroupId('')
              setForm((prev) => ({ ...prev, ccEmail: e.target.value }))
            }}
            placeholder="예: manager@example.com, tax@example.com"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">고객사 CC는 선택 시 입력값을 채우고, 내부 CC는 기존 참조 이메일에 추가됩니다.</p>
        </div>
      </section>

      {/* AI 판단 기준 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">AI 판단 기준</h2>
          <p className="text-xs text-gray-500 mt-0.5">클라이언트에게는 보이지 않습니다. 제출 자료 AI 검토 시 사용됩니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">AI 판단 기준</label>
          <textarea
            value={form.analysisCriteria}
            onChange={(e) => setForm((prev) => ({ ...prev, analysisCriteria: e.target.value }))}
            maxLength={10000}
            rows={6}
            placeholder="제출 자료 AI 검토에 사용할 기준을 작성합니다."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '정기 요청 저장'}
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
