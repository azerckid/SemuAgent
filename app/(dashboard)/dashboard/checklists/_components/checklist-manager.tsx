'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PAYROLL_UPLOAD_BASELINE_ITEMS, PAYROLL_UPLOAD_CHECKLIST_TEMPLATE_NAME } from '@/lib/payroll/upload-checklist-baseline'

interface ChecklistItemRow {
  id: string
  name: string
  required: boolean
  sortOrder: number
}

interface TemplateRow {
  id: string
  name: string
  items: ChecklistItemRow[]
}

interface SampleTemplate {
  name: string
  description: string
  items: Array<{ name: string; required: boolean }>
  supersededItemNames?: string[]
}

interface Props {
  initialTemplates: TemplateRow[]
}

const LEGACY_PAYROLL_CLOSE_SOURCE_ITEMS = [
  '급여입력 자료',
  '근태대장',
  '입사자/퇴사자 내역',
  '변동수당 내역',
  '공제 내역',
  '상여/성과급 내역',
  '비과세 수당 확인자료',
  '4대보험 변동자료',
]

const PAYROLL_CLOSE_BASELINE_ITEMS = [
  { name: '급여정산 입력자료 충족 확인(급여정산 자료 기준 샘플 기준)', required: true },
  { name: '급여대장/법정 임금대장 초안', required: true },
  { name: '임금명세서 초안', required: true },
  { name: '지급항목별 합계 검증표(기본급/상여/수당/비과세)', required: true },
  { name: '공제항목별 합계 검증표(4대보험/소득세/지방소득세/기타공제)', required: true },
  { name: '실지급액/이체금액 확인표', required: true },
  { name: '전월 대비 변동 검토표', required: true },
  { name: '입사/퇴사/휴직/연차 정산 검토표', required: true },
  { name: '자료없음/미확정 항목 담당자 확인 기록', required: true },
  { name: '부합 원자료 다운로드/보관 확인', required: true },
  { name: '마감 승인/담당자 확인 기록', required: true },
  { name: '회사별 계산규칙/법정 기본 기준 적용 메모', required: false },
  { name: '이미 계산된 외부 급여대장/공제합계/충당액(검증용)', required: false },
  { name: '기타 마감 증빙자료', required: false },
]

const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    name: '기장 자료 기준 샘플',
    description: '월별 또는 분기별 기장 자료 검토에 참고하는 기본 자료 기준입니다.',
    items: [
      { name: '통장 거래내역', required: true },
      { name: '카드 사용내역', required: true },
      { name: '매출 세금계산서', required: true },
      { name: '매입 세금계산서', required: true },
      { name: '현금영수증', required: true },
      { name: '온라인 매출/PG 정산자료', required: true },
      { name: '전표·입출금 정리', required: false },
      { name: '기타 증빙자료', required: false },
    ],
  },
  {
    name: '부가세 자료 기준 샘플',
    description: '부가세 신고 전 매출/매입 자료 검토에 참고하는 기본 자료 기준입니다.',
    items: [
      { name: '매출 세금계산서', required: true },
      { name: '매입 세금계산서', required: true },
      { name: '신용카드 매출자료', required: true },
      { name: '현금영수증 매출자료', required: true },
      { name: '사업용 신용카드 사용내역', required: true },
      { name: '온라인 매출/PG 정산자료', required: false },
      { name: '기타 부가세 증빙자료', required: false },
    ],
  },
  {
    name: PAYROLL_UPLOAD_CHECKLIST_TEMPLATE_NAME,
    description: '법정 임금대장 작성과 급여대장 초안 계산에 필요한 클라이언트 업로드 자료 기준입니다.',
    items: PAYROLL_UPLOAD_BASELINE_ITEMS,
  },
  {
    name: '온라인 쇼핑몰 기장 기준 샘플',
    description: '오픈마켓, PG, 간편결제 매출이 있는 고객사의 기장 자료 검토 기준입니다.',
    items: [
      { name: '통장 거래내역', required: true },
      { name: '사업용 카드 사용내역', required: true },
      { name: '오픈마켓 매출 정산자료', required: true },
      { name: 'PG 정산자료', required: true },
      { name: '간편결제 정산자료', required: true },
      { name: '매출 세금계산서', required: true },
      { name: '매입 세금계산서', required: true },
      { name: '광고비/수수료 증빙자료', required: false },
      { name: '택배비/배송비 증빙자료', required: false },
    ],
  },
  {
    name: '일반 서비스업 기장 기준 샘플',
    description: '용역, 컨설팅, 디자인, 개발 등 서비스업 고객사의 월별 기장 자료 기준입니다.',
    items: [
      { name: '통장 거래내역', required: true },
      { name: '사업용 카드 사용내역', required: true },
      { name: '매출 세금계산서', required: true },
      { name: '매입 세금계산서', required: true },
      { name: '현금영수증', required: true },
      { name: '급여/인건비 지급자료', required: false },
      { name: '임대료/관리비 증빙자료', required: false },
      { name: '기타 경비 증빙자료', required: false },
    ],
  },
  {
    name: '월 급여 마감 기준 샘플',
    description: '매월 급여 계산 후 급여대장, 임금명세서, 공제, 이체, 승인 자료를 마감 전 확인하는 기준입니다.',
    items: PAYROLL_CLOSE_BASELINE_ITEMS,
    supersededItemNames: [
      ...PAYROLL_UPLOAD_BASELINE_ITEMS.map((item) => item.name),
      ...LEGACY_PAYROLL_CLOSE_SOURCE_ITEMS,
    ],
  },
  {
    name: '부가세 신고 마감 기준 샘플',
    description: '부가세 신고 전 매출, 매입, 카드, 현금영수증 자료를 최종 확인하는 기준입니다.',
    items: [
      { name: '매출 세금계산서', required: true },
      { name: '매입 세금계산서', required: true },
      { name: '신용카드 매출자료', required: true },
      { name: '현금영수증 매출자료', required: true },
      { name: '사업용 신용카드 사용내역', required: true },
      { name: '온라인 매출/PG 정산자료', required: true },
      { name: '수출/영세율 관련 자료', required: false },
      { name: '불공제/공제 제외 검토자료', required: false },
    ],
  },
]

function SampleTemplateButton({
  sample,
  templates,
  saving,
  onClick,
}: {
  sample: SampleTemplate
  templates: TemplateRow[]
  saving: boolean
  onClick: () => void
}) {
  const existingTemplate = templates.find((template) => template.name === sample.name)
  const supersededCount = existingTemplate ? getSupersededSampleItems(sample, existingTemplate).length : 0
  const missingCount = existingTemplate
    ? sample.items.filter((item) => !existingTemplate.items.some((existingItem) => existingItem.name === item.name)).length
    : null
  const actionLabel = !existingTemplate
    ? '추가'
    : supersededCount > 0
      ? `정리 ${supersededCount + (missingCount ?? 0)}`
    : missingCount && missingCount > 0
      ? `누락 추가 ${missingCount}`
      : '최신'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
    >
      {sample.name} {actionLabel}
    </button>
  )
}

function getSupersededSampleItems(sample: SampleTemplate, template: TemplateRow) {
  const sampleNames = new Set(sample.items.map((item) => item.name))
  const supersededNames = new Set(sample.supersededItemNames ?? [])

  return template.items.filter((item) => supersededNames.has(item.name) && !sampleNames.has(item.name))
}

export function ChecklistManager({ initialTemplates }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [templates, setTemplates] = useState(initialTemplates)
  const [selectedId, setSelectedId] = useState(initialTemplates[0]?.id ?? '')
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemRequired, setNewItemRequired] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sampleMessage, setSampleMessage] = useState('')

  const selected = templates.find((t) => t.id === selectedId)

  const getExistingSampleTemplate = (sample: SampleTemplate) =>
    templates.find((template) => template.name === sample.name)

  const getMissingSampleItems = (
    sample: SampleTemplate,
    template: TemplateRow,
  ) => {
    const existingNames = new Set(template.items.map((item) => item.name))
    return sample.items.filter((item) => !existingNames.has(item.name))
  }

  const createTemplate = async () => {
    if (!newTemplateName.trim()) return
    setSaving(true)
    const res = await fetch('/api/checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTemplateName }),
    })
    if (res.ok) {
      const { id } = await res.json()
      const newTemplate = { id, name: newTemplateName, items: [] }
      setTemplates([...templates, newTemplate])
      setSelectedId(id)
      setNewTemplateName('')
    }
    setSaving(false)
  }

  const createSampleTemplate = async (sample: SampleTemplate) => {
    const existingTemplate = getExistingSampleTemplate(sample)
    if (existingTemplate) {
      const missingItems = getMissingSampleItems(sample, existingTemplate)
      const supersededItems = getSupersededSampleItems(sample, existingTemplate)

      if (missingItems.length === 0 && supersededItems.length === 0) {
        setSelectedId(existingTemplate.id)
        setSampleMessage(`"${sample.name}" 기준은 이미 최신 항목을 모두 포함하고 있습니다.`)
        return
      }

      setSaving(true)
      setSampleMessage('')

      const createdItems: ChecklistItemRow[] = []
      const removedItemIds = new Set<string>()
      let removedCount = 0
      let hasItemError = false
      const remainingExistingItems = existingTemplate.items.filter((item) => {
        if (!supersededItems.some((supersededItem) => supersededItem.id === item.id)) {
          return true
        }

        return false
      })

      for (const item of supersededItems) {
        const itemRes = await fetch(`/api/checklists/${existingTemplate.id}/items/${item.id}`, {
          method: 'DELETE',
        })

        if (itemRes.ok) {
          removedItemIds.add(item.id)
          removedCount += 1
        } else {
          hasItemError = true
        }
      }

      for (const [index, item] of missingItems.entries()) {
        const itemRes = await fetch(`/api/checklists/${existingTemplate.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            required: item.required,
            sortOrder: remainingExistingItems.length + index,
          }),
        })

        if (itemRes.ok) {
          const { id: itemId } = await itemRes.json()
          createdItems.push({
            id: itemId,
            name: item.name,
            required: item.required,
            sortOrder: remainingExistingItems.length + index,
          })
        } else {
          hasItemError = true
        }
      }

      setTemplates(templates.map((template) =>
        template.id === existingTemplate.id
          ? { ...template, items: [...template.items.filter((item) => !removedItemIds.has(item.id)), ...createdItems] }
          : template,
      ))
      setSelectedId(existingTemplate.id)
      setSaving(false)
      setSampleMessage(
        hasItemError
          ? `"${sample.name}" 기준의 일부 항목만 정리했습니다. 나머지는 직접 확인해 주세요.`
          : removedCount > 0
            ? `"${sample.name}" 기준을 정리했습니다. 기존 중복 항목 ${removedCount}개를 제거하고 누락 항목 ${createdItems.length}개를 추가했습니다.`
            : `"${sample.name}" 기준에 누락 항목 ${createdItems.length}개를 추가했습니다.`,
      )
      startTransition(() => router.refresh())
      return
    }

    setSaving(true)
    setSampleMessage('')

    const templateRes = await fetch('/api/checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sample.name, description: sample.description }),
    })

    if (!templateRes.ok) {
      setSaving(false)
      setSampleMessage('샘플 기준을 만들 수 없습니다. 관리자 권한을 확인해 주세요.')
      return
    }

    const { id } = await templateRes.json()
    const createdItems: ChecklistItemRow[] = []
    let hasItemError = false

    for (const [index, item] of sample.items.entries()) {
      const itemRes = await fetch(`/api/checklists/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          required: item.required,
          sortOrder: index,
        }),
      })

      if (itemRes.ok) {
        const { id: itemId } = await itemRes.json()
        createdItems.push({
          id: itemId,
          name: item.name,
          required: item.required,
          sortOrder: index,
        })
      } else {
        hasItemError = true
      }
    }

    const newTemplate = { id, name: sample.name, items: createdItems }
    setTemplates([...templates, newTemplate])
    setSelectedId(id)
    setSaving(false)
    setSampleMessage(
      hasItemError
        ? `"${sample.name}" 기준을 만들었지만 일부 항목이 추가되지 않았습니다. 누락 항목을 확인해 주세요.`
        : `"${sample.name}" 기준을 추가했습니다.`,
    )
    startTransition(() => router.refresh())
  }

  const addItem = async () => {
    if (!newItemName.trim() || !selectedId) return
    setSaving(true)
    const res = await fetch(`/api/checklists/${selectedId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newItemName,
        required: newItemRequired,
        sortOrder: selected?.items.length ?? 0,
      }),
    })
    if (res.ok) {
      const { id } = await res.json()
      setTemplates(templates.map((t) =>
        t.id === selectedId
          ? { ...t, items: [...t.items, { id, name: newItemName, required: newItemRequired, sortOrder: t.items.length }] }
          : t,
      ))
      setNewItemName('')
    }
    setSaving(false)
    startTransition(() => router.refresh())
  }

  const deleteItem = async (itemId: string) => {
    await fetch(`/api/checklists/${selectedId}/items/${itemId}`, { method: 'DELETE' })
    setTemplates(templates.map((t) =>
      t.id === selectedId
        ? { ...t, items: t.items.filter((i) => i.id !== itemId) }
        : t,
    ))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">자료관리기준</h1>
        <p className="mt-1 text-sm text-gray-500">
          회계사무소별로 고객에게 요청하고 업로드 후 검토할 자료 기준을 관리합니다.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-blue-950">샘플 기준으로 시작하기</h2>
            <p className="mt-1 text-xs leading-5 text-blue-700">
              샘플은 참고 자료입니다. 이미 있는 기준은 누락 항목만 추가하고, 회계사무소 기준에 맞게 항목을 조정해 사용하세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_TEMPLATES.map((sample) => (
              <SampleTemplateButton
                key={sample.name}
                sample={sample}
                templates={templates}
                saving={saving}
                onClick={() => createSampleTemplate(sample)}
              />
            ))}
          </div>
        </div>
        {sampleMessage && <p className="mt-3 text-xs text-blue-700">{sampleMessage}</p>}
      </div>

      <div className="flex gap-6">
        {/* Template list */}
        <div className="w-56 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-xs font-medium text-gray-500">
              자료 기준
            </div>
            <ul className="divide-y divide-gray-100">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left px-4 py-3 text-sm ${selectedId === t.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {t.name}
                    <span className="ml-1 text-xs text-gray-400">({t.items.length})</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="p-3 border-t border-gray-100">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="새 자료 기준 이름"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
                onKeyDown={(e) => e.key === 'Enter' && createTemplate()}
              />
              <button
                onClick={createTemplate}
                disabled={saving || !newTemplateName.trim()}
                className="w-full py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
              >
                + 기준 추가
              </button>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1">
          {selected ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-medium text-gray-900">{selected.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">항목 {selected.items.length}개</p>
              </div>

              <ul className="divide-y divide-gray-100">
                {selected.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <span className="wrap-break-word text-sm leading-6 text-gray-900">{item.name}</span>
                      <span className={`ml-2 inline-flex text-xs px-1.5 py-0.5 rounded-full ${item.required ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                        {item.required ? '요청 항목' : '참고 항목'}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="shrink-0 text-xs text-red-400 hover:text-red-600"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>

              {/* Add item form */}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">항목명</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="예: 매출 세금계산서"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && addItem()}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">구분</label>
                  <select
                    value={newItemRequired ? 'required' : 'conditional'}
                    onChange={(e) => setNewItemRequired(e.target.value === 'required')}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="required">요청 항목</option>
                    <option value="conditional">참고 항목</option>
                  </select>
                </div>
                <button
                  onClick={addItem}
                  disabled={saving || !newItemName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  + 추가
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-12 text-center text-sm text-gray-400">
              왼쪽에서 자료 기준을 선택하거나 새로 만드세요.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
