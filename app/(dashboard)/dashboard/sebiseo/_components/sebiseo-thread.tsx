import Link from 'next/link'

export type SebiseoThreadItem = {
  id: string
  kind: 'system' | 'user' | 'assistant'
  body: string
  tone?: 'normal' | 'refused' | 'error'
  href?: string
  hrefLabel?: string
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
          </div>
        </div>
      ))}
    </div>
  )
}
