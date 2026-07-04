import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadPaymentStatementSummary } from '@/lib/payment-statements/summary'
import { PaymentStatementEmptyState, PaymentStatementReview } from './_components/payment-statement-review'

type PageProps = {
  searchParams: Promise<{
    period?: string
  }>
}

export default async function PaymentStatementsPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadPaymentStatementSummary({ tenantId, periodKey: period })

  if (!summary.businessEntity) {
    return <PaymentStatementEmptyState tenantName={summary.tenant.name} />
  }

  return <PaymentStatementReview summary={summary} />
}
