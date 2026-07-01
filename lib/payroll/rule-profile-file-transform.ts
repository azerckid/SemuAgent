import { get } from '@vercel/blob'
import { and, eq } from 'drizzle-orm'
import { extractDocumentTextChunks } from '@/lib/ai/extract'
import { db } from '@/lib/db'
import { clientDocument } from '@/lib/db/schema'
import type { ClientPayrollRuleProfileV1, PayrollRuleSourceSummary } from '@/lib/validations/payroll-rule-profile'
import {
  isPayrollRuleDocumentContentType,
  resolvePayrollRuleExtractFileType,
  resolvePayrollRuleSourceTypeFromContentType,
} from './payroll-rule-document-types'
import { assembleRuleDraftFromAiResponse } from './rule-profile-draft-assembly'
import {
  classifyPayrollRuleTextSecurityLane,
  type StructureRulesResult,
} from './rule-profile-nl-transform'

/**
 * 사내 급여 규칙 파일 → 텍스트 추출 → AI 구조화 → draft (Slice 4b).
 * txt/pdf/doc/docx → rule_document, xlsx/xls → excel_embedded.
 */

export type FileTransformInput = {
  tenantId: string
  clientId: string
  sourceFileId: string
  expectedSourceType: 'rule_document' | 'excel_embedded'
  effectiveFrom: string
  effectiveTo?: string | null
}

export type FileTransformResult =
  | { status: 'blocked_tee'; securityLane: 'tee_required' }
  | {
      status: 'ok'
      profile: ClientPayrollRuleProfileV1
      sourceSummary: PayrollRuleSourceSummary
      sourceHash: string
      model: string
    }
  | { status: 'failed'; error: string }

const defaultCallAi = async (
  sourceText: string,
  sourceKind: 'rule_document' | 'excel_embedded',
): Promise<StructureRulesResult> => {
  const { structurePayrollRulesWithProviderFallback } = await import('./rule-profile-nl-providers')
  return structurePayrollRulesWithProviderFallback(sourceText, sourceKind)
}

function joinExtractedChunks(chunks: Array<{ text: string | null }>): string {
  return chunks
    .map((chunk) => chunk.text?.trim())
    .filter(Boolean)
    .join('\n\n')
}

export async function transformPayrollRuleFileToDraft(
  input: FileTransformInput,
  callAi: (text: string, sourceKind: 'rule_document' | 'excel_embedded') => Promise<StructureRulesResult> = defaultCallAi,
): Promise<FileTransformResult> {
  const rows = await db
    .select({
      id: clientDocument.id,
      contentType: clientDocument.contentType,
      contentHash: clientDocument.contentHash,
      originalFilename: clientDocument.originalFilename,
      storageKey: clientDocument.storageKey,
    })
    .from(clientDocument)
    .where(and(
      eq(clientDocument.id, input.sourceFileId),
      eq(clientDocument.tenantId, input.tenantId),
      eq(clientDocument.clientId, input.clientId),
    ))
    .limit(1)

  const document = rows[0]
  if (!document) {
    return { status: 'failed', error: '급여 규칙 파일을 찾을 수 없습니다' }
  }
  if (!isPayrollRuleDocumentContentType(document.contentType)) {
    return { status: 'failed', error: '지원하지 않는 파일 형식입니다(txt, pdf, xlsx, doc/docx만 가능)' }
  }

  const sourceType = resolvePayrollRuleSourceTypeFromContentType(document.contentType)
  const extractFileType = resolvePayrollRuleExtractFileType(document.contentType)
  if (!sourceType || !extractFileType) {
    return { status: 'failed', error: '지원하지 않는 파일 형식입니다' }
  }
  if (sourceType !== input.expectedSourceType) {
    return { status: 'failed', error: '파일 형식과 요청 유형이 일치하지 않습니다' }
  }

  const blobContent = await get(document.storageKey, { access: 'private' })
  if (!blobContent || blobContent.statusCode !== 200) {
    return { status: 'failed', error: '파일을 읽을 수 없습니다' }
  }

  const fileBuffer = await new Response(blobContent.stream).arrayBuffer()
  const chunks = await extractDocumentTextChunks({
    fileBuffer,
    fileType: extractFileType,
    originalFilename: document.originalFilename,
    contentType: document.contentType,
    profile: extractFileType === 'excel' ? 'payroll' : undefined,
  })

  const extractedText = joinExtractedChunks(chunks)
  if (!extractedText) {
    const summary = chunks.find((chunk) => chunk.summary)?.summary
    return { status: 'failed', error: summary ?? '파일에서 텍스트를 추출하지 못했습니다' }
  }

  const securityLane = classifyPayrollRuleTextSecurityLane(extractedText)
  if (securityLane === 'tee_required') {
    return { status: 'blocked_tee', securityLane: 'tee_required' }
  }

  const aiResult = await callAi(extractedText, sourceType)
  if (!aiResult.success) return { status: 'failed', error: aiResult.error }

  const assembled = assembleRuleDraftFromAiResponse({
    clientId: input.clientId,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    sourceType,
    sourceHash: document.contentHash,
    sourceFileId: document.id,
    securityLane: 'normal',
    model: aiResult.model,
    aiData: aiResult.data,
    ruleIdPrefix: sourceType === 'excel_embedded' ? 'xl' : 'doc',
    citationReferenceFallback: document.originalFilename,
  })
  if (assembled.status === 'failed') return assembled

  return {
    status: 'ok',
    profile: assembled.profile,
    sourceSummary: assembled.sourceSummary,
    sourceHash: document.contentHash,
    model: aiResult.model,
  }
}
