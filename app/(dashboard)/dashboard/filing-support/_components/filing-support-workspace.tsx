import Link from 'next/link'
import { CheckCircle2, ClipboardList } from 'lucide-react'
import type {
  FilingReceiptRow,
  FilingSupportSummary,
} from '@/lib/filing-support/summary'
import { cn } from '@/lib/utils'
import { FilingReceiptDeleteButton, FilingReceiptUploadButton } from './filing-actions'
import { WithholdingEfilingPanel } from './withholding-efiling-panel'
import type { WithholdingEfilingSummary } from '@/lib/efiling-withholding/summary'

const panelClass = 'overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card'

export interface FilingSupportWorkspaceProps {
  readonly summary: FilingSupportSummary
  readonly withholdingEfiling?: WithholdingEfilingSummary | null
}

export function FilingSupportWorkspace({ summary, withholdingEfiling }: FilingSupportWorkspaceProps) {
  const withholdingReceipts = summary.receipts.filter((receipt) => receipt.itemType === 'withholding')

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <FilingTopbar summary={summary} />
      <div className="flex w-full max-w-[1200px] flex-col gap-5 px-7 pt-6 pb-12">
        {withholdingEfiling ? (
          <>
            <WithholdingEfilingPanel efiling={withholdingEfiling} />
            <ReceiptsCard periodKey={summary.period.filingPeriodKey} receipts={withholdingReceipts} />
          </>
        ) : (
          <FilingSupportEmptyState />
        )}
      </div>
    </div>
  )
}

function FilingTopbar({ summary }: FilingSupportWorkspaceProps) {
  const companyName = summary.businessEntity?.name ?? summary.tenant.name

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
      <div>
        <p className="text-[12.5px] font-medium text-company-fg-subtle">
          <Link href="/dashboard" className="hover:text-company-fg-muted hover:underline">회사 홈</Link>
          <span aria-hidden="true"> › </span>
          <Link href="/dashboard/payroll" className="hover:text-company-fg-muted hover:underline">급여·지급</Link>
          <span aria-hidden="true"> › </span>
          <span>원천세</span>
        </p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">원천세</h1>
      </div>
      <span className="text-[13px] font-medium text-company-fg-muted">{companyName}</span>
      <div className="ml-auto">
        <Link
          href={`/dashboard/filing-support?period=${summary.period.payrollPeriodKey}`}
          className="inline-flex items-center gap-2 rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium text-foreground"
        >
          {summary.period.payrollLabel}
          <span className="text-[11px] text-company-fg-subtle">▾</span>
        </Link>
      </div>
    </div>
  )
}

function ReceiptsCard({
  periodKey,
  receipts,
}: {
  readonly periodKey: string
  readonly receipts: FilingReceiptRow[]
}) {
  return (
    <section className={cn(panelClass, 'p-[18px]')}>
      <h2 className="text-[13px] font-semibold text-foreground">제출 접수증 보관</h2>
      <p className="mt-1 text-xs text-company-fg-subtle">홈택스 신고 후 접수증을 PDF로 저장해 업로드합니다</p>
      <div className="mt-3 grid gap-2.5">
        {receipts.map((receipt) => (
          <ReceiptRow key={receipt.id} periodKey={periodKey} receipt={receipt} />
        ))}
      </div>
    </section>
  )
}

function ReceiptRow({
  periodKey,
  receipt,
}: {
  readonly periodKey: string
  readonly receipt: FilingReceiptRow
}) {
  if (receipt.status === 'missing') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[9px] border border-dashed border-company-border px-3 py-3 text-[12.5px] text-company-fg-subtle">
        <span>{receipt.title} — {receipt.description}</span>
        <FilingReceiptUploadButton
          filingPeriodKey={periodKey}
          itemType={receipt.itemType}
          receiptType={receipt.receiptType}
          compact
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 rounded-[9px] border border-company-border px-3 py-2.5">
      <div className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-[#f0fdf4] text-[10px] font-bold text-[#16a34a]">
        PDF
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-foreground">{receipt.title}</p>
        <p className="text-[11px] text-company-fg-subtle">{receipt.description}</p>
      </div>
      <FilingReceiptDeleteButton receiptId={receipt.id} />
    </div>
  )
}

function FilingSupportEmptyState() {
  return (
    <section className={cn(panelClass, 'grid min-h-[240px] place-items-center p-8 text-center')}>
      <div>
        <ClipboardList className="mx-auto size-8 text-company-fg-subtle" />
        <h2 className="mt-3 text-base font-semibold text-foreground">아직 신고할 항목이 없습니다</h2>
        <p className="mt-1 text-[12.5px] text-company-fg-muted">급여를 마감하면 홈택스 원천세 입력값이 표시됩니다.</p>
        <div className="mt-4 flex justify-center">
          <Link href="/dashboard/payroll" className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[12px] font-semibold text-foreground">급여 열기</Link>
        </div>
      </div>
    </section>
  )
}

export function FilingSupportBusinessEntityEmptyState({ tenantName }: { readonly tenantName: string }) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 급여·지급 › 원천세</p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">원천세</h1>
      </div>
      <div className="px-7 pt-6">
        <div className="max-w-[720px] rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card">
          <BuildingIcon />
          <h2 className="mt-3 text-lg font-semibold text-foreground">사업장을 먼저 등록해 주세요</h2>
          <p className="mt-1 text-sm text-company-fg-muted">
            {tenantName}에 연결된 사업장이 있어야 신고 항목을 구성할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function BuildingIcon() {
  return (
    <div className="grid size-10 place-items-center rounded-xl bg-company-nav-hover text-company-fg-muted">
      <CheckCircle2 className="size-5" />
    </div>
  )
}
