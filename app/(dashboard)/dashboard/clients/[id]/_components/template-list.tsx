'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface Template {
  id: string
  name: string
  frequency: string
  emailBodyTemplate: string | null
  analysisCriteriaTemplate: string | null
  isActive: boolean
  createdAt: string
}

interface Props {
  templates: Template[]
}

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: '월별',
  quarterly: '분기별',
  semiannual: '반기별',
  annual: '연간',
}

export function TemplateList({ templates: initialTemplates }: Props) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [toggling, setToggling] = useState<string | null>(null)

  const handleToggle = async (templateId: string, isActive: boolean) => {
    setToggling(templateId)
    try {
      const res = await fetch(`/api/request-templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      if (!res.ok) {
        toast.error('상태 변경에 실패했습니다. 다시 시도해 주세요.')
        return
      }
      setTemplates((prev) =>
        prev.map((t) => t.id === templateId ? { ...t, isActive: !isActive } : t),
      )
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
    } finally {
      setToggling(null)
    }
  }

  if (templates.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
        아직 등록된 요청 템플릿이 없습니다
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {templates.map((tmpl) => (
        <div
          key={tmpl.id}
          className={`rounded-lg border p-3 ${tmpl.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{tmpl.name}</p>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-500">{FREQUENCY_LABEL[tmpl.frequency] ?? tmpl.frequency}</span>
                {tmpl.analysisCriteriaTemplate && (
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">AI 기준 있음</span>
                )}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tmpl.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {tmpl.isActive ? '활성' : '중지'}
                </span>
              </div>
              {tmpl.emailBodyTemplate && (
                <p className="mt-1 line-clamp-2 text-xs text-gray-400">{tmpl.emailBodyTemplate}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleToggle(tmpl.id, tmpl.isActive)}
              disabled={toggling === tmpl.id}
              className="shrink-0 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              {toggling === tmpl.id ? '처리 중...' : tmpl.isActive ? '중지' : '활성화'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
