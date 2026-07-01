import { get } from '@vercel/blob'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  uploadFile,
  uploadSession,
  client,
  analysisRun,
  materialMatch,
  clientChecklist,
  checklistTemplate,
  checklistItem,
} from '@/lib/db/schema'
import { requireAiEnv, isGeminiEnabled } from '@/lib/env'
import { now, toDBString } from '@/lib/time'
import type { AiAnalysisResult, ProviderResult } from '@/lib/validations/analysis'
import { inspectBookkeepingFileForTransactions, type BookkeepingTransactionFileInspection } from '@/lib/bookkeeping/transaction-extraction'
import { analyzeWithClaude } from './claude'
import { analyzeWithOpenAI } from './openai'
import { analyzeWithGemini } from './gemini'
import { OPENAI_ANALYSIS_MODEL } from './models'
import { extractDocumentText } from './extract'
import { logAiProviderFailures } from './provider-observability'
import { type AiProvider } from './provider-order'

const HIGH_RISK_PATTERN = /세금계산서|급여|통장|tax.?invoice|payroll|bank.?statement/i

// Vercel Blob URL 화이트리스트 — SSRF 방지
const ALLOWED_BLOB_HOST_SUFFIX = '.blob.vercel-storage.com'

function isAllowedBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.endsWith(ALLOWED_BLOB_HOST_SUFFIX)
    )
  } catch {
    return false
  }
}

async function readBlobFile(url: string): Promise<{
  fileBuffer: ArrayBuffer | null
  contentType: string
}> {
  if (!isAllowedBlobUrl(url)) {
    console.warn('[analyze] storageKey is not an allowed Vercel Blob URL, proceeding text-only')
    return { fileBuffer: null, contentType: 'application/octet-stream' }
  }

  const blobRes = await get(url, { access: 'private', useCache: false })
  if (!blobRes || blobRes.statusCode !== 200) {
    throw new Error('업로드 파일을 Blob에서 다시 읽을 수 없습니다')
  }

  const fileBuffer = await new Response(blobRes.stream).arrayBuffer()
  return {
    fileBuffer,
    contentType: blobRes.blob.contentType ?? 'application/octet-stream',
  }
}

type ConfidenceEnum = 'high' | 'medium' | 'low' | 'unknown'
type ConsensusGroup = 'high_confidence' | 'medium_confidence' | 'needs_review' | 'failed'
type FileStatus = 'uploaded' | 'analyzing' | 'matched' | 'needs_review' | 'rejected' | 'failed'

function deterministicInspectionResult(params: {
  inspection: BookkeepingTransactionFileInspection
  originalFilename: string
}): AiAnalysisResult | null {
  if (params.inspection.usableForTransactionWorkpapers || params.inspection.documentKind !== 'monthly_vat_summary') {
    return null
  }

  const filenameLooksLikeOnlineSales = /네이버|naver|npay|kcp|pg|페이|pay/i.test(params.originalFilename)
  return {
    detected_file_type: '월별 부가세 매출 집계표',
    readability_score: 1,
    checklist_item_id: null,
    classification_confidence: 0.95,
    extracted_fields: {
      deterministic_document_kind: params.inspection.documentKind,
      transaction_candidate_count: params.inspection.candidateCount,
    },
    period_match: 'unknown',
    material_status: 'insufficient',
    risk_flags: [
      'not_transaction_detail',
      ...(filenameLooksLikeOnlineSales ? ['filename_content_mismatch'] : []),
    ],
    routing_status: 'needs_review',
    confidence: 0.95,
    explanation: params.inspection.reason,
    uncertainty: null,
    recommended_action: '거래일자, 거래처, 건별 금액이 있는 온라인 매출/PG 정산 상세내역을 다시 제출해 주세요.',
    criteria_summary: '기장 거래자료로 쓰려면 월별 합계표가 아니라 건별 거래 상세내역이어야 합니다.',
  }
}

function applyDeterministicInspection(params: {
  result: ProviderResult
  inspection: BookkeepingTransactionFileInspection | null
  originalFilename: string
}): ProviderResult {
  if (!params.inspection) return params.result
  const deterministic = deterministicInspectionResult({
    inspection: params.inspection,
    originalFilename: params.originalFilename,
  })
  if (!deterministic) return params.result

  return {
    success: true,
    rawOutput: params.result.rawOutput || JSON.stringify(deterministic),
    data: deterministic,
  }
}

function toConfidenceEnum(score: number, threshold: number): ConfidenceEnum {
  if (score >= 0.8) return 'high'
  if (score >= threshold) return 'medium'
  return 'low'
}

function calcConsensus(results: ProviderResult[]): ConsensusGroup {
  const successes = results.filter((r) => r.success && r.data)
  if (successes.length === 0) return 'failed'

  const statuses = successes.map((r) => r.data!.routing_status)
  const counts = statuses.reduce<Record<string, number>>((acc, s) => {
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})
  const maxCount = Math.max(...Object.values(counts))

  if (maxCount === results.length && results.length >= 2) return 'high_confidence'
  if (maxCount >= 2) return 'medium_confidence'
  if (successes.length === 1) {
    return successes[0].data!.routing_status === 'matched_candidate'
      ? 'medium_confidence'
      : 'needs_review'
  }
  return 'needs_review'
}

async function saveAnalysisRun(params: {
  uploadFileId: string
  tenantId: string
  provider: AiProvider
  model: string
  result: ProviderResult
  consensusGroup: ConsensusGroup
  threshold: number
  appliedNotes: string | null
}): Promise<string> {
  const id = crypto.randomUUID()
  await db.insert(analysisRun).values({
    id,
    uploadFileId: params.uploadFileId,
    tenantId: params.tenantId,
    provider: params.provider,
    model: params.model,
    rawOutput: params.result.rawOutput || null,
    parsedOutput: params.result.data ? JSON.stringify(params.result.data) : null,
    confidence: params.result.data
      ? toConfidenceEnum(params.result.data.confidence, params.threshold)
      : 'unknown',
    consensusGroup: params.consensusGroup,
    status: params.result.success ? 'completed' : 'failed',
    errorMessage: params.result.error ?? null,
    appliedAnalysisNotes: params.appliedNotes,
    criteriaSummary: params.result.data?.criteria_summary ?? null,
    createdAt: toDBString(now()),
  })
  return id
}

async function isFileStillAnalyzing(fileId: string, tenantId: string) {
  const rows = await db
    .select({ status: uploadFile.status })
    .from(uploadFile)
    .where(and(eq(uploadFile.id, fileId), eq(uploadFile.tenantId, tenantId)))
    .limit(1)

  return rows[0]?.status === 'analyzing'
}

/**
 * @param opts.overrideBuffer Slice 3-B 전용. 비밀번호 복호화 경로에서 복호화된 평문 버퍼를
 *   직접 주입한다. Blob에는 암호화본이 그대로 남으므로(평문 미저장), 재읽기 대신 메모리 버퍼를 쓴다.
 *   가드: 미지정 시 기존 Blob 읽기 흐름을 그대로 유지 → 일반 분석 경로에 영향 없음.
 */
export async function analyzeFile(
  fileId: string,
  tenantId: string,
  opts?: { overrideBuffer?: ArrayBuffer },
): Promise<void> {
  // 1. 파일 조회
  const fileRows = await db
    .select()
    .from(uploadFile)
    .where(and(eq(uploadFile.id, fileId), eq(uploadFile.tenantId, tenantId)))
    .limit(1)

  const file = fileRows[0]
  if (!file) throw new Error(`upload_file not found: ${fileId}`)
  if (file.status !== 'uploaded') return

  // 2. 분석 중 상태로 전환
  await db
    .update(uploadFile)
    .set({ status: 'analyzing' })
    .where(and(eq(uploadFile.id, fileId), eq(uploadFile.tenantId, tenantId), eq(uploadFile.status, 'uploaded')))
  if (!(await isFileStillAnalyzing(fileId, tenantId))) return

  try {
    // 3. 세션 + 클라이언트 조회
    const sessionRows = await db
      .select({ session: uploadSession, clientRecord: client })
      .from(uploadSession)
      .innerJoin(client, eq(uploadSession.clientId, client.id))
      .where(and(eq(uploadSession.id, file.uploadSessionId), eq(uploadSession.tenantId, tenantId)))
      .limit(1)

    const { session, clientRecord } = sessionRows[0] ?? {}
    if (!session || !clientRecord) throw new Error('Session or client not found')

    // 4. 체크리스트 항목 조회
    const itemRows = await db
      .select({ item: checklistItem })
      .from(clientChecklist)
      .innerJoin(checklistTemplate, eq(clientChecklist.templateId, checklistTemplate.id))
      .innerJoin(checklistItem, eq(checklistItem.templateId, checklistTemplate.id))
      .where(and(eq(clientChecklist.clientId, clientRecord.id), eq(clientChecklist.tenantId, tenantId)))

    const checklistItems = itemRows.map((r) => ({
      id: r.item.id,
      name: r.item.name,
      required: r.item.required,
    }))

    // 5. 파일 fetch (vision 분석용)
    const appliedNotes = [
      clientRecord.analysisNotes,
      session.analysisNotes,
      session.extractedCriteria,
      session.additionalCriteria,
    ]
      .filter(Boolean)
      .join('\n') || null

    const { fileBuffer, contentType } = opts?.overrideBuffer
      ? {
          fileBuffer: opts.overrideBuffer,
          contentType:
            file.fileType ||
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }
      : await readBlobFile(file.storageKey)

    const extraction = await extractDocumentText({
      fileBuffer,
      fileType: file.fileType,
      originalFilename: file.originalFilename,
    })

    // 비밀번호 보호 파일 격리 (Slice 2)
    // - bookkeeping 검사보다 먼저 실행한다. inspectBookkeepingFileForTransactions 내부 XLSX.read는
    //   암호화 Excel에서 throw하여 catch→status=failed(처리 지연)로 떨어질 수 있다.
    // - 가드: failureReason === 'password_required'일 때만 동작 → 일반 파일 흐름 영향 없음
    // - AI 분석은 건너뛰되, 해당 파일만 '확인 필요'로 표시하고 세션 전체는 그대로 둔다.
    // - status는 'failed'가 아니라 'needs_review'로 두어 처리 실패가 아닌 확인 필요 상태로 보이게 한다.
    if (extraction.failureReason === 'password_required') {
      if (!(await isFileStillAnalyzing(fileId, tenantId))) return
      await db
        .update(uploadFile)
        .set({ status: 'needs_review', passwordStatus: 'required' })
        .where(
          and(
            eq(uploadFile.id, fileId),
            eq(uploadFile.tenantId, tenantId),
            eq(uploadFile.status, 'analyzing'),
          ),
        )
      return
    }

    const bookkeepingInspection = fileBuffer
      ? inspectBookkeepingFileForTransactions({ file, buffer: fileBuffer })
      : null

    const analyzeParams = {
      fileBuffer,
      contentType,
      fileType: file.fileType,
      originalFilename: file.originalFilename,
      extractedText: extraction.text,
      extractionSummary: extraction.summary,
      accountingPeriod: session.accountingPeriod,
      checklistItems,
      clientAnalysisNotes: clientRecord.analysisNotes,
      sessionAnalysisNotes: session.analysisNotes,
      extractedCriteria: session.extractedCriteria,
      additionalCriteria: session.additionalCriteria,
    }

    const { ANALYSIS_CONFIDENCE_THRESHOLD, GEMINI_ANALYSIS_MODEL } = requireAiEnv()
    const geminiEnabled = isGeminiEnabled()

    const inspect = (result: ProviderResult) => applyDeterministicInspection({
      result,
      inspection: bookkeepingInspection,
      originalFilename: file.originalFilename,
    })

    const allResults: ProviderResult[] = []
    const providerModels: Array<{ provider: AiProvider; model: string }> = []

    if (geminiEnabled) {
      allResults.push(inspect(await analyzeWithGemini(analyzeParams)))
      providerModels.push({
        provider: 'gemini',
        model: GEMINI_ANALYSIS_MODEL ?? 'gemini-3.5-flash',
      })
    } else {
      allResults.push(inspect(await analyzeWithOpenAI(analyzeParams)))
      providerModels.push({ provider: 'openai', model: OPENAI_ANALYSIS_MODEL })
    }

    const primaryResult = allResults[0]
    const primaryData = primaryResult?.data
    const matchedItemName = primaryData?.checklist_item_id
      ? checklistItems.find((i) => i.id === primaryData.checklist_item_id)?.name ?? ''
      : ''

    const needsMultiModel =
      !primaryResult?.success ||
      (primaryData && (
        primaryData.confidence < ANALYSIS_CONFIDENCE_THRESHOLD ||
        primaryData.material_status === 'insufficient' ||
        primaryData.readability_score < 0.5 ||
        HIGH_RISK_PATTERN.test(file.originalFilename) ||
        HIGH_RISK_PATTERN.test(matchedItemName)
      ))

    if (needsMultiModel) {
      if (geminiEnabled) {
        const [openaiResult, claudeResult] = await Promise.all([
          analyzeWithOpenAI(analyzeParams).then((result) => inspect(result)),
          analyzeWithClaude(analyzeParams).then((result) => inspect(result)),
        ])
        allResults.push(openaiResult, claudeResult)
        providerModels.push(
          { provider: 'openai', model: OPENAI_ANALYSIS_MODEL },
          { provider: 'claude', model: 'claude-sonnet-4-6' },
        )
      } else {
        const claudeResult = inspect(await analyzeWithClaude(analyzeParams))
        allResults.push(claudeResult)
        providerModels.push({ provider: 'claude', model: 'claude-sonnet-4-6' })
      }
    }

    // 8. consensus 계산
    const consensus = calcConsensus(allResults)
    if (!(await isFileStillAnalyzing(fileId, tenantId))) return

    // 9. analysis_run 저장 — Claude run ID를 materialMatch에 연결하기 위해 순차 저장
    const runIds: string[] = []
    for (let i = 0; i < allResults.length; i++) {
      const runId = await saveAnalysisRun({
        uploadFileId: fileId,
        tenantId,
        provider: providerModels[i].provider,
        model: providerModels[i].model,
        result: allResults[i],
        consensusGroup: consensus,
        threshold: ANALYSIS_CONFIDENCE_THRESHOLD,
        appliedNotes,
      })
      runIds.push(runId)
    }
    logAiProviderFailures({
      uploadFileId: fileId,
      uploadSessionId: file.uploadSessionId,
      tenantId,
      consensusGroup: consensus,
      runs: allResults.map((result, index) => ({
        provider: providerModels[index].provider,
        model: providerModels[index].model,
        result,
        analysisRunId: runIds[index],
      })),
    })
    const bestResultIndex = allResults.findIndex((result) => result.success && result.data)

    // 10. 최선의 결과에서 매칭 항목 결정 (Gemini 우선, 성공한 결과 순)
    const bestResult: AiAnalysisResult | undefined =
      bestResultIndex >= 0 ? allResults[bestResultIndex].data : undefined
    const bestResultRunId = bestResultIndex >= 0 ? runIds[bestResultIndex] : null

    // 11. material_match 저장 (체크리스트 있고 매칭된 경우만)
    let finalFileStatus: FileStatus = 'needs_review'

    if (bestResult && bestResult.checklist_item_id && checklistItems.length > 0) {
      const targetItem = checklistItems.find((i) => i.id === bestResult.checklist_item_id)
      if (targetItem) {
        const matchStatus =
          consensus === 'needs_review' || bestResult.routing_status === 'needs_review'
            ? 'needs_review'
            : 'matched'

        await db.insert(materialMatch).values({
          id: crypto.randomUUID(),
          uploadFileId: fileId,
          checklistItemId: targetItem.id,
          tenantId,
          analysisRunId: bestResultRunId ?? runIds[0],
          status: matchStatus,
          confidence: toConfidenceEnum(bestResult.confidence, ANALYSIS_CONFIDENCE_THRESHOLD),
          explanation: bestResult.explanation,
          createdAt: toDBString(now()),
        })

        finalFileStatus = matchStatus === 'matched' ? 'matched' : 'needs_review'

        // 파일이 항목에 확정 매칭되면 고객의 없음/나중에 선언을 자동 해제한다.
        if (matchStatus === 'matched') {
          const { clearUploadItemDeclaration } = await import('@/lib/upload/item-declaration')
          await clearUploadItemDeclaration({
            tenantId,
            uploadSessionId: file.uploadSessionId,
            checklistItemId: targetItem.id,
          })
        }
      }
    } else if (consensus === 'failed' || !bestResult) {
      finalFileStatus = 'failed'
    }

    // 12. upload_file 상태 최종 업데이트
    await db
      .update(uploadFile)
      .set({ status: finalFileStatus })
      .where(and(eq(uploadFile.id, fileId), eq(uploadFile.tenantId, tenantId), eq(uploadFile.status, 'analyzing')))
  } catch (err) {
    console.error(`[analyze] Failed for file ${fileId}:`, err)
    await db
      .update(uploadFile)
      .set({ status: 'failed' })
      .where(and(eq(uploadFile.id, fileId), eq(uploadFile.tenantId, tenantId), eq(uploadFile.status, 'analyzing')))
    throw err
  }
}
