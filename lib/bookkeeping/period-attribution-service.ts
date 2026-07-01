import { randomUUID } from 'crypto'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { get } from '@vercel/blob'
import { db } from '@/lib/db'
import {
  analysisRun,
  bookkeepingMaterialAttribution,
  client,
  staff,
  uploadFile,
  uploadSession,
} from '@/lib/db/schema'
import { providerPriority } from '@/lib/ai/provider-order'
import { DateTime, now, toDBString } from '@/lib/time'
import { buildAttributionSummary } from '@/lib/reviews/build-material-attribution-summary'
import type { ReviewMaterialAttribution } from '@/lib/reviews/review-workspace-types'
import { collectTransactionCandidatesForFile } from '@/lib/reviews/adaptive-structuring-apply'
import type { MaterialAttributionDecision, TransactionCandidate } from './schemas'
import { enhanceMaterialAttributionWithLlm } from './period-attribution-ai'
import {
  getBookkeepingMaterialAttributionStartState,
} from './period-attribution-eligibility'
import {
  resolveBookkeepingPeriodRangeSnapshot,
} from './period-range'
import {
  buildFileSummaryRows,
  buildGeneratedRows,
  enforceTargetRangeBoundary,
  hasResolvedPeriod,
  type FileSummaryCandidate,
} from './period-attribution-rows'
export type { GeneratedAttributionRow } from './period-attribution-rows'
const ACTIVE_ATTRIBUTION_STATUS = 'active'

type StaffRecord = {
  id: string
  role: 'TENANT_ADMIN' | 'STAFF'
}

type SessionAccessRow = {
  session: typeof uploadSession.$inferSelect
  clientName: string
}

type ParsedAnalysisOutput = {
  detected_file_type?: string
  explanation?: string
  risk_flags?: string[]
}

export async function getActiveStaffForPeriodAttribution(params: {
  userId: string
  tenantId: string
}): Promise<StaffRecord | null> {
  const [row] = await db
    .select({ id: staff.id, role: staff.role })
    .from(staff)
    .where(and(eq(staff.userId, params.userId), eq(staff.tenantId, params.tenantId), eq(staff.active, true)))
    .limit(1)
  return row ?? null
}

async function getSessionForStaff(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
}): Promise<SessionAccessRow | null> {
  const [row] = await db
    .select({
      session: uploadSession,
      clientName: client.name,
    })
    .from(uploadSession)
    .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, params.tenantId)))
    .where(and(eq(uploadSession.id, params.sessionId), eq(uploadSession.tenantId, params.tenantId)))
    .limit(1)

  if (!row) return null
  if (params.staffRecord.role === 'STAFF' && row.session.createdByStaffId !== params.staffRecord.id) return null
  return row
}

function normalizeAccountingPeriod(value: string) {
  const match = value.match(/(20\d{2})[-.\s년]*(\d{1,2})/)
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return `${match[1]}-${match[2].padStart(2, '0')}`
}

function closePeriodFor(accountingPeriod: string) {
  const period = normalizeAccountingPeriod(accountingPeriod)
  if (!period) return accountingPeriod

  const base = DateTime.fromFormat(`${period}-01`, 'yyyy-MM-dd', { zone: 'Asia/Seoul' })
  if (!base.isValid) return period

  const quarterStartMonth = Math.floor((base.month - 1) / 3) * 3 + 1
  const start = base.set({ month: quarterStartMonth })
  const end = start.plus({ months: 2 })
  return `${start.toFormat('yyyy-MM')}~${end.toFormat('yyyy-MM')}`
}

function resolveTargetRangeFromSession(session: typeof uploadSession.$inferSelect) {
  return resolveBookkeepingPeriodRangeSnapshot({
    accountingPeriod: session.accountingPeriod,
    bookkeepingPeriodType: session.bookkeepingPeriodType,
    bookkeepingPeriodStart: session.bookkeepingPeriodStart,
    bookkeepingPeriodEnd: session.bookkeepingPeriodEnd,
  })
}

async function collectTransactionCandidates(
  files: Array<typeof uploadFile.$inferSelect>,
  context: { tenantId: string; uploadSessionId: string },
) {
  const candidates: TransactionCandidate[] = []
  const transactionFileIds = new Set<string>()

  for (const file of files) {
    try {
      const blob = await get(file.storageKey, { access: 'private' })
      if (!blob || blob.statusCode !== 200) continue
      const buffer = await new Response(blob.stream).arrayBuffer()
      // 규칙 기반 extractor가 후보를 못 찾으면(빈 배열) 승인된 구조화 모델을 시도한다.
      // 두 경로 모두 같은 공유 함수를 쓴다(classification-service.ts도 동일) — 여기서
      // 한쪽만 고치면 "계정항목 정리"를 다시 눌렀을 때 결과가 달라지는 drift가 생긴다.
      const fileCandidates = await collectTransactionCandidatesForFile({
        tenantId: context.tenantId,
        uploadSessionId: context.uploadSessionId,
        file,
        buffer,
      })
      candidates.push(...fileCandidates)
      if (fileCandidates.length > 0) transactionFileIds.add(file.id)
    } catch {
      // Files that cannot be parsed do not create period-attribution rows.
    }
  }

  return { candidates, transactionFileIds }
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
}

function normalizeAccountingPeriodFromText(year: string, month: string) {
  const numericMonth = Number(month)
  if (numericMonth < 1 || numericMonth > 12) return null
  return `${year}-${month.padStart(2, '0')}`
}

function findContentAttributionPeriod(source: string) {
  const periodLabels = [
    '고지년월',
    '고지월',
    '사용년월',
    '사용월',
    '이용년월',
    '이용월',
    '공급기간',
    '공급년월',
    '청구년월',
    '청구월',
    '귀속년월',
    '귀속월',
    '정산년월',
    '정산월',
  ]
  const pattern = new RegExp(
    `(${periodLabels.join('|')})\\s*[:：은는-]*\\s*(20\\d{2})\\s*[.\\-/년]?\\s*(\\d{1,2})`,
    'i',
  )
  const match = source.match(pattern)
  if (!match) return null
  return normalizeAccountingPeriodFromText(match[2], match[3])
}

function findContentEvidenceDate(source: string) {
  const dateLabels = [
    '작성일자',
    '작성일',
    '발급일자',
    '발행일자',
    '공급일자',
    '거래일자',
    '승인일자',
    '결제일자',
    '수납일자',
    '납부일자',
    '이용일자',
  ]
  const labeledPattern = new RegExp(
    `(${dateLabels.join('|')})\\s*[:：은는-]*\\s*(20\\d{2})\\s*[.\\-/년]\\s*(\\d{1,2})\\s*[.\\-/월]\\s*(\\d{1,2})`,
    'i',
  )
  const labeledMatch = source.match(labeledPattern)
  const plainMatch = labeledMatch ? null : source.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/)
  if (!labeledMatch && !plainMatch) return null

  const year = labeledMatch?.[2] ?? plainMatch?.[1]
  const month = labeledMatch?.[3] ?? plainMatch?.[2]
  const day = labeledMatch?.[4] ?? plainMatch?.[3]
  if (!year || !month || !day) return null
  const numericMonth = Number(month)
  const numericDay = Number(day)
  if (numericMonth < 1 || numericMonth > 12 || numericDay < 1 || numericDay > 31) return null
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function findRepresentativeAmount(source: string) {
  const matches = [...source.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/g)]
    .map((match) => Number(match[1].replace(/,/g, '')))
    .filter((amount) => Number.isFinite(amount) && amount > 0)
  if (matches.length === 0) return null
  return Math.max(...matches)
}

function parseAnalysisOutput(raw: string | null): ParsedAnalysisOutput | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as ParsedAnalysisOutput
  } catch {
    return null
  }
}

function representativeAnalysisRun(
  runs: Array<typeof analysisRun.$inferSelect>,
  fileId: string,
) {
  return runs
    .filter((run) => run.uploadFileId === fileId)
    .sort((a, b) => {
      const score = (run: typeof a) =>
        run.status === 'completed' && run.parsedOutput ? 0 : run.status === 'completed' ? 1 : 2
      const diff = score(a) - score(b)
      if (diff !== 0) return diff
      return providerPriority(a.provider) - providerPriority(b.provider)
    })[0] ?? null
}

function buildFileSummaryCandidateFromAnalysis(params: {
  file: typeof uploadFile.$inferSelect
  parsed: ParsedAnalysisOutput
}): FileSummaryCandidate | null {
  const source = normalizeText([
    params.parsed.detected_file_type,
    params.parsed.explanation,
    params.parsed.risk_flags?.join(' '),
  ].join('\n'))
  if (!source) return null

  const attributedPeriod = findContentAttributionPeriod(source)
  const evidenceDate = findContentEvidenceDate(source)
  if (!attributedPeriod && !evidenceDate) return null

  return {
    uploadFileId: params.file.id,
    sourceFilename: params.file.originalFilename,
    evidenceDate,
    attributedPeriod,
    amountKrw: findRepresentativeAmount(source),
    counterparty: null,
    description: [
      params.parsed.detected_file_type,
      params.parsed.explanation,
    ].filter(Boolean).join(' · ').slice(0, 1000) || 'AI 분석 결과 기준 파일 요약',
  }
}

export async function startBookkeepingMaterialAttribution(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
}) {
  const sessionRow = await getSessionForStaff(params)
  if (!sessionRow) return { ok: false as const, status: 404, error: '세션을 찾을 수 없습니다.' }
  if (sessionRow.session.requestKind !== 'general') {
    return { ok: false as const, status: 409, error: '일반 자료 세션에서만 귀속기간 검토를 사용할 수 있습니다.' }
  }

  const files = await db
    .select()
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, params.sessionId), eq(uploadFile.tenantId, params.tenantId)))

  if (files.length === 0) return { ok: false as const, status: 400, error: '업로드 파일이 없습니다.' }

  const startState = getBookkeepingMaterialAttributionStartState({
    sessionStatus: sessionRow.session.status,
    files,
  })

  if (!startState.eligible) {
    return { ok: false as const, status: 409, error: startState.reason }
  }

  const { candidates, transactionFileIds } = await collectTransactionCandidates(files, {
    tenantId: params.tenantId,
    uploadSessionId: params.sessionId,
  })
  const targetRange = resolveTargetRangeFromSession(sessionRow.session)
  if (!targetRange) {
    return { ok: false as const, status: 409, error: '기장 대상 기간을 확정할 수 없습니다.' }
  }

  const analysisRuns = files.length > 0
    ? await db
      .select()
      .from(analysisRun)
      .where(
        and(
          eq(analysisRun.tenantId, params.tenantId),
          inArray(analysisRun.uploadFileId, files.map((file) => file.id)),
        ),
      )
    : []
  const fileSummaryCandidates = files
    .filter((file) => !transactionFileIds.has(file.id))
    .flatMap((file) => {
      const parsed = parseAnalysisOutput(representativeAnalysisRun(analysisRuns, file.id)?.parsedOutput ?? null)
      if (!parsed) return []
      const candidate = buildFileSummaryCandidateFromAnalysis({ file, parsed })
      return candidate ? [candidate] : []
    })

  let generatedRows = buildGeneratedRows({
    requestedPeriod: sessionRow.session.accountingPeriod,
    targetRange,
    candidates,
  }).concat(buildFileSummaryRows({ targetRange, candidates: fileSummaryCandidates }))

  const ts = toDBString(now())
  const closePeriod = closePeriodFor(sessionRow.session.accountingPeriod)

  try {
    generatedRows = await enhanceMaterialAttributionWithLlm({
      clientName: sessionRow.clientName,
      requestedPeriod: sessionRow.session.accountingPeriod,
      closePeriod,
      rows: generatedRows,
    })
  } catch (error) {
    console.warn('[bookkeeping-period-attribution-ai-consensus-failed]', {
      sessionId: params.sessionId,
      tenantId: params.tenantId,
      error: error instanceof Error ? error.message : 'unknown error',
    })
    return {
      ok: false as const,
      status: 502,
      error: '귀속기간 AI 판단에서 Gemini·ChatGPT(OpenAI) 기준 합의에 도달하지 못했습니다.',
    }
  }
  generatedRows = generatedRows
    .map((row) => enforceTargetRangeBoundary({ row, targetRange }))
    .filter(hasResolvedPeriod)

  await db.transaction(async (tx) => {
    await tx
      .update(bookkeepingMaterialAttribution)
      .set({ status: 'superseded', updatedAt: ts })
      .where(
        and(
          eq(bookkeepingMaterialAttribution.tenantId, params.tenantId),
          eq(bookkeepingMaterialAttribution.uploadSessionId, params.sessionId),
          eq(bookkeepingMaterialAttribution.status, ACTIVE_ATTRIBUTION_STATUS),
        ),
      )

    if (generatedRows.length > 0) {
      await tx.insert(bookkeepingMaterialAttribution).values(generatedRows.map((row) => ({
        id: randomUUID(),
        tenantId: params.tenantId,
        uploadSessionId: params.sessionId,
        uploadFileId: row.uploadFileId,
        status: ACTIVE_ATTRIBUTION_STATUS as 'active',
        sourceKind: row.sourceKind,
        sourceLabel: row.sourceLabel,
        evidenceDate: row.evidenceDate,
        attributedPeriod: row.attributedPeriod,
        requestedPeriod: sessionRow.session.accountingPeriod,
        closePeriod,
        periodRelation: row.periodRelation,
        amountKrw: row.amountKrw,
        counterparty: row.counterparty,
        description: row.description,
        duplicateStatus: row.duplicateStatus,
        duplicateBasis: row.duplicateBasis,
        recommendation: row.recommendation,
        staffDecision: null,
        staffNote: null,
        decidedByStaffId: null,
        decidedAt: null,
        createdByStaffId: params.staffRecord.id,
        createdAt: ts,
        updatedAt: ts,
      })))
    }
  })

  return { ok: true as const, rowCount: generatedRows.length }
}

export async function getBookkeepingMaterialAttribution(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
}) {
  const sessionRow = await getSessionForStaff(params)
  if (!sessionRow) return { ok: false as const, status: 404, error: '세션을 찾을 수 없습니다.' }

  const rows = (await db
    .select()
    .from(bookkeepingMaterialAttribution)
    .where(
      and(
        eq(bookkeepingMaterialAttribution.tenantId, params.tenantId),
        eq(bookkeepingMaterialAttribution.uploadSessionId, params.sessionId),
        eq(bookkeepingMaterialAttribution.status, ACTIVE_ATTRIBUTION_STATUS),
      ),
    )
    .orderBy(
      bookkeepingMaterialAttribution.attributedPeriod,
      bookkeepingMaterialAttribution.evidenceDate,
      desc(bookkeepingMaterialAttribution.createdAt),
    )
  ).filter(hasResolvedPeriod)

  const attributionRows: ReviewMaterialAttribution[] = rows.map((row) => ({
    id: row.id,
    uploadSessionId: row.uploadSessionId,
    sourceKind: row.sourceKind,
    sourceLabel: row.sourceLabel,
    evidenceDate: row.evidenceDate,
    attributedPeriod: row.attributedPeriod,
    requestedPeriod: row.requestedPeriod,
    closePeriod: row.closePeriod,
    periodRelation: row.periodRelation,
    amountKrw: row.amountKrw,
    counterparty: row.counterparty,
    description: row.description,
    duplicateStatus: row.duplicateStatus,
    duplicateBasis: row.duplicateBasis,
    recommendation: row.recommendation,
    staffDecision: row.staffDecision,
    staffNote: row.staffNote,
  }))

  const summary = buildAttributionSummary(attributionRows) ?? {
    requestedPeriod: sessionRow.session.accountingPeriod,
    closePeriod: closePeriodFor(sessionRow.session.accountingPeriod),
    total: 0,
    include: 0,
    hold: 0,
    excludeDuplicate: 0,
    referenceOnly: 0,
    prior: 0,
    future: 0,
    unknown: 0,
    possibleDuplicate: 0,
    requestedInPeriod: 0,
    inCloseWindow: 0,
    outOfScope: 0,
  }

  return { ok: true as const, rows, summary }
}

export async function updateBookkeepingMaterialAttributionRow(params: {
  rowId: string
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
  staffDecision: MaterialAttributionDecision
  staffNote?: string | null
}) {
  const sessionRow = await getSessionForStaff(params)
  if (!sessionRow) return { ok: false as const, status: 404, error: '세션을 찾을 수 없습니다.' }

  const [row] = await db
    .select({
      id: bookkeepingMaterialAttribution.id,
      periodRelation: bookkeepingMaterialAttribution.periodRelation,
    })
    .from(bookkeepingMaterialAttribution)
    .where(
      and(
        eq(bookkeepingMaterialAttribution.id, params.rowId),
        eq(bookkeepingMaterialAttribution.uploadSessionId, params.sessionId),
        eq(bookkeepingMaterialAttribution.tenantId, params.tenantId),
        eq(bookkeepingMaterialAttribution.status, ACTIVE_ATTRIBUTION_STATUS),
      ),
    )
    .limit(1)

  if (!row) return { ok: false as const, status: 404, error: '귀속기간 행을 찾을 수 없습니다.' }

  const note = params.staffNote?.trim() || null
  const noteRequired =
    params.staffDecision === 'hold' ||
    params.staffDecision === 'exclude_duplicate' ||
    params.staffDecision === 'reference_only' ||
    (params.staffDecision === 'include' && row.periodRelation === 'prior')

  if (noteRequired && !note) {
    return { ok: false as const, status: 400, error: '보류, 제외, 참고자료 또는 전월자료 포함 결정에는 메모가 필요합니다.' }
  }

  await db
    .update(bookkeepingMaterialAttribution)
    .set({
      staffDecision: params.staffDecision,
      staffNote: note,
      decidedByStaffId: params.staffRecord.id,
      decidedAt: toDBString(now()),
      updatedAt: toDBString(now()),
    })
    .where(and(eq(bookkeepingMaterialAttribution.id, params.rowId), eq(bookkeepingMaterialAttribution.tenantId, params.tenantId)))

  return { ok: true as const }
}

export async function supersedeBookkeepingMaterialAttribution(params: {
  sessionId: string
  tenantId: string
}) {
  await db
    .update(bookkeepingMaterialAttribution)
    .set({
      status: 'superseded',
      updatedAt: toDBString(now()),
    })
    .where(
      and(
        eq(bookkeepingMaterialAttribution.uploadSessionId, params.sessionId),
        eq(bookkeepingMaterialAttribution.tenantId, params.tenantId),
        inArray(bookkeepingMaterialAttribution.status, ['active']),
      ),
    )
}
