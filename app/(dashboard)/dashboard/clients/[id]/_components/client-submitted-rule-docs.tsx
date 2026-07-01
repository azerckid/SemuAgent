'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ClientSubmittedRuleDocument } from './client-payroll-rule-profile-panel'

/**
 * 고객 또는 담당자가 올린 사내규정 자료 목록.
 *
 * 제출/업로드는 자료(client_document)까지만이고, 담당자가 여기서 "초안 만들기"를
 * 눌러야 AI 구조화 → draft 프로필이 생성된다. 승인은 그 다음 단계다.
 * 클라이언트는 이 화면을 보지 못한다.
 */
export function ClientSubmittedRuleDocs({
  clientId,
  documents,
  defaultEffectiveFrom,
}: {
  clientId: string
  documents: ClientSubmittedRuleDocument[]
  defaultEffectiveFrom: string
}) {
  const router = useRouter()
  const [effectiveFrom, setEffectiveFrom] = useState(defaultEffectiveFrom)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function createDraft(doc: ClientSubmittedRuleDocument) {
    setError(null)
    setPendingId(doc.id)
    try {
      const res = await fetch(`/api/clients/${clientId}/payroll-rule-profiles/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 파일 형식에서 도출한 sourceType을 보낸다(엑셀=excel_embedded). 서버 변환이
        // contentType으로 유형을 재판정하므로 불일치하면 실패한다.
        body: JSON.stringify({ sourceType: doc.sourceType, sourceFileId: doc.id, effectiveFrom }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error?.toString?.() || data?.error || '초안 생성에 실패했습니다.')
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError('초안 생성 중 오류가 발생했습니다.')
    } finally {
      setPendingId(null)
    }
  }

  function downloadDocument(doc: ClientSubmittedRuleDocument) {
    window.open(`/api/clients/${clientId}/documents/${doc.id}/download`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">자료 {documents.length}건</Badge>
        <h3 className="text-sm font-medium text-gray-900">사내규정 자료</h3>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        고객사가 급여정산 포털에서 제출했거나 담당자가 직접 업로드한 규정 자료입니다. 적용 시작 월을 정하고
        “초안 만들기”를 누르면 AI가 구조화한 초안이 생성됩니다. 승인 전에는 급여 계산에 적용되지 않습니다.
      </p>

      {documents.length === 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-blue-200 bg-white/70 px-3 py-5 text-center text-sm text-gray-500">
          아직 제출/업로드된 사내규정 자료가 없습니다.
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs text-gray-500" htmlFor="rule-doc-effective-from">
              적용 시작 월
            </label>
            <input
              id="rule-doc-effective-from"
              type="month"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>

          <ul className="mt-3 space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={doc.submittedBy === 'client' ? 'secondary' : 'outline'}>
                      {doc.submittedBy === 'client' ? '고객 제출' : '담당자 업로드'}
                    </Badge>
                    <p className="truncate text-sm font-medium text-gray-900">{doc.originalFilename}</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {[formatBytes(doc.fileSize), doc.createdAt, doc.uploadedByStaffName].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadDocument(doc)}
                  >
                    <Download aria-hidden="true" />
                    다운로드
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => createDraft(doc)}
                    disabled={pendingId !== null || isPending}
                  >
                    {pendingId === doc.id ? '생성 중…' : '초안 만들기'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
