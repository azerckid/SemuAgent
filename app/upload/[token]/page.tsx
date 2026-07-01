import { verifyToken, getPortalData } from '@/lib/session'
import { listSessionItemDeclarations } from '@/lib/upload/item-declaration'
import { resolveUploadPortalStatus } from '@/lib/upload/portal-status'
import { fromISO } from '@/lib/time'
import { UploadPortal } from './_components/upload-portal'
import { TransactionPurposePortal } from './_components/transaction-purpose-portal'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ purposeRequest?: string | string[] }>
}

export default async function UploadPortalPage({ params, searchParams }: Props) {
  const { token: rawToken } = await params
  const resolvedSearchParams = await searchParams
  const purposeRequestParam = Array.isArray(resolvedSearchParams.purposeRequest)
    ? resolvedSearchParams.purposeRequest[0]
    : resolvedSearchParams.purposeRequest

  if (purposeRequestParam) {
    return <TransactionPurposePortal rawToken={rawToken} purposeRequestId={purposeRequestParam} />
  }

  const session = await verifyToken(rawToken)

  if (!session) {
    return <ExpiredPage />
  }

  const data = await getPortalData(session.id, session.tenantId)

  if (!data) {
    return <ExpiredPage />
  }

  const { tenant, client, staff, checklistItems, uploadedFiles, materialMatches } = data

  const declarations = await listSessionItemDeclarations({ tenantId: session.tenantId, uploadSessionId: session.id })
  const declarationByItemId = new Map(declarations.map((d) => [d.checklistItemId, d]))

  const portalStatus = resolveUploadPortalStatus({
    session: {
      id: session.id,
      clientId: session.clientId,
      clientName: client.name,
      clientEmail: client.email,
      staffName: staff.name,
      accountingPeriod: session.accountingPeriod,
      status: session.status,
      hasSessionEvaluation: Boolean(session.sessionEvaluation),
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      requestEmailSubject: session.requestEmailSubject,
      requestEmailBody: session.requestEmailBody,
      source: session.source,
      requestKind: session.requestKind,
      bookkeepingPeriodType: session.bookkeepingPeriodType,
      bookkeepingPeriodStart: session.bookkeepingPeriodStart,
      bookkeepingPeriodEnd: session.bookkeepingPeriodEnd,
    },
    checklistItems,
    uploadedFiles,
    materialMatches,
    requestItemValidations: data.requestItemValidations,
    requestItemValidationFiles: data.requestItemValidationFiles,
    analysisRuns: data.analysisRuns,
  })

  const resolvedItems = portalStatus.checklistItems.map((item) => {
    const declared = declarationByItemId.get(item.id) ?? null
    return {
      ...item,
      declaration: item.status === 'pending' ? declared?.declaration ?? null : null,
      declarationNote: item.status === 'pending' ? declared?.note ?? null : null,
    }
  })

  const formattedPeriod = formatAccountingPeriod(session.accountingPeriod)
  const formattedExpiry = fromISO(session.expiresAt).toFormat('yyyy년 M월 d일')

  return (
    <UploadPortal
      rawToken={rawToken}
      tenantName={tenant.name}
      staffName={staff.name}
      accountingPeriod={formattedPeriod}
      requestKind={session.requestKind}
      expiresAt={formattedExpiry}
      sessionStatus={session.status}
      checklistItems={resolvedItems}
      uploadedFiles={uploadedFiles.map((f) => ({
        id: f.id,
        originalFilename: f.originalFilename,
        fileSize: f.fileSize,
        status: f.status,
        passwordStatus: f.passwordStatus,
        uploadedAt: f.uploadedAt,
        matchedItemName: portalStatus.matchedItemNameByFileId.get(f.id) ?? null,
        isUnlinked: portalStatus.unlinkedFileIds.has(f.id),
      }))}
    />
  )
}

function ExpiredPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          이 자료 요청은 더 이상 유효하지 않습니다
        </h1>
        <p className="text-sm text-gray-500">
          제출 기간이 종료되었거나 담당자가 요청을 삭제했습니다.
          <br />
          필요한 경우 담당 회계사에게 문의해 주세요.
        </p>
      </div>
    </div>
  )
}

function formatAccountingPeriod(period: string): string {
  const [year, month] = period.split('-')
  return `${year}년 ${parseInt(month, 10)}월`
}
