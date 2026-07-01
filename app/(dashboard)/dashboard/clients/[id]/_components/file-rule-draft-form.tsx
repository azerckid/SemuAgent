'use client'

import { type ChangeEvent, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  PAYROLL_RULE_CLIENT_DOCUMENT_TYPE,
  PAYROLL_RULE_DOCUMENT_ACCEPT,
  PAYROLL_RULE_STAFF_UPLOAD_MEMO,
  resolvePayrollRuleSourceTypeFromContentType,
} from '@/lib/payroll/payroll-rule-document-types'
import { verifyUploadClientTokenAvailable } from '@/lib/upload/client-token-preflight'
import { cn } from '@/lib/utils'

function inferSourceType(file: File): 'rule_document' | 'excel_embedded' | null {
  const contentType = file.type || 'application/octet-stream'
  const fromMime = resolvePayrollRuleSourceTypeFromContentType(contentType)
  if (fromMime === 'rule_document' || fromMime === 'excel_embedded') return fromMime

  const lower = file.name.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'excel_embedded'
  if (lower.endsWith('.txt') || lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx')) {
    return 'rule_document'
  }
  return null
}

/**
 * Slice 4b: 담당자가 사내 급여 규칙 파일(txt/pdf/doc/xlsx)을 업로드하면 AI가
 * 구조화해 draft를 만든다. Blob 업로드는 client_document에 저장한다.
 */
export function FileRuleDraftForm({
  clientId,
  defaultEffectiveFrom,
}: {
  clientId: string
  defaultEffectiveFrom: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState(defaultEffectiveFrom)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const busy = isSubmitting || isPending
  const canSelectFile = !busy

  function selectFile(file: File | null) {
    setErrorMessage(null)
    setSuccessMessage(null)
    if (!file) {
      setSelectedFile(null)
      return
    }
    if (!inferSourceType(file)) {
      setErrorMessage('txt, pdf, doc/docx, xlsx/xls 파일만 업로드할 수 있습니다')
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0] ?? null)
    event.target.value = ''
  }

  async function submit() {
    if (!selectedFile) return
    const sourceType = inferSourceType(selectedFile)
    if (!sourceType) {
      setErrorMessage('txt, pdf, doc/docx, xlsx/xls 파일만 업로드할 수 있습니다')
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(true)
    try {
      const documentId = crypto.randomUUID()
      const pathname = `client-documents/${clientId}/${documentId}-${selectedFile.name}`
      const clientPayload = JSON.stringify({
        documentId,
        documentType: PAYROLL_RULE_CLIENT_DOCUMENT_TYPE,
        originalFilename: selectedFile.name,
        memo: PAYROLL_RULE_STAFF_UPLOAD_MEMO,
      })

      await verifyUploadClientTokenAvailable({
        handleUploadUrl: `/api/clients/${clientId}/documents`,
        pathname,
        clientPayload,
      })

      await upload(pathname, selectedFile, {
        access: 'private',
        handleUploadUrl: `/api/clients/${clientId}/documents`,
        clientPayload,
      })

      const response = await fetch(`/api/clients/${clientId}/payroll-rule-profiles/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType,
          sourceFileId: documentId,
          effectiveFrom,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null
      if (!response.ok) {
        setErrorMessage(formatApiError(payload?.error) ?? '사내급여기준 초안을 만들지 못했습니다')
        return
      }

      setSuccessMessage('파일에서 사내급여기준 프로필 초안을 만들었습니다. 승인 전에는 급여 계산에 적용되지 않습니다.')
      setSelectedFile(null)
      startTransition(() => router.refresh())
    } catch {
      setErrorMessage('파일 업로드 또는 AI 초안 생성 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="border-t border-gray-100 pt-4">
      <label className="block text-sm font-medium text-gray-700">
        유효 시작월
        <Input
          type="month"
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          className="mt-1 w-44"
          disabled={busy}
        />
      </label>

      <p className="mt-3 text-sm font-medium text-gray-700">사내 급여 규칙 파일</p>
      <div
        role="button"
        tabIndex={canSelectFile ? 0 : -1}
        aria-disabled={!canSelectFile}
        onKeyDown={(event) => {
          if (!canSelectFile) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (canSelectFile) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (!canSelectFile) return
          selectFile(event.dataTransfer.files[0] ?? null)
        }}
        onClick={() => {
          if (canSelectFile) inputRef.current?.click()
        }}
        className={cn(
          'mt-1 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          canSelectFile && dragging && 'border-blue-500 bg-blue-50/60',
          canSelectFile && !dragging && 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/80',
          !canSelectFile && 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400',
        )}
      >
        <FileUp className={cn('h-8 w-8', canSelectFile ? 'text-gray-400' : 'text-gray-300')} />
        <p className="text-sm font-medium text-gray-700">
          {busy ? '파일 처리 중…' : '파일을 끌어다 놓거나 클릭해서 선택'}
        </p>
        <p className="text-xs text-gray-400">
          txt, pdf, doc/docx, xlsx/xls · 파일당 최대 50MB
        </p>
        {selectedFile ? (
          <p className="text-xs font-medium text-blue-700">선택됨: {selectedFile.name}</p>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={PAYROLL_RULE_DOCUMENT_ACCEPT}
        className="hidden"
        disabled={!canSelectFile}
        onChange={handleFileChange}
      />
      <p className="mt-1 text-xs text-gray-400">
        주민번호·계좌번호·연락처 같은 개인정보가 포함되면 차단됩니다.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={submit} disabled={busy || !selectedFile || !effectiveFrom}>
          {busy ? '파일 처리 중…' : '파일로 AI 초안 만들기'}
        </Button>
        <span className="text-xs text-gray-400">초안은 담당자 승인 전에는 적용되지 않습니다.</span>
      </div>
      {errorMessage && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      )}
      {successMessage && (
        <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p>
      )}
    </div>
  )
}

function formatApiError(error: unknown): string | null {
  if (!error) return null
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'formErrors' in error) {
    const flattened = error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> }
    return flattened.formErrors?.[0] ?? Object.values(flattened.fieldErrors ?? {}).flat()[0] ?? null
  }
  return null
}
