import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function LedgerCellText({
  className,
  fallback = '-',
  value,
}: {
  readonly className?: string
  readonly fallback?: string
  readonly value: string | null | undefined
}) {
  const trimmed = value?.trim() ?? ''
  const label = trimmed || fallback

  return (
    <div className={cn('truncate', className)} title={trimmed || undefined}>
      {label}
    </div>
  )
}

export type ReconciliationLedgerTableVariant =
  | 'fixture_default'
  | 'fixture_tax'
  | 'live_default'
  | 'live_tax'

export function resolveReconciliationLedgerTableVariant(input: {
  taxInvoiceLayout: boolean
  surface: 'fixture' | 'live'
}): ReconciliationLedgerTableVariant {
  if (input.taxInvoiceLayout) {
    return input.surface === 'live' ? 'live_tax' : 'fixture_tax'
  }
  return input.surface === 'live' ? 'live_default' : 'fixture_default'
}

export function reconciliationLedgerColumnCount(variant: ReconciliationLedgerTableVariant) {
  if (variant === 'fixture_tax') return 10
  if (variant === 'live_tax') return 12
  if (variant === 'live_default') return 9
  return 8
}

export function reconciliationLedgerTableClassName(variant: ReconciliationLedgerTableVariant) {
  return cn(
    'w-full border-collapse text-left text-[12.5px] table-fixed',
    variant === 'live_tax' || variant === 'fixture_tax' ? 'min-w-[1220px]' : 'min-w-[980px]',
  )
}

export function ReconciliationLedgerColGroup({ variant }: { readonly variant: ReconciliationLedgerTableVariant }) {
  if (variant === 'fixture_tax') {
    return (
      <colgroup>
        <col className="w-[72px]" />
        <col className="w-[84px]" />
        <col className="w-[132px]" />
        <col className="w-[168px]" />
        <col className="w-[108px]" />
        <col className="w-[96px]" />
        <col className="w-[108px]" />
        <col className="w-[80px]" />
        <col className="w-[176px]" />
        <col className="w-[136px]" />
      </colgroup>
    )
  }

  if (variant === 'live_tax') {
    return (
      <colgroup>
        <col className="w-[72px]" />
        <col className="w-[84px]" />
        <col className="w-[140px]" />
        <col className="w-[168px]" />
        <col className="w-[104px]" />
        <col className="w-[92px]" />
        <col className="w-[104px]" />
        <col className="w-[76px]" />
        <col className="w-[156px]" />
        <col className="w-[120px]" />
        <col className="w-[92px]" />
        <col className="w-[92px]" />
      </colgroup>
    )
  }

  if (variant === 'live_default') {
    return (
      <colgroup>
        <col className="w-[72px]" />
        <col className="w-[108px]" />
        <col className="w-[156px]" />
        <col className="w-[220px]" />
        <col className="w-[112px]" />
        <col className="w-[168px]" />
        <col className="w-[128px]" />
        <col className="w-[96px]" />
        <col className="w-[96px]" />
      </colgroup>
    )
  }

  return (
    <colgroup>
      <col className="w-[72px]" />
      <col className="w-[108px]" />
      <col className="w-[160px]" />
      <col className="w-[220px]" />
      <col className="w-[112px]" />
      <col className="w-[168px]" />
      <col className="w-[128px]" />
      <col className="w-[188px]" />
    </colgroup>
  )
}

export function ReconciliationLedgerTableShell({
  variant,
  header,
  children,
}: {
  readonly variant: ReconciliationLedgerTableVariant
  readonly header: ReactNode
  readonly children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
      <div className="max-h-[520px] overflow-auto">
        <table className={reconciliationLedgerTableClassName(variant)}>
          <ReconciliationLedgerColGroup variant={variant} />
          <thead className="bg-[#fafafa] text-[11.5px] font-semibold text-company-fg-subtle">
            {header}
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  )
}

export function reconciliationLedgerEmptyRow(columnCount: number, message: string) {
  return (
    <tr>
      <td colSpan={columnCount} className="px-4 py-10 text-center text-company-fg-muted">
        {message}
      </td>
    </tr>
  )
}
