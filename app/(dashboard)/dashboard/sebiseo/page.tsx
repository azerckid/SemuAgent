import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-helpers'
import { loadSourceCollectionSummary } from '@/lib/source-collection/summary'
import { buildSebiseoPeriodOptions } from '@/lib/sebiseo/period-options'
import { now } from '@/lib/time'
import { buildCurrentMonthScheduleSummary } from '@/lib/tax-calendar'
import { SebiseoWorkspace } from './_components/sebiseo-workspace'

export default async function SebiseoPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const tenantId = session.session.activeOrganizationId
  if (!tenantId) redirect('/onboarding')

  // 첫 화면 로드에서 LLM provider를 호출하지 않는다(JC-043 Trust Contract).
  const today = now('Asia/Seoul')
  const scheduleSummary = buildCurrentMonthScheduleSummary(today)
  const periodPayload = buildSebiseoPeriodOptions({ today })
  const summary = await loadSourceCollectionSummary({
    tenantId,
    periodKey: periodPayload.defaultKey,
  })

  return (
    <SebiseoWorkspace
      tenantId={tenantId}
      scheduleSummary={scheduleSummary}
      businessEntity={summary.businessEntity}
      periodOptions={periodPayload.options}
      defaultPeriodKey={periodPayload.defaultKey}
    />
  )
}
