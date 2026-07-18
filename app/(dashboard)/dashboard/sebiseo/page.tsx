import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-helpers'
import { loadSourceCollectionSummary } from '@/lib/source-collection/summary'
import { buildSebiseoPeriodOptions } from '@/lib/sebiseo/period-options'
import { loadCompanyScheduleApplicability } from '@/lib/sebiseo/schedule-summary'
import { now } from '@/lib/time'
import { buildCurrentMonthScheduleItems } from '@/lib/tax-calendar'
import { SebiseoWorkspace } from './_components/sebiseo-workspace'

export default async function SebiseoPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const tenantId = session.session.activeOrganizationId
  if (!tenantId) redirect('/onboarding')

  // 첫 화면 로드에서 LLM provider를 호출하지 않는다(JC-043 Trust Contract).
  const today = now('Asia/Seoul')
  const periodPayload = buildSebiseoPeriodOptions({ today })
  const summary = await loadSourceCollectionSummary({
    tenantId,
    periodKey: periodPayload.defaultKey,
  })
  const scheduleApplicability = summary.businessEntity
    ? await loadCompanyScheduleApplicability({
        tenantId,
        clientId: summary.businessEntity.id,
        vatPeriodKey: periodPayload.defaultKey,
        today,
      })
    : { vat: false, payroll: false }
  const scheduleItems = buildCurrentMonthScheduleItems(today, scheduleApplicability)

  return (
    <SebiseoWorkspace
      tenantId={tenantId}
      scheduleItems={scheduleItems}
      businessEntity={summary.businessEntity}
      periodOptions={periodPayload.options}
      defaultPeriodKey={periodPayload.defaultKey}
    />
  )
}
