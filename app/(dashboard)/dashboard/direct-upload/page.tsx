import { redirect } from 'next/navigation'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, payrollExtractionBatch, staff, uploadFile, uploadSession } from '@/lib/db/schema'
import { StaffDirectUploadWorkspace } from './staff-direct-upload-workspace'

type PageProps = {
  searchParams: Promise<{ kind?: string; sessionId?: string }>
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

export default async function StaffDirectUploadPage({ searchParams }: PageProps) {
  const { kind, sessionId } = await searchParams
  let tenantId: string
  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const clientRows = await db
    .select({
      id: client.id,
      name: client.name,
      email: client.email,
      contactName: client.contactName,
      staffName: staff.name,
    })
    .from(client)
    .leftJoin(staff, and(eq(client.staffId, staff.id), eq(staff.tenantId, tenantId)))
    .where(eq(client.tenantId, tenantId))
    .orderBy(desc(client.createdAt))

  const directSession = sessionId
    ? await db
      .select({
        id: uploadSession.id,
        clientId: uploadSession.clientId,
        accountingPeriod: uploadSession.accountingPeriod,
        status: uploadSession.status,
        requestKind: uploadSession.requestKind,
        requestEventId: uploadSession.requestEventId,
        uploadUrl: uploadSession.uploadUrl,
        expiresAt: uploadSession.expiresAt,
        source: uploadSession.source,
        staffDirectLabel: uploadSession.staffDirectLabel,
        clientName: client.name,
      })
      .from(uploadSession)
      .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
      .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
      .limit(1)
    : []

  const selectedSession = directSession[0] ?? null
  if (sessionId && (!selectedSession || selectedSession.source !== 'staff_direct')) {
    redirect('/dashboard/direct-upload')
  }

  const files = selectedSession
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
      .where(and(eq(uploadFile.uploadSessionId, selectedSession.id), eq(uploadFile.tenantId, tenantId)))
      .orderBy(desc(uploadFile.uploadedAt))
    : []

  const latestPayrollBatch = selectedSession?.requestKind === 'payroll'
    ? await db
      .select({
        status: payrollExtractionBatch.status,
        errorMessage: payrollExtractionBatch.errorMessage,
        createdAt: payrollExtractionBatch.createdAt,
      })
      .from(payrollExtractionBatch)
      .where(and(eq(payrollExtractionBatch.uploadSessionId, selectedSession.id), eq(payrollExtractionBatch.tenantId, tenantId)))
      .orderBy(desc(payrollExtractionBatch.createdAt))
      .limit(1)
    : []

  const selectedClientLabel = selectedSession?.staffDirectLabel ?? null
  const resultPath = selectedSession?.requestKind === 'payroll'
    ? `/dashboard/payroll${selectedSession.requestEventId ? `?eventId=${selectedSession.requestEventId}` : ''}`
    : `/dashboard/reviews?sessionId=${selectedSession?.id ?? ''}`

  return (
    <StaffDirectUploadWorkspace
      clients={clientRows}
      initialWorkType={kind === 'payroll' ? 'payroll' : kind === 'vat' ? 'vat' : 'bookkeeping'}
      session={selectedSession
        ? {
          ...selectedSession,
          clientName: selectedClientLabel ?? selectedSession.clientName,
          rawToken: extractRawToken(selectedSession.uploadUrl),
          resultPath,
          payrollExtractionStatus: latestPayrollBatch[0]?.status ?? null,
          payrollExtractionCreatedAt: latestPayrollBatch[0]?.createdAt ?? null,
          payrollExtractionErrorMessage: latestPayrollBatch[0]?.errorMessage ?? null,
        }
        : null}
      uploadedFiles={files}
    />
  )
}
