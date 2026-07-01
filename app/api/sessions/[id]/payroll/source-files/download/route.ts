import { get } from '@vercel/blob'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import {
  payrollExtractionBatch,
  payrollExtractionRow,
  staff,
  uploadFile,
  uploadSession,
} from '@/lib/db/schema'
import { createZipArchive } from '@/lib/files/zip'
import {
  derivePayrollSourceDownloadState,
  parsePayrollSourceFileIds,
} from '@/lib/sessions/payroll-source-download'

type StoredPayrollFile = {
  id: string
  originalFilename: string
  storageKey: string
  fileType: string
}

const querySchema = z.object({
  fileId: z.string().min(1).optional(),
})

function contentDisposition(filename: string) {
  const fallback = filename
    .replace(/[\\/\r\n"]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .slice(0, 120) || 'payroll-source'

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function contentTypeFor(fileType: string) {
  switch (fileType) {
    case 'pdf':
      return 'application/pdf'
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'image':
      return 'image/*'
    default:
      return 'application/octet-stream'
  }
}

function zipFilename(accountingPeriod: string, sessionId: string) {
  const safePeriod = accountingPeriod.replace(/[^\w.-]/g, '_') || 'period'
  return `payroll-source-${safePeriod}-${sessionId.slice(0, 8)}.zip`
}

async function fetchStoredFile(file: StoredPayrollFile) {
  const blob = await get(file.storageKey, { access: 'private' })
  if (!blob || blob.statusCode !== 200) {
    return null
  }

  const buffer = await new Response(blob.stream).arrayBuffer()
  return {
    contentType: blob.blob.contentType ?? contentTypeFor(file.fileType),
    data: new Uint8Array(buffer),
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId } = await params
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const [staffRecord] = await db
      .select({ id: staff.id, role: staff.role })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .limit(1)

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const [session] = await db
      .select({
        id: uploadSession.id,
        requestKind: uploadSession.requestKind,
        accountingPeriod: uploadSession.accountingPeriod,
        createdByStaffId: uploadSession.createdByStaffId,
      })
      .from(uploadSession)
      .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
      .limit(1)

    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
    }
    if (staffRecord.role === 'STAFF' && session.createdByStaffId !== staffRecord.id) {
      return NextResponse.json({ error: '자신이 생성한 세션의 급여 원자료만 다운로드할 수 있습니다' }, { status: 403 })
    }
    if (session.requestKind !== 'payroll') {
      return NextResponse.json({ error: '급여정산 세션에서만 사용할 수 있습니다' }, { status: 409 })
    }

    if (parsed.data.fileId) {
      const [file] = await db
        .select({
          id: uploadFile.id,
          originalFilename: uploadFile.originalFilename,
          storageKey: uploadFile.storageKey,
          fileType: uploadFile.fileType,
        })
        .from(uploadFile)
        .where(
          and(
            eq(uploadFile.id, parsed.data.fileId),
            eq(uploadFile.uploadSessionId, sessionId),
            eq(uploadFile.tenantId, tenantId),
          ),
        )
        .limit(1)

      if (!file) {
        return NextResponse.json({ error: '다운로드할 급여 원본 파일을 찾을 수 없습니다' }, { status: 404 })
      }

      const fetched = await fetchStoredFile(file)
      if (!fetched) {
        return NextResponse.json({ error: '파일을 가져올 수 없습니다' }, { status: 502 })
      }

      return new Response(fetched.data, {
        headers: {
          'Content-Type': fetched.contentType,
          'Content-Disposition': contentDisposition(file.originalFilename),
        },
      })
    }

    const [batch] = await db
      .select()
      .from(payrollExtractionBatch)
      .where(and(eq(payrollExtractionBatch.uploadSessionId, sessionId), eq(payrollExtractionBatch.tenantId, tenantId)))
      .orderBy(desc(payrollExtractionBatch.createdAt))
      .limit(1)

    const sourceFileIds = batch ? parsePayrollSourceFileIds(batch.sourceUploadFileIds) : []
    const files = await db
      .select({
        id: uploadFile.id,
        originalFilename: uploadFile.originalFilename,
        storageKey: uploadFile.storageKey,
        fileType: uploadFile.fileType,
      })
      .from(uploadFile)
      .where(
        and(
          eq(uploadFile.uploadSessionId, sessionId),
          eq(uploadFile.tenantId, tenantId),
          sourceFileIds.length > 0 ? inArray(uploadFile.id, sourceFileIds) : undefined,
        ),
      )

    const rows = batch
      ? await db
          .select({ aiVerdict: payrollExtractionRow.aiVerdict })
          .from(payrollExtractionRow)
          .where(
            and(
              eq(payrollExtractionRow.batchId, batch.id),
              eq(payrollExtractionRow.uploadSessionId, sessionId),
              eq(payrollExtractionRow.tenantId, tenantId),
            ),
          )
      : []

    const state = derivePayrollSourceDownloadState({
      batchStatus: batch?.status ?? null,
      rowVerdicts: rows.map((row) => row.aiVerdict),
      sourceFileCount: files.length,
    })

    if (!state.enabled) {
      return NextResponse.json({ error: state.detail }, { status: 409 })
    }

    if (files.length === 1) {
      const file = files[0]
      const fetched = await fetchStoredFile(file)
      if (!fetched) {
        return NextResponse.json({ error: '파일을 가져올 수 없습니다' }, { status: 502 })
      }

      return new Response(fetched.data, {
        headers: {
          'Content-Type': fetched.contentType,
          'Content-Disposition': contentDisposition(file.originalFilename),
        },
      })
    }

    const fetchedFiles = await Promise.all(
      files.map(async (file) => {
        const fetched = await fetchStoredFile(file)
        return fetched ? { filename: file.originalFilename, data: fetched.data } : null
      }),
    )
    const zipEntries: Array<{ filename: string; data: Uint8Array }> = []
    for (const fetchedFile of fetchedFiles) {
      if (fetchedFile) zipEntries.push(fetchedFile)
    }

    if (zipEntries.length !== files.length) {
      return NextResponse.json({ error: '일부 파일을 가져올 수 없습니다' }, { status: 502 })
    }

    const archive = createZipArchive(zipEntries)
    const filename = zipFilename(session.accountingPeriod, session.id)

    return new Response(archive, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': contentDisposition(filename),
      },
    })
  } catch (err) {
    console.error('[GET /api/sessions/[id]/payroll/source-files/download]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
