import Link from 'next/link'

export type ActionBlockerItem = {
  id: string
  title: string
  description: string
  tone: 'warn' | 'danger'
  href: string
  ctaLabel: string
}

export function ActionBlockerList({ items }: { readonly items: readonly ActionBlockerItem[] }) {
  if (items.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
      {items.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-[10px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 border-b border-company-border px-[18px] py-3.5 last:border-b-0 sm:grid-cols-[10px_minmax(0,1fr)_auto]"
        >
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${item.tone === 'danger' ? 'bg-[#dc2626]' : 'bg-[#d97706]'}`}
          />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold">{item.title}</p>
            <p className="mt-0.5 text-xs text-company-fg-subtle">{item.description}</p>
          </div>
          <Link
            href={item.href}
            className={`col-start-2 justify-self-start whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold sm:col-start-3 sm:row-start-1 sm:justify-self-end ${item.tone === 'danger' ? 'border-[#18181b] bg-[#18181b] text-white' : 'border-company-border-strong bg-company-surface'}`}
          >
            {item.ctaLabel}
          </Link>
        </div>
      ))}
    </section>
  )
}
