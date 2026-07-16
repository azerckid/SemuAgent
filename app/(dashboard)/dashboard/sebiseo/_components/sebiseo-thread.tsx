import Link from 'next/link'
import type { SebiseoSuggestedAction } from '@/lib/sebiseo/chat/schemas'

export type SebiseoThreadItem = {
  id: string
  kind: 'system' | 'user' | 'assistant'
  body: string
  tone?: 'normal' | 'refused' | 'error'
  href?: string
  hrefLabel?: string
  // CUI-3c: 허용된 답변 아래 표시하는 화면 이동 버튼(최대 2). 이동만 하고 데이터 변경은 없다.
  actions?: readonly SebiseoSuggestedAction[]
}

export function SebiseoThread({ items }: { readonly items: readonly SebiseoThreadItem[] }) {
  return (
    <div className="space-y-3" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          className={item.kind === 'user' ? 'flex justify-end' : 'flex justify-start'}
        >
          <div
            className={[
              'max-w-[88%] rounded-2xl px-3.5 py-3 text-[14px] leading-relaxed',
              item.kind === 'user'
                ? 'bg-[#303030] text-[#ececec]'
                : 'border border-[#303030] bg-[#212121] text-[#ececec]',
              item.tone === 'error' ? 'border-[#7f1d1d] text-[#fecaca]' : '',
              item.tone === 'refused' ? 'border-[#713f12] text-[#fde68a]' : '',
            ].join(' ')}
          >
            <p className="whitespace-pre-wrap">{item.body}</p>
            {item.href && item.hrefLabel ? (
              <Link
                href={item.href}
                className="mt-2 inline-flex text-[13px] font-semibold text-[#93c5fd] underline-offset-2 hover:underline"
              >
                {item.hrefLabel}
              </Link>
            ) : null}
            {item.actions && item.actions.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {item.actions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="inline-flex items-center rounded-lg border border-[#3a3a3a] bg-[#2a2a2a] px-3 py-1.5 text-[13px] font-semibold text-[#93c5fd] transition-colors hover:border-[#4a4a4a] hover:bg-[#303030]"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
