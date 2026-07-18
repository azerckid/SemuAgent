'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { redactAssistantText } from '@/lib/assistant/text-redaction'
import type { UpcomingScheduleItem } from '@/lib/tax-calendar'
import { requestSebiseoChat } from '@/lib/sebiseo/chat/client'
import { recentSebiseoHistory } from '@/lib/sebiseo/chat/schemas'
import {
  findSebiseoPeriodOption,
  type SebiseoPeriodOption,
} from '@/lib/sebiseo/period-options'
import type { SebiseoUploadResultCard } from '@/lib/sebiseo/upload-result-schema'
import {
  createSebiseoUploadSession,
  uploadSebiseoFiles,
  validateSebiseoUploadFiles,
} from '@/lib/sebiseo/upload-client'
import { SebiseoComposer } from './sebiseo-composer'
import { SebiseoPeriodConfirm } from './sebiseo-period-confirm'
import {
  SebiseoThread,
  type SebiseoThreadItem,
} from './sebiseo-thread'
import { SebiseoUploadResultCardView } from './sebiseo-upload-result-card'
import {
  buildSebiseoSessionThreadStorageKey,
  readSebiseoSessionThread,
  writeSebiseoSessionThread,
  type SebiseoStoredThreadItem,
} from '@/lib/sebiseo/thread-session-storage'

export type SebiseoWorkspaceProps = {
  readonly tenantId: string
  readonly upcoming: UpcomingScheduleItem | null
  readonly businessEntity: { readonly id: string; readonly name: string } | null
  readonly periodOptions: readonly SebiseoPeriodOption[]
  readonly defaultPeriodKey: string
  readonly initialUploadResult: SebiseoUploadResultCard | null
}

export function SebiseoWorkspace({
  tenantId,
  upcoming,
  businessEntity,
  periodOptions,
  defaultPeriodKey,
  initialUploadResult,
}: SebiseoWorkspaceProps) {
  const router = useRouter()
  const [thread, setThread] = useState<SebiseoThreadItem[]>([])
  const skipThreadPersistRef = useRef(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [periodOpen, setPeriodOpen] = useState(false)
  const [selectedPeriodKey, setSelectedPeriodKey] = useState(defaultPeriodKey)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sessionThreadStorageKey = businessEntity
    ? buildSebiseoSessionThreadStorageKey(tenantId, businessEntity.id)
    : null

  useEffect(() => {
    skipThreadPersistRef.current = true
    if (!sessionThreadStorageKey) {
      setThread([])
      return
    }

    // 복원분은 이미 읽은 답변이므로 typewriter를 다시 돌리지 않는다(CTA 지연 방지).
    setThread(
      readSebiseoSessionThread(window.sessionStorage, sessionThreadStorageKey).map((item) => ({
        ...item,
        animate: false,
      })),
    )
  }, [sessionThreadStorageKey])

  useEffect(() => {
    if (!sessionThreadStorageKey) return
    if (skipThreadPersistRef.current) {
      skipThreadPersistRef.current = false
      return
    }

    const persistable = thread.filter((item): item is SebiseoStoredThreadItem =>
      item.kind === 'user' || item.kind === 'assistant',
    )
    writeSebiseoSessionThread(window.sessionStorage, sessionThreadStorageKey, persistable)
  }, [sessionThreadStorageKey, thread])

  const canAttach = Boolean(businessEntity) && !uploading

  const pushSystem = (item: Omit<SebiseoThreadItem, 'id' | 'kind'>) => {
    setThread((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: 'system',
        ...item,
      },
    ])
  }

  const onPickFiles = (fileList: FileList | null) => {
    if (!fileList || !businessEntity) return
    setError(null)
    const { accepted, error: validationError } = validateSebiseoUploadFiles(Array.from(fileList))
    if (validationError) {
      setError(validationError)
      return
    }
    // Period confirm is required before any staff-direct-upload call.
    setPendingFiles(accepted)
    setSelectedPeriodKey(defaultPeriodKey)
    setPeriodOpen(true)
  }

  const cancelPeriod = () => {
    if (uploading) return
    setPeriodOpen(false)
    setPendingFiles([])
  }

  const confirmPeriodAndUpload = async () => {
    if (!businessEntity || pendingFiles.length === 0) return
    const period = findSebiseoPeriodOption(periodOptions, selectedPeriodKey)
    if (!period) {
      setError('적용 기간을 선택해 주세요.')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const session = await createSebiseoUploadSession({
        businessEntityId: businessEntity.id,
        periodLabel: period.periodLabel,
        accountingPeriod: period.accountingPeriod,
      })
      await uploadSebiseoFiles({ session, files: pendingFiles })

      const names = pendingFiles.map((file) => file.name).join(', ')
      // CUI-4: CTA는 결과 카드로 일원화. system 텍스트는 상태만 알린다.
      pushSystem({
        body: `${names} · ${period.confirmLabel}에 등록했습니다. 아래 결과 카드에서 분석 상태를 확인할 수 있습니다.`,
      })
      setPeriodOpen(false)
      setPendingFiles([])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

  const sendChat = async () => {
    const redactedMessage = redactAssistantText(message).text
    if (!redactedMessage || sending) return

    const history = recentSebiseoHistory(
      thread
        .filter((item) => item.kind === 'user' || item.kind === 'assistant')
        .map((item) => ({
          role: item.kind as 'user' | 'assistant',
          content: item.body,
        })),
    )

    setThread((prev) => [
      ...prev,
      { id: crypto.randomUUID(), kind: 'user', body: redactedMessage },
    ])
    setMessage('')
    setSending(true)
    setError(null)
    try {
      const response = await requestSebiseoChat({
        message: redactedMessage,
        history,
        routePath: '/dashboard/sebiseo',
        clientRequestId: crypto.randomUUID(),
      })
      setThread((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: 'assistant',
          body: response.answer,
          tone: response.status === 'refused'
            ? 'refused'
            : response.status === 'error'
              ? 'error'
              : 'normal',
          // CUI-3c: 허용된 답변에만 서버가 정한 화면 이동 버튼이 채워진다.
          actions: response.suggestedActions,
        },
      ])
    } catch (chatError) {
      setThread((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: 'assistant',
          body: chatError instanceof Error
            ? chatError.message
            : '세비서 답변을 불러오지 못했습니다.',
          tone: 'error',
        },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col bg-company-bg text-foreground md:min-h-screen">
      <div className="px-6 pt-3.5 pb-2 text-[15px] font-semibold">세비서</div>

      <div className="mx-auto w-full max-w-[768px] px-6 pb-4">
        <ReferenceTaxScheduleCard item={upcoming} />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-[150px]">
        <div className="mx-auto w-full max-w-[768px] space-y-3.5 pt-6 text-[15.5px] leading-[1.7] text-foreground">
          <p className="text-xl font-semibold tracking-tight">무엇을 도와드릴까요?</p>
          <p>
            세무·회계 업무 안내를 돕는 세비서입니다. 대화와 파일 첨부를 사용할 수 있고,
            Instant·음성은 아직 준비 중입니다.
          </p>
          <p>
            왼쪽 메뉴에서 자료수집·기장검토·부가세·연간신고 화면으로 바로 이동할 수 있습니다.{' '}
            <span className="font-semibold">확정과 신고는 각 표·화면에서 직접</span> 진행해 주세요.
          </p>
          {!businessEntity ? (
            <p className="rounded-xl border border-company-border bg-company-surface px-3.5 py-3 text-[13px] text-company-fg-muted">
              사업장이 없어 파일을 올릴 수 없습니다. 온보딩·설정에서 사업장을 등록해 주세요.
            </p>
          ) : null}

          {initialUploadResult ? (
            <SebiseoUploadResultCardView card={initialUploadResult} />
          ) : null}

          <SebiseoThread items={thread} />

          {error ? (
            <p className="text-[13px] text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <SebiseoComposer
        value={message}
        sending={sending}
        canAttach={canAttach}
        onValueChange={setMessage}
        onSubmit={() => {
          void sendChat()
        }}
        onPickFiles={onPickFiles}
      />

      <SebiseoPeriodConfirm
        open={periodOpen}
        fileNames={pendingFiles.map((file) => file.name)}
        options={periodOptions}
        selectedKey={selectedPeriodKey}
        uploading={uploading}
        onSelectedKeyChange={setSelectedPeriodKey}
        onConfirm={() => {
          void confirmPeriodAndUpload()
        }}
        onCancel={cancelPeriod}
      />
    </div>
  )
}

function ReferenceTaxScheduleCard({ item }: { readonly item: UpcomingScheduleItem | null }) {
  if (!item) {
    return (
      <div className="max-w-[300px] rounded-xl border border-company-border bg-company-surface px-3.5 py-3">
        <p className="text-[11.5px] font-semibold text-company-fg-subtle">세무 일정(참고)</p>
        <p className="mt-1.5 text-lg font-bold tracking-tight">일정 없음</p>
        <p className="mt-1 text-xs text-company-fg-muted">가까운 공통 법정 일정이 없습니다</p>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          공통 세무 일정입니다. 회사별 준비 상태가 아닙니다.
        </p>
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      className="block max-w-[300px] rounded-xl border border-company-border bg-company-surface px-3.5 py-3 transition-colors hover:border-company-border-strong"
    >
      <p className="text-[11.5px] font-semibold text-company-fg-subtle">세무 일정(참고)</p>
      <p className="mt-1.5 text-lg font-bold tracking-tight">{item.dateLabel}</p>
      <p className="mt-1 text-xs text-company-fg-muted">
        {item.title} · D-{item.dDay}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        공통 세무 일정입니다. 회사별 준비 상태가 아닙니다.
      </p>
    </Link>
  )
}
