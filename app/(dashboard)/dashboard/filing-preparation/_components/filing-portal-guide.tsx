import { ExternalLink } from 'lucide-react'

export type FilingPortalGuideItem = {
  portal: 'hometax' | 'wetax'
  scopeLabel: string
  readiness: 'ready' | 'source_pending'
  preparedValueLabel: string
  userActionLabel: string
  externalHref: string
}

const PORTAL_LABEL: Record<FilingPortalGuideItem['portal'], string> = {
  hometax: '홈택스',
  wetax: '위택스',
}

const READINESS_META: Record<FilingPortalGuideItem['readiness'], { label: string; className: string }> = {
  ready: {
    label: '입력값 준비',
    className: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
  },
  source_pending: {
    label: '공식 원본 입수 대기',
    className: 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]',
  },
}

export function FilingPortalGuide({ items }: { readonly items: readonly FilingPortalGuideItem[] }) {
  if (items.length === 0) return null

  return (
    <section
      aria-label="신고 포털 안내"
      className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card"
    >
      {items.map((item) => {
        const portalLabel = PORTAL_LABEL[item.portal]
        const readiness = READINESS_META[item.readiness]

        return (
          <article
            key={`${item.portal}-${item.scopeLabel}`}
            className="grid gap-3 border-b border-company-border px-[18px] py-4 last:border-b-0 md:grid-cols-[minmax(150px,0.9fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto] md:items-center md:gap-5"
            data-portal={item.portal}
            data-readiness={item.readiness}
          >
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-foreground">{portalLabel}</p>
              <p className="mt-0.5 text-[11.5px] text-company-fg-subtle">{item.scopeLabel}</p>
              <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${readiness.className}`}>
                {readiness.label}
              </span>
            </div>
            <GuideValue label="SemuAgent에서 준비" value={item.preparedValueLabel} />
            <GuideValue label="사용자가 수행" value={item.userActionLabel} />
            <a
              href={item.externalHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-company-nav-hover"
            >
              {portalLabel} 열기
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </article>
        )
      })}
    </section>
  )
}

function GuideValue({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-company-fg-subtle">{label}</p>
      <p className="mt-1 text-[12.5px] leading-5 text-foreground">{value}</p>
    </div>
  )
}
