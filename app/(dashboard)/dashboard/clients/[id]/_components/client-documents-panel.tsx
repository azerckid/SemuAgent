'use client'

import { type ChangeEvent, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { toast } from 'sonner'
import { Download, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { DeleteConfirmDialog } from '@/app/(dashboard)/dashboard/_components/delete-confirm-dialog'
import { verifyUploadClientTokenAvailable } from '@/lib/upload/client-token-preflight'
import type { ClientDetailDocument } from './client-detail-types'

const DOCUMENT_TYPE_PRESETS = ['사업자등록증', '통장사본', '신분증', '기타']
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/jpeg',
  'image/png',
  'image/webp',
].join(',')

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ClientDocumentsPanel({
  clientId,
  documents,
  defaultExpanded = false,
}: {
  clientId: string
  documents: ClientDetailDocument[]
  defaultExpanded?: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPE_PRESETS[0])
  const [customType, setCustomType] = useState('')
  const [memo, setMemo] = useState('')
  const [showDocuments, setShowDocuments] = useState(defaultExpanded)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ClientDetailDocument | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const effectiveDocumentType = documentType === '기타' ? customType.trim() : documentType

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!effectiveDocumentType) {
      toast.error('문서 종류를 입력해 주세요')
      return
    }

    setUploading(true)
    try {
      const pathname = `client-documents/${clientId}/${crypto.randomUUID()}-${file.name}`
      const clientPayload = JSON.stringify({
        documentType: effectiveDocumentType,
        originalFilename: file.name,
        memo: memo.trim() || undefined,
      })

      await verifyUploadClientTokenAvailable({
        handleUploadUrl: `/api/clients/${clientId}/documents`,
        pathname,
        clientPayload,
      })

      await upload(pathname, file, {
        access: 'private',
        handleUploadUrl: `/api/clients/${clientId}/documents`,
        clientPayload,
      })

      toast.success('문서를 업로드했습니다')
      setMemo('')
      setShowDocuments(true)
      setShowUploadForm(false)
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '문서 업로드에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

  const deleteDocument = async () => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      const res = await fetch(`/api/clients/${clientId}/documents/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? '문서 삭제에 실패했습니다')
        return
      }
      toast.success('문서를 삭제했습니다')
      setDeleteTarget(null)
      startTransition(() => router.refresh())
    } catch {
      toast.error('네트워크 오류가 발생했습니다')
    } finally {
      setDeletingId(null)
    }
  }

  const isExpanded = showDocuments || showUploadForm

  function togglePanel() {
    if (isExpanded) {
      setShowDocuments(false)
      setShowUploadForm(false)
      return
    }

    setShowDocuments(true)
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="min-w-0 text-left"
            onClick={togglePanel}
          >
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-950">사업장 문서</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {documents.length}개 등록
              </span>
            </span>
          </button>
          <Button type="button" variant="ghost" size="sm" onClick={togglePanel}>
            {isExpanded ? '접기' : '펼치기'}
          </Button>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          사업자등록증, 통장사본 등 보관 문서입니다.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShowUploadForm((current) => !current)
              setShowDocuments(true)
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            업로드
          </Button>
        </div>
      </div>

      {isExpanded ? (
        <div className="space-y-3 border-t border-gray-100 p-3">
          {showDocuments ? (
            <div className="space-y-2">
              {documents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                  등록된 문서가 없습니다.
                </div>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {doc.documentType}
                          </span>
                          <p className="truncate text-sm font-medium text-gray-900">{doc.originalFilename}</p>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatBytes(doc.fileSize)} · {doc.uploadedByStaffName ?? '알 수 없음'} 업로드
                        </p>
                        {doc.memo && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">{doc.memo}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`${doc.originalFilename} 다운로드`}
                          onClick={() => window.open(`/api/clients/${clientId}/documents/${doc.id}/download`, '_blank')}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`${doc.originalFilename} 삭제`}
                          disabled={isPending || deletingId !== null}
                          onClick={() => setDeleteTarget(doc)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {showUploadForm ? (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600">문서 종류</label>
                  <Select
                    value={documentType}
                    onChange={(event) => setDocumentType(event.target.value)}
                    className="mt-1"
                  >
                    {DOCUMENT_TYPE_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                  </Select>
                </div>
                {documentType === '기타' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600">직접 입력</label>
                    <input
                      value={customType}
                      onChange={(event) => setCustomType(event.target.value)}
                      placeholder="예: 임대차계약서"
                      maxLength={50}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">메모 (선택)</label>
                <textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  maxLength={2000}
                  rows={2}
                  placeholder="예: 2026년 갱신본"
                  className="mt-1 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                className="hidden"
                disabled={uploading || (documentType === '기타' && !customType.trim())}
                onChange={handleFileChange}
              />
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={uploading || (documentType === '기타' && !customType.trim())}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? '업로드 중...' : '파일 선택 후 업로드'}
              </Button>
              <p className="text-xs text-gray-400">PDF, Excel, 이미지 · 파일당 최대 50MB</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        title="문서를 삭제할까요?"
        description={`${deleteTarget?.originalFilename ?? '이 문서'}를 삭제합니다.\nBlob 저장소의 원본 파일도 함께 삭제됩니다.`}
        loading={deleteTarget !== null && deletingId === deleteTarget.id}
        onCancel={() => {
          if (deletingId === null) setDeleteTarget(null)
        }}
        onConfirm={deleteDocument}
      />
    </section>
  )
}
