'use client'

import { useRef } from 'react'
import { ArrowUp, AudioLines, ChevronDown, Mic, Plus } from 'lucide-react'
import { SEBISEO_MESSAGE_MAX_LENGTH } from '@/lib/sebiseo/chat/schemas'
import {
  UPLOAD_ALLOWED_ACCEPT,
  UPLOAD_ALLOWED_TYPES_HINT,
} from '@/lib/upload/allowed-content-types'

const COMING_SOON = '준비 중 · 곧 연결됩니다'

type Props = {
  readonly value: string
  readonly sending: boolean
  readonly canAttach: boolean
  readonly onValueChange: (value: string) => void
  readonly onSubmit: () => void
  readonly onPickFiles: (files: FileList | null) => void
}

export function SebiseoComposer({
  value,
  sending,
  canAttach,
  onValueChange,
  onSubmit,
  onPickFiles,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canSubmit = value.trim().length > 0 && !sending

  return (
    <div className="sticky bottom-0 bg-gradient-to-t from-[#171717] via-[#171717] to-transparent px-4 pt-8 pb-[18px]">
      <p className="mb-1.5 text-center text-xs text-[#8e8e8e]">
        세비서도 실수할 수 있습니다. 중요한 정보는 다시 확인하세요.
      </p>
      <p className="mb-2.5 text-center text-xs text-[#8e8e8e]">
        Instant·음성은 준비 중입니다. 대화와 파일 첨부를 사용할 수 있습니다.
      </p>
      <div
        className="mx-auto flex min-h-[52px] w-full max-w-[768px] items-end gap-0.5 rounded-[28px] border border-[#303030] bg-[#212121] py-1.5 pr-2 pl-1.5"
        role="group"
        aria-label="세비서 메시지 입력"
      >
        <button
          type="button"
          disabled={!canAttach}
          aria-label={canAttach ? '파일 첨부' : `첨부 · ${COMING_SOON}`}
          title={canAttach ? '파일 첨부' : COMING_SOON}
          onClick={() => fileInputRef.current?.click()}
          className="grid size-9 shrink-0 place-items-center rounded-full text-[#ececec] hover:bg-[#2f2f2f] disabled:cursor-not-allowed disabled:text-[#6e6e6e] disabled:opacity-50"
        >
          <Plus className="size-5" strokeWidth={1.5} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={UPLOAD_ALLOWED_ACCEPT}
          className="hidden"
          disabled={!canAttach}
          onChange={(event) => {
            onPickFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <textarea
          value={value}
          rows={1}
          maxLength={SEBISEO_MESSAGE_MAX_LENGTH}
          disabled={sending}
          aria-label="세비서에게 묻기"
          placeholder="세비서에게 묻기"
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (canSubmit) onSubmit()
            }
          }}
          className="max-h-32 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2 text-[15px] text-[#ececec] outline-none placeholder:text-[#6e6e6e] disabled:opacity-60"
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            disabled
            title={COMING_SOON}
            aria-label={`Instant · ${COMING_SOON}`}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-[#6e6e6e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Instant
            <ChevronDown className="size-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            disabled
            title={COMING_SOON}
            aria-label={`음성 입력 · ${COMING_SOON}`}
            className="grid size-9 place-items-center rounded-full text-[#6e6e6e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mic className="size-[18px]" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            title={canSubmit ? '메시지 보내기' : undefined}
            aria-label={sending ? '답변 기다리는 중' : '메시지 보내기'}
            className="grid size-9 place-items-center rounded-full bg-white text-[#0d0d0d] hover:bg-[#e8e8e8] disabled:cursor-not-allowed disabled:bg-[#3a3a3a] disabled:text-[#8e8e8e]"
          >
            {sending ? (
              <span className="size-4 animate-spin rounded-full border-2 border-[#8e8e8e] border-t-transparent" />
            ) : (
              <ArrowUp className="size-4" strokeWidth={2} />
            )}
          </button>
          <button
            type="button"
            disabled
            title={COMING_SOON}
            aria-label={`음성 모드 · ${COMING_SOON}`}
            className="grid size-9 place-items-center rounded-full bg-[#3a3a3a] text-[#8e8e8e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <AudioLines className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-[768px] text-center text-[11px] text-[#6e6e6e]">
        {UPLOAD_ALLOWED_TYPES_HINT}
      </p>
    </div>
  )
}
