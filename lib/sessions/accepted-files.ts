import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  materialMatch,
  requestItemValidation,
  requestItemValidationFile,
  uploadFile,
} from '@/lib/db/schema'

export type AcceptedFileSummary = {
  id: string
  originalFilename: string
  fileType: string
  fileSize: number
  uploadedAt: string
}

export type AcceptedStoredFile = AcceptedFileSummary & {
  storageKey: string
}

export type AcceptedFileSelectionMode = 'validation_file' | 'material_match' | 'none'

const ACCEPTED_MATCH_STATUSES = ['matched', 'manual_approved'] as const

type SelectableFile = AcceptedFileSummary
type SelectableValidation = {
  id: string
  validationStatus: string
}
type SelectableValidationFile = {
  validationId: string
  uploadFileId: string
  contribution: string | null
}
type SelectableMatch = {
  uploadFileId: string
  status: string
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  const map = new Map<string, T>()
  for (const row of rows) {
    if (!map.has(row.id)) map.set(row.id, row)
  }
  return [...map.values()]
}

export function deriveAcceptedFileSummaries({
  files,
  validations,
  validationFiles,
  matches = [],
}: {
  files: SelectableFile[]
  validations: SelectableValidation[]
  validationFiles: SelectableValidationFile[]
  matches?: SelectableMatch[]
}): {
  files: AcceptedFileSummary[]
  mode: AcceptedFileSelectionMode
} {
  const fileById = new Map(files.map((file) => [file.id, file]))
  const satisfiedValidationIds = new Set(
    validations
      .filter((validation) => validation.validationStatus === 'satisfied')
      .map((validation) => validation.id),
  )

  const acceptedByValidation = validationFiles
    .filter((link) => (
      satisfiedValidationIds.has(link.validationId) &&
      link.contribution === 'satisfied' &&
      fileById.has(link.uploadFileId)
    ))
    .map((link) => fileById.get(link.uploadFileId))
    .filter(Boolean) as AcceptedFileSummary[]

  if (acceptedByValidation.length > 0) {
    return {
      files: uniqueById(acceptedByValidation),
      mode: 'validation_file',
    }
  }

  const acceptedByMatch = matches
    .filter((match) => (
      ACCEPTED_MATCH_STATUSES.includes(match.status as typeof ACCEPTED_MATCH_STATUSES[number]) &&
      fileById.has(match.uploadFileId)
    ))
    .map((match) => fileById.get(match.uploadFileId))
    .filter(Boolean) as AcceptedFileSummary[]

  if (acceptedByMatch.length > 0) {
    return {
      files: uniqueById(acceptedByMatch),
      mode: 'material_match',
    }
  }

  return {
    files: [],
    mode: 'none',
  }
}

export async function getAcceptedStoredFilesForSession({
  sessionId,
  tenantId,
}: {
  sessionId: string
  tenantId: string
}): Promise<{
  files: AcceptedStoredFile[]
  mode: AcceptedFileSelectionMode
}> {
  const validationRows = await db
    .select({
      id: uploadFile.id,
      originalFilename: uploadFile.originalFilename,
      fileType: uploadFile.fileType,
      fileSize: uploadFile.fileSize,
      uploadedAt: uploadFile.uploadedAt,
      storageKey: uploadFile.storageKey,
    })
    .from(requestItemValidationFile)
    .innerJoin(
      requestItemValidation,
      and(
        eq(requestItemValidationFile.validationId, requestItemValidation.id),
        eq(requestItemValidation.tenantId, tenantId),
      ),
    )
    .innerJoin(
      uploadFile,
      and(
        eq(requestItemValidationFile.uploadFileId, uploadFile.id),
        eq(uploadFile.tenantId, tenantId),
        eq(uploadFile.uploadSessionId, sessionId),
      ),
    )
    .where(
      and(
        eq(requestItemValidationFile.tenantId, tenantId),
        eq(requestItemValidation.uploadSessionId, sessionId),
        eq(requestItemValidation.validationStatus, 'satisfied'),
        eq(requestItemValidationFile.contribution, 'satisfied'),
      ),
    )
    .orderBy(uploadFile.uploadedAt)

  if (validationRows.length > 0) {
    return {
      files: uniqueById(validationRows),
      mode: 'validation_file',
    }
  }

  const matchRows = await db
    .select({
      id: uploadFile.id,
      originalFilename: uploadFile.originalFilename,
      fileType: uploadFile.fileType,
      fileSize: uploadFile.fileSize,
      uploadedAt: uploadFile.uploadedAt,
      storageKey: uploadFile.storageKey,
    })
    .from(materialMatch)
    .innerJoin(
      uploadFile,
      and(
        eq(materialMatch.uploadFileId, uploadFile.id),
        eq(uploadFile.tenantId, tenantId),
        eq(uploadFile.uploadSessionId, sessionId),
      ),
    )
    .where(
      and(
        eq(materialMatch.tenantId, tenantId),
        inArray(materialMatch.status, [...ACCEPTED_MATCH_STATUSES]),
      ),
    )
    .orderBy(uploadFile.uploadedAt)

  if (matchRows.length > 0) {
    return {
      files: uniqueById(matchRows),
      mode: 'material_match',
    }
  }

  return {
    files: [],
    mode: 'none',
  }
}
