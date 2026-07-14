import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export type PeriodContext = {
  label: string
  value: string
  previousHref?: string
  nextHref?: string
}

export function PeriodContextControl({ context }: { readonly context: PeriodContext }) {
  const hasNavigation = Boolean(context.previousHref || context.nextHref)

  return (
    <div
      aria-label={`${context.label}: ${context.value}`}
      className="inline-flex max-w-full shrink-0 items-stretch overflow-hidden rounded-lg border border-company-border-strong bg-company-surface"
      data-period-navigation={hasNavigation ? 'navigable' : 'read-only'}
    >
      {hasNavigation ? (
        <PeriodArrow href={context.previousHref} label="이전 기간" side="left">
          <ChevronLeft aria-hidden="true" className="size-4" />
        </PeriodArrow>
      ) : null}
      <div className="flex min-w-0 items-center gap-1.5 px-3 py-1.5 text-[12px]">
        <span className="shrink-0 text-company-fg-subtle">{context.label}</span>
        <strong className="truncate text-[12.5px] text-foreground">{context.value}</strong>
      </div>
      {hasNavigation ? (
        <PeriodArrow href={context.nextHref} label="다음 기간" side="right">
          <ChevronRight aria-hidden="true" className="size-4" />
        </PeriodArrow>
      ) : null}
    </div>
  )
}

function PeriodArrow({
  href,
  label,
  side,
  children,
}: {
  readonly href?: string
  readonly label: string
  readonly side: 'left' | 'right'
  readonly children: React.ReactNode
}) {
  const className = `grid size-8 shrink-0 place-items-center text-company-fg-muted ${side === 'left' ? 'border-r' : 'border-l'} border-company-border`

  if (!href) {
    return (
      <span aria-disabled="true" aria-label={label} className={`${className} text-company-fg-subtle`} title={label}>
        {children}
      </span>
    )
  }

  return (
    <Link
      aria-label={label}
      className={`${className} hover:bg-company-nav-hover hover:text-foreground`}
      href={href}
      title={label}
    >
      {children}
    </Link>
  )
}
