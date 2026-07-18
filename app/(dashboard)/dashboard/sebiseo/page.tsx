import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-helpers'
import { loadSourceCollectionSummary } from '@/lib/source-collection/summary'
import { buildSebiseoPeriodOptions } from '@/lib/sebiseo/period-options'
import { loadSebiseoUploadResultCard } from '@/lib/sebiseo/upload-result'
import { now } from '@/lib/time'
import { buildUpcomingSchedule } from '@/lib/tax-calendar'
import { SebiseoWorkspace } from './_components/sebiseo-workspace'

export default async function SebiseoPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const tenantId = session.session.activeOrganizationId
  if (!tenantId) redirect('/onboarding')

  // 첫 화면 로드에서 LLM provider를 호출하지 않는다(JC-043 Trust Contract).
  const [upcoming = null] = buildUpcomingSchedule(now('Asia/Seoul'), 1)
  const periodPayload = buildSebiseoPeriodOptions({ today: now('Asia/Seoul') })
  const summary = await loadSourceCollectionSummary({
    tenantId,
    periodKey: periodPayload.defaultKey,
  })
  const uploadResult = summary.businessEntity
    ? await loadSebiseoUploadResultCard({
      tenantId,
      businessEntityId: summary.businessEntity.id,
    })
    : null

  return (
    <SebiseoWorkspace
      tenantId={tenantId}
      upcoming={upcoming}
      businessEntity={summary.businessEntity}
      periodOptions={periodPayload.options}
      defaultPeriodKey={periodPayload.defaultKey}
      initialUploadResult={uploadResult}
    />
  )
}
