import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getOrCreateFiscalYearLedgerSummary } from '@/lib/bookkeeping/fiscal-year-ledger'
import { listAccumulatedJournalVouchers, toJournalEntryExportLines } from '@/lib/bookkeeping/fiscal-year-ledger-journal-view'
import { db } from '@/lib/db'
import { client } from '@/lib/db/schema'
import { now } from '@/lib/time'
import { LedgerJournalEntryWorkspace } from './ledger-journal-entry-workspace'

const searchParamsSchema = z.object({
  period: z.string().trim().min(1).optional(),
})

export default async function ClientBookkeepingLedgerJournalEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tenantId } = await requireTenantSession()
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const parsedSearchParams = searchParamsSchema.safeParse({
    period: Array.isArray(resolvedSearchParams?.period) ? resolvedSearchParams?.period[0] : resolvedSearchParams?.period,
  })
  const period = parsedSearchParams.success ? parsedSearchParams.data.period : undefined

  const [clientRow] = await db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(and(eq(client.id, id), eq(client.tenantId, tenantId)))
    .limit(1)

  if (!clientRow) notFound()

  const fiscalYear = period ? Number(period.slice(0, 4)) : now().setZone('Asia/Seoul').year
  if (!Number.isInteger(fiscalYear)) notFound()

  const ledgerSummary = await getOrCreateFiscalYearLedgerSummary({ tenantId, clientId: id, fiscalYear })
  if (!ledgerSummary) notFound()

  const result = await listAccumulatedJournalVouchers({ tenantId, ledgerId: ledgerSummary.ledger.id, period })
  if (!result.ok) notFound()

  const voucherLines = toJournalEntryExportLines(result.vouchers)

  return (
    <LedgerJournalEntryWorkspace
      clientId={id}
      clientName={clientRow.name}
      ledgerId={ledgerSummary.ledger.id}
      fiscalYear={ledgerSummary.ledger.fiscalYear}
      periodLabel={result.period.label}
      periodValue={period ?? String(fiscalYear)}
      voucherLines={voucherLines}
      sessionCount={result.sessionCount}
      staleVoucherCount={result.staleVoucherCount}
    />
  )
}
