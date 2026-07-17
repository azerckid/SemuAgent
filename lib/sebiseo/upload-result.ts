import 'server-only'

import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { uploadFile, uploadSession } from '@/lib/db/schema'
import {
  buildSebiseoUploadResultCardFromCounts,
  type SebiseoUploadResultCardOrNull,
} from '@/lib/sebiseo/upload-result-schema'

export type {
  SebiseoUploadResultCard,
  SebiseoUploadResultCardOrNull,
} from '@/lib/sebiseo/upload-result-schema'
export {
  buildSebiseoUploadResultCardFromCounts,
  buildSebiseoUploadResultCtaHref,
  buildSebiseoUploadResultCtaLabel,
  countSebiseoUploadFileStatuses,
  sebiseoUploadResultCardSchema,
} from '@/lib/sebiseo/upload-result-schema'

export async function loadSebiseoUploadResultCard(params: {
  tenantId: string
  businessEntityId: string
}): Promise<SebiseoUploadResultCardOrNull> {
  const sessionRows = await db
    .select({
      id: uploadSession.id,
      accountingPeriod: uploadSession.accountingPeriod,
    })
    .from(uploadSession)
    .where(and(
      eq(uploadSession.tenantId, params.tenantId),
      eq(uploadSession.clientId, params.businessEntityId),
      eq(uploadSession.source, 'staff_direct'),
      isNull(uploadSession.deletedAt),
    ))
    .orderBy(desc(uploadSession.createdAt))
    .limit(1)

  const session = sessionRows[0]
  if (!session) return null

  const fileRows = await db
    .select({ status: uploadFile.status })
    .from(uploadFile)
    .where(and(
      eq(uploadFile.uploadSessionId, session.id),
      eq(uploadFile.tenantId, params.tenantId),
    ))

  return buildSebiseoUploadResultCardFromCounts({
    sessionId: session.id,
    accountingPeriod: session.accountingPeriod,
    files: fileRows,
  })
}
