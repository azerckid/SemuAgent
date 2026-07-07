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

interface ChecklistTemplate {
  id: string
  name: string
}

interface Props {
  clientId: string
  clientName: string
  checklistTemplates: ChecklistTemplate[]
}

export function TemplateCreateForm({ clientId, clientName, checklistTemplates }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const defaultSubject = `[${clientName}] 자료 제출 요청`

  const [form, setForm] = useState({
    name: '',
    frequency: 'monthly',
    emailSubject: '',
    emailBody: '',
    analysisCriteria: '',
    checklistTemplateId: '',
    // 발송 날짜 규칙
    sendType: 'day_of_month',
    sendDayOfMonth: '10',
    sendDaysBefore: '20',
    // 제출 기한 규칙
    dueType: 'day_of_month',
    dueDayOfMonth: '25',
    dueDaysAfter: '15',
    isActive: true,
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
      const res = await fetch('/api/request-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          name: form.name,
          frequency: form.frequency,
          emailSubjectTemplate: form.emailSubject || `[${clientName}] 자료 제출 요청`,
          emailBodyTemplate: form.emailBody,
          analysisCriteriaTemplate: form.analysisCriteria || undefined,
          checklistTemplateId: form.checklistTemplateId || undefined,
          sendRule: buildSendRule(),
          dueRule: buildDueRule(),
          isActive: form.isActive,
        }),
      })

      let data: { error?: string } = {}
      try { data = await res.json() } catch { /* non-JSON 무시 */ }

      if (!res.ok) {
        const message = data.error ?? '요청 템플릿 저장에 실패했습니다'
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

      {/* 기본 정보 */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">기본 정보</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700">템플릿명</label>
          <input
            type="text"
            required
            maxLength={200}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="예: 월별 기장 자료 요청"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

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

        {checklistTemplates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              연결 자료관리기준 <span className="font-normal text-gray-400">(선택)</span>
            </label>
            <select
              value={form.checklistTemplateId}
              onChange={(e) => setForm((prev) => ({ ...prev, checklistTemplateId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">연결 안 함</option>
              {checklistTemplates.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* 자료 요구사항 */}
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">자료 요구사항 본문</h2>
          <p className="text-xs text-gray-500 mt-0.5">정기 요청 메일에 불러올 핵심 요구사항입니다. 담당자 인삿말·전화번호는 포함하지 않습니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            메일 제목 <span className="font-normal text-gray-400">(선택)</span>
          </label>
          <input
            type="text"
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
          <p className="mt-1 text-xs text-gray-400">비워두면 기본 제목을 사용합니다. Tab 키로 제안 제목을 입력할 수 있습니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">자료 요구사항 본문</label>
          <textarea
            required
            rows={10}
            maxLength={10000}
            value={form.emailBody}
            onChange={(e) => setForm((prev) => ({ ...prev, emailBody: e.target.value }))}
            placeholder={`아래 자료를 제출해 주세요.\n\n1. 매출 세금계산서\n2. 매입 세금계산서\n3. 카드 매출 내역\n4. 통장 입출금 내역\n5. 현금영수증`}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <p className="mt-1 text-xs text-gray-400">{form.emailBody.length} / 10000</p>
        </div>
      </section>

      {/* AI 판단 기준 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">AI 판단 기준</h2>
          <p className="text-xs text-gray-500 mt-0.5">클라이언트에게는 보이지 않습니다. AI 검토 시 이 기준으로 자료를 판단합니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">AI 판단 기준</label>
          <textarea
            value={form.analysisCriteria}
            onChange={(e) => setForm((prev) => ({ ...prev, analysisCriteria: e.target.value }))}
            maxLength={10000}
            rows={6}
            placeholder="AI 검토에 사용할 기준을 작성합니다."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
      </section>

      {/* 반복 규칙 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">반복 규칙 기본값</h2>
        <p className="text-xs text-gray-500">정기 요청 메일에서 이 템플릿을 선택하면 아래 규칙이 기본값으로 채워집니다. 수정 가능합니다.</p>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">초안 생성일 규칙</p>
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
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '템플릿 저장'}
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
