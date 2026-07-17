import { redirect } from 'next/navigation'
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { uploadFile, uploadSession } from '@/lib/db/schema'
import { resolveSebiseoPeriodKeyFromAccountingPeriod } from '@/lib/sebiseo/period-options'
import { loadSourceCollectionSummary } from '@/lib/source-collection/summary'
import {
  SourceCollectionBusinessEntityEmptyState,
  SourceCollectionView,
} from './_components/source-collection'

type PageProps = {
  searchParams: Promise<{
    sessionId?: string
    period?: string
    fileId?: string
    action?: string
  }>
}

function extractRawToken(uploadUrl: string | null) {
  if (!uploadUrl) return null
  try {
    const parsed = new URL(uploadUrl)
    return parsed.pathname.split('/').filter(Boolean).pop() ?? null
  } catch {
    return uploadUrl.split('/').filter(Boolean).pop() ?? null
  }
}

async function loadUploadSession(params: {
  tenantId: string
  businessEntityId: string
  periodKey: string
  periodStartMonth: string
  periodEndMonth: string
  sessionId?: string | null
  fileId?: string | null
}) {
  if (params.fileId) {
    const fileSessionRows = await db
      .select({
        id: uploadSession.id,
        status: uploadSession.status,
        uploadUrl: uploadSession.uploadUrl,
        source: uploadSession.source,
        clientId: uploadSession.clientId,
        accountingPeriod: uploadSession.accountingPeriod,
      })
      .from(uploadFile)
      .innerJoin(uploadSession, eq(uploadFile.uploadSessionId, uploadSession.id))
      .where(and(
        eq(uploadFile.id, params.fileId),
        eq(uploadFile.tenantId, params.tenantId),
        eq(uploadSession.tenantId, params.tenantId),
        isNull(uploadSession.deletedAt),
      ))
      .limit(1)

    const row = fileSessionRows[0]
    if (!row || row.source !== 'staff_direct') return null
    if (row.clientId !== params.businessEntityId) return null
    const resolvedKey = resolveSebiseoPeriodKeyFromAccountingPeriod(row.accountingPeriod)
    if (!resolvedKey || resolvedKey !== params.periodKey) return null
    return {
      id: row.id,
      rawToken: extractRawToken(row.uploadUrl),
      status: row.status,
    }
  }

  if (params.sessionId) {
    const sessionRows = await db
      .select({
        id: uploadSession.id,
        status: uploadSession.status,
        uploadUrl: uploadSession.uploadUrl,
        source: uploadSession.source,
        clientId: uploadSession.clientId,
        accountingPeriod: uploadSession.accountingPeriod,
      })
      .from(uploadSession)
      .where(and(
        eq(uploadSession.id, params.sessionId),
        eq(uploadSession.tenantId, params.tenantId),
        isNull(uploadSession.deletedAt),
      ))
      .limit(1)

    const row = sessionRows[0]
    // CUI-4 §4.3: tenant already gated; also re-check business entity, source, period key.
    if (!row || row.source !== 'staff_direct' || row.clientId !== params.businessEntityId) {
      return null
    }
    const resolvedKey = resolveSebiseoPeriodKeyFromAccountingPeriod(row.accountingPeriod)
    if (!resolvedKey || resolvedKey !== params.periodKey) {
      return null
    }
    return {
      id: row.id,
      rawToken: extractRawToken(row.uploadUrl),
      status: row.status,
    }
  }

  const activeSessionRows = await db
    .select({
      id: uploadSession.id,
      status: uploadSession.status,
      uploadUrl: uploadSession.uploadUrl,
    })
    .from(uploadSession)
    .where(and(
      eq(uploadSession.tenantId, params.tenantId),
      eq(uploadSession.clientId, params.businessEntityId),
      eq(uploadSession.source, 'staff_direct'),
      isNull(uploadSession.deletedAt),
      gte(uploadSession.accountingPeriod, params.periodStartMonth),
      lte(uploadSession.accountingPeriod, params.periodEndMonth),
    ))
    .orderBy(desc(uploadSession.createdAt))
    .limit(1)

  const active = activeSessionRows[0]
  if (!active) return null

  return {
    id: active.id,
    rawToken: extractRawToken(active.uploadUrl),
    status: active.status,
  }
}

export default async function StaffDirectUploadPage({ searchParams }: PageProps) {
  const { sessionId, period, fileId, action } = await searchParams
  let tenantId: string
  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadSourceCollectionSummary({ tenantId, periodKey: period })

  if (!summary.businessEntity) {
    return <SourceCollectionBusinessEntityEmptyState tenantName={summary.tenant.name} />
  }

  const uploadSessionRow = await loadUploadSession({
    tenantId,
    businessEntityId: summary.businessEntity.id,
    periodKey: summary.period.key,
    periodStartMonth: summary.period.startMonth,
    periodEndMonth: summary.period.endMonth,
    sessionId,
    fileId,
  })

  // CUI-4 §4.3.3: invalid sessionId → strip and return to period default screen.
  if (sessionId && !uploadSessionRow && !fileId) {
    redirect(`/dashboard/direct-upload?period=${summary.period.key}`)
  }

  const uploadedFiles = uploadSessionRow
    ? await db
      .select({
        id: uploadFile.id,
        originalFilename: uploadFile.originalFilename,
        fileSize: uploadFile.fileSize,
        status: uploadFile.status,
        passwordStatus: uploadFile.passwordStatus,
        uploadedAt: uploadFile.uploadedAt,
      })
      .from(uploadFile)
      .where(and(
        eq(uploadFile.uploadSessionId, uploadSessionRow.id),
        eq(uploadFile.tenantId, tenantId),
      ))
      .orderBy(desc(uploadFile.uploadedAt))
    : []

  // CUI-4 §4.3.2: when sessionId is valid, import status table shows that session only.
  const importRows = sessionId && uploadSessionRow
    ? summary.importRows.filter((row) => row.uploadSessionId === uploadSessionRow.id)
    : summary.importRows

  return (
    <SourceCollectionView
      summary={{
        ...summary,
        importRows,
      }}
      uploadSession={uploadSessionRow}
      uploadedFiles={uploadedFiles}
      focusFileId={fileId ?? null}
      retryAction={action === 'retry'}
    />
  )
}
