'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { verifyUploadClientTokenAvailable } from '@/lib/upload/client-token-preflight'

/**
 * 급여정산 포털의 선택 섹션: 클라이언트가 사내 급여규정 파일을 함께 올린다.
 *
 * 월별 급여 데이터(/api/upload → upload_file)와 분리해 전용 콜백
 * (/api/upload/payroll-rule → client_document)으로 보낸다. 규정은 한 번/드물게
 * 올리는 자료라 필수가 아니며, 제출을 막지 않는다. 클라이언트는 자기가 올린
 * 규정 파일만 보고, 프로필·승인·AI 판단은 보지 못한다(담당자 화면 전용).
 */

const RULE_UPLOAD_URL = '/api/upload/payroll-rule'
const ACCEPT = '.txt,.pdf,.doc,.docx,.xls,.xlsx'

type RuleUploadState = {
  name: string
  status: 'uploading' | 'done' | 'error'
  error?: string
}

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('content type') || message.includes('allowed')) {
    return 'txt·pdf·doc·docx·xls·xlsx 파일만 올릴 수 있습니다.'
  }
  if (message.includes('만료') || message.includes('유효하지')) {
    return '요청이 만료되었습니다. 담당 회계사에게 문의해 주세요.'
  }
  return message || '업로드 중 오류가 발생했습니다.'
}

export function PayrollRulePortalUpload({
  rawToken,
  isClosed,
}: {
  rawToken: string
  isClosed: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Record<string, RuleUploadState>>({})
  const [dragging, setDragging] = useState(false)
  const [, startTransition] = useTransition()

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (isClosed) return
      const files = Array.from(fileList)
      if (files.length === 0) return

      setItems((prev) => {
        const next = { ...prev }
        for (const file of files) next[file.name] = { name: file.name, status: 'uploading' }
        return next
      })

      await Promise.all(
        files.map(async (file) => {
          try {
            const pathname = `payroll-rules/${crypto.randomUUID()}-${file.name}`
            const clientPayload = JSON.stringify({ rawToken, originalFilename: file.name })

            await verifyUploadClientTokenAvailable({ handleUploadUrl: RULE_UPLOAD_URL, pathname, clientPayload })
            await upload(pathname, file, {
              access: 'private',
              handleUploadUrl: RULE_UPLOAD_URL,
              clientPayload,
            })

            setItems((prev) => ({ ...prev, [file.name]: { name: file.name, status: 'done' } }))
          } catch (err) {
            setItems((prev) => ({
              ...prev,
              [file.name]: { name: file.name, status: 'error', error: friendlyError(err) },
            }))
          }
        }),
      )

      startTransition(() => router.refresh())
    },
    [isClosed, rawToken, router],
  )

  const list = Object.values(items)

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-medium text-gray-900">
          사내 급여규정 <span className="text-gray-400 text-sm font-normal">(선택)</span>
        </h2>
      </div>
      <div className="px-5 py-5 space-y-4">
        <p className="text-sm leading-relaxed text-gray-600">
          식대·차량유지비·연장수당처럼 <span className="font-medium text-gray-800">회사 전체에 적용되는 급여 지급 기준</span>이
          있으면, 그 기준이 담긴 자료(예: 임금규정·급여지급규정)를 올려 주세요. 급여 계산 기준을 정확히
          반영하는 데 사용합니다. 규정이 바뀌지 않았다면 매번 올리지 않아도 됩니다.
        </p>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
          직원 개인별 연봉·급여명세나 주민번호 등 <span className="font-medium">개인정보가 담긴 자료는 올리지 마세요.</span>{' '}
          회사 공통 지급 기준만 있으면 됩니다.
        </p>

        <div>
          <div
            role="button"
            tabIndex={isClosed ? -1 : 0}
            aria-disabled={isClosed}
            onClick={() => !isClosed && inputRef.current?.click()}
            onKeyDown={(e) => {
              if (!isClosed && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                inputRef.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (!isClosed) setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              if (!isClosed && e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files)
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-5 py-8 text-center transition-colors ${
              dragging ? 'border-blue-400 bg-blue-50/60' : 'border-gray-200 hover:border-gray-300'
            } ${isClosed ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
          >
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm text-gray-600">
              규정 파일을 끌어다 놓거나 <span className="font-medium text-blue-600">클릭하여 선택</span>
            </p>
            <p className="text-xs text-gray-400">txt · pdf · doc · docx · xls · xlsx</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {list.length > 0 && (
          <ul className="space-y-1.5">
            {list.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-gray-700">{item.name}</span>
                {item.status === 'uploading' && <span className="shrink-0 text-xs text-gray-400">올리는 중…</span>}
                {item.status === 'done' && <span className="shrink-0 text-xs text-green-600">제출됨</span>}
                {item.status === 'error' && (
                  <span className="shrink-0 text-xs text-red-500" title={item.error}>
                    {item.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
