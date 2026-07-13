import Link from 'next/link'
import type {
  PaymentStatementBlocker,
  PaymentStatementTone,
} from '@/lib/payment-statements/summary'

const CHIP_TONE: Record<PaymentStatementTone, string> = {
  ok: 'text-[#16a34a] bg-[#f0fdf4] border-[#bbf7d0]',
  warn: 'text-[#d97706] bg-[#fffbeb] border-[#fde68a]',
  danger: 'text-[#dc2626] bg-[#fef2f2] border-[#fecaca]',
  muted: 'text-company-fg-muted bg-[#f4f4f5] border-company-border',
}

interface ReviewChipProps {
  readonly tone: PaymentStatementTone
  readonly children: React.ReactNode
}

export function ReviewChip({ tone, children }: ReviewChipProps) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${CHIP_TONE[tone]}`}>
      {children}
    </span>
  )
}

interface ReviewHeroMetricProps {
  readonly label: string
  readonly value: string
}

export function ReviewHeroMetric({ label, value }: ReviewHeroMetricProps) {
  return (
    <div className="rounded-[10px] border border-company-border bg-[#fcfcfd] px-3 py-2.5">
      <p className="text-[11px] text-company-fg-subtle">{label}</p>
      <p className="mt-0.5 text-lg font-bold tracking-tight">{value}</p>
    </div>
  )
}

interface ReviewSectionHeadProps {
  readonly title: string
  readonly hint: string
}

export function ReviewSectionHead({ title, hint }: ReviewSectionHeadProps) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <span className="text-xs text-company-fg-subtle">{hint}</span>
    </div>
  )
}

interface ReviewTableHeadCellProps {
  readonly children: React.ReactNode
  readonly right?: boolean
}

export function ReviewTableHeadCell({ children, right }: ReviewTableHeadCellProps) {
  return (
    <th className={`whitespace-nowrap border-b border-company-border px-[18px] py-2.5 font-bold ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

interface ReviewEmployeeCellProps {
  readonly name: string
  readonly code: string | null
}

export function ReviewEmployeeCell({ name, code }: ReviewEmployeeCellProps) {
  return (
    <td className="whitespace-nowrap border-b border-company-border px-[18px] py-2.5">
      <div className="text-[13px] font-semibold">{name}</div>
      {code ? <div className="text-[11px] text-company-fg-subtle">{code}</div> : null}
    </td>
  )
}

export function ReviewNumberCell({ children }: { readonly children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap border-b border-company-border px-[18px] py-2.5 text-right tabular-nums">
      {children}
    </td>
  )
}

export function ReviewCell({ children }: { readonly children: React.ReactNode }) {
  return <td className="whitespace-nowrap border-b border-company-border px-[18px] py-2.5">{children}</td>
}

export function ReviewBlockers({ blockers }: { readonly blockers: PaymentStatementBlocker[] }) {
  if (blockers.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
      {blockers.map((blocker) => (
        <div key={blocker.id} className="grid grid-cols-[12px_1fr_auto] items-center gap-3.5 border-b border-company-border px-[18px] py-3.5 last:border-b-0">
          <span className={`size-2 rounded-full ${blocker.tone === 'danger' ? 'bg-[#dc2626]' : 'bg-[#d97706]'}`} />
          <div>
            <p className="text-[13.5px] font-semibold">{blocker.title}</p>
            <p className="mt-0.5 text-xs text-company-fg-subtle">{blocker.description}</p>
          </div>
          <Link
            href={blocker.href}
            className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold ${blocker.tone === 'danger' ? 'border-[#18181b] bg-[#18181b] text-white' : 'border-company-border-strong bg-company-surface'}`}
          >
            {blocker.ctaLabel}
          </Link>
        </div>
      ))}
    </section>
  )
}
