'use client'

import type { SebiseoPeriodOption } from '@/lib/sebiseo/period-options'

type Props = {
  readonly open: boolean
  readonly fileNames: readonly string[]
  readonly options: readonly SebiseoPeriodOption[]
  readonly selectedKey: string
  readonly uploading: boolean
  readonly onSelectedKeyChange: (key: string) => void
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function SebiseoPeriodConfirm({
  open,
  fileNames,
  options,
  selectedKey,
  uploading,
  onSelectedKeyChange,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null

  const selected = options.find((option) => option.key === selectedKey) ?? options[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !uploading) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sebiseo-period-confirm-title"
        className="w-full max-w-md rounded-2xl border border-company-border bg-company-surface p-5 text-foreground shadow-xl"
      >
        <h2 id="sebiseo-period-confirm-title" className="text-[16px] font-semibold">
          적용 기간 확인
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-company-fg-muted">
          파일이 들어갈 신고·기장 기간을 확인한 뒤에만 업로드합니다. 기본값을 그대로 쓰지 마시고
          자료 귀속 기간이 맞는지 확인해 주세요.
        </p>

        <p className="mt-4 text-[13px] font-medium text-foreground">
          적용 기간: {selected?.confirmLabel ?? '—'}
        </p>
        <p className="mt-1 text-[12px] text-company-fg-subtle">{selected?.detailLabel}</p>

        <label className="mt-4 block text-[12px] font-semibold text-company-fg-subtle" htmlFor="sebiseo-period-select">
          변경
        </label>
        <select
          id="sebiseo-period-select"
          value={selectedKey}
          disabled={uploading}
          onChange={(event) => onSelectedKeyChange(event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-company-border bg-company-bg px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-ring"
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.confirmLabel} — {option.detailLabel}
            </option>
          ))}
        </select>

        <div className="mt-4 rounded-xl border border-company-border bg-company-bg px-3 py-2.5">
          <p className="text-[11px] font-semibold text-company-fg-subtle">선택 파일</p>
          <ul className="mt-1.5 space-y-1 text-[13px] text-company-fg-muted">
            {fileNames.map((name) => (
              <li key={name} className="truncate">
                {name}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-[13px] font-medium text-company-fg-muted hover:bg-company-nav-hover disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={uploading || !selected}
            onClick={onConfirm}
            className="rounded-full bg-foreground px-4 py-2 text-[13px] font-semibold text-background hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? '업로드 중…' : '확인 후 업로드'}
          </button>
        </div>
      </div>
    </div>
  )
}
