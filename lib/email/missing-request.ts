import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  uploadSession,
  client,
  staff,
  outboundEmail,
  clientChecklist,
  checklistTemplate,
  checklistItem,
  uploadFile,
  materialMatch,
  analysisRun,
  requestItemValidation,
  clientRequestEvent,
  uploadItemDeclaration,
} from '@/lib/db/schema'
import { requireAiEnv, getUploadBaseUrl } from '@/lib/env'
import { resolveStoredUploadUrl } from '@/lib/upload/resolve-upload-url'
import { now, toDBString } from '@/lib/time'
import { providerPriority } from '@/lib/ai/provider-order'
import { formatAccountingPeriod } from './templates'
import { buildPeriodGapMissingRequestDraft, isPeriodGapMissingRequestCriteriaSummary } from './period-gap-missing-request'
import { hasRequestedPeriodDataGap, shouldCreatePeriodGapMissingRequestDraft } from '@/lib/reviews/period-scope-presentation'
import { loadMaterialAttributionSummary } from '@/lib/reviews/load-material-attribution-summary'
import type { ReviewMaterialAttributionSummary } from '@/lib/reviews/review-workspace-types'
import type { SessionEvaluation } from '@/lib/validations/session-evaluation'
import { isMissingRequestDraftTarget } from '@/lib/sessions/completion-eligibility'
import { selectGenuineMissingTargets } from '@/lib/sessions/missing-request-targets'
import { loadReviewSessionById } from '@/lib/reviews/load-review-session-by-id'
import { buildReviewSubmissionPresentation } from '@/lib/reviews/review-submission-status'

const missingDraftSchema = z.object({
  subject: z.string().min(1),
  body_html: z.string().min(1),
  criteria_summary: z.string().nullable().optional(),
})

const parsedAnalysisSchema = z.object({
  detected_file_type: z.string().optional(),
  material_status: z.enum(['sufficient', 'insufficient', 'unknown']).optional(),
  routing_status: z.enum(['matched_candidate', 'needs_review', 'failed']).optional(),
  confidence: z.number().min(0).max(1).optional(),
  explanation: z.string().optional(),
  uncertainty: z.string().nullable().optional(),
  recommended_action: z.string().nullable().optional(),
  criteria_summary: z.string().nullable().optional(),
  risk_flags: z.array(z.string()).optional(),
}).passthrough()

type ParsedAnalysis = z.infer<typeof parsedAnalysisSchema>

type DraftContext = {
  sessionId: string
  tenantId: string
  session: {
    accountingPeriod: string
    analysisNotes: string | null
    extractedCriteria: string | null
    additionalCriteria: string | null
    uploadUrl: string | null
    requestEventId: string | null
    requestEmailCc: string | null
  }
  clientRecord: typeof client.$inferSelect
  staffRecord: typeof staff.$inferSelect
  appliedNotes: string | null
  dueAt: string | null
}

type ValidationRow = typeof requestItemValidation.$inferSelect

function customerFacingItemStatus(status: string) {
  if (status === 'missing') return '제출 없음'
  if (status === 'non_compliant') return '확인 필요'
  return '읽기/확인 필요'
}

function customerFacingItemNote(status: string) {
  if (status === 'missing') {
    return '현재 제출 자료에서 확인되지 않았습니다.'
  }
  if (status === 'non_compliant') {
    return '제출 자료와 요청 항목의 연결을 확인해야 합니다.'
  }
  return '파일을 읽거나 내용을 확인하기 어려웠습니다.'
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function insertMissingRequestDraft(params: {
  context: DraftContext
  subject: string
  bodyHtml: string
  criteriaSummary: string | null
}) {
  await db.insert(outboundEmail).values({
    id: crypto.randomUUID(),
    uploadSessionId: params.context.sessionId,
    tenantId: params.context.tenantId,
    type: 'missing_request',
    status: 'draft',
    toEmail: params.context.clientRecord.email,
    ccEmail: params.context.session.requestEmailCc,
    subject: params.subject,
    body: params.bodyHtml,
    appliedAnalysisNotes: params.context.appliedNotes,
    criteriaSummary: params.criteriaSummary,
    createdAt: toDBString(now()),
  })
}

async function listSessionMissingRequestDrafts(sessionId: string, tenantId: string) {
  return db
    .select({
      id: outboundEmail.id,
      criteriaSummary: outboundEmail.criteriaSummary,
      createdAt: outboundEmail.createdAt,
    })
    .from(outboundEmail)
    .where(
      and(
        eq(outboundEmail.uploadSessionId, sessionId),
        eq(outboundEmail.tenantId, tenantId),
        eq(outboundEmail.type, 'missing_request'),
        eq(outboundEmail.status, 'draft'),
      ),
    )
    .orderBy(desc(outboundEmail.createdAt))
}

/** 동시 요청으로 쌓인 기간 부재 draft를 세션당 1건으로 정리한다. */
async function reconcilePeriodGapMissingRequestDrafts(sessionId: string, tenantId: string): Promise<string | null> {
  const drafts = await listSessionMissingRequestDrafts(sessionId, tenantId)
  const periodGapDrafts = drafts.filter((draft) =>
    isPeriodGapMissingRequestCriteriaSummary(draft.criteriaSummary),
  )
  if (periodGapDrafts.length <= 1) return periodGapDrafts[0]?.id ?? null

  const [keep, ...duplicates] = periodGapDrafts
  await db.delete(outboundEmail).where(
    and(
      eq(outboundEmail.tenantId, tenantId),
      inArray(outboundEmail.id, duplicates.map((draft) => draft.id)),
    ),
  )
  return keep.id
}

async function generatePeriodGapDraft(
  context: DraftContext,
  summary: ReviewMaterialAttributionSummary,
): Promise<boolean> {
  if (!hasRequestedPeriodDataGap(summary)) return false

  const draft = buildPeriodGapMissingRequestDraft({
    clientName: context.clientRecord.name,
    contactName: context.clientRecord.contactName,
    staffName: context.staffRecord.name,
    accountingPeriod: context.session.accountingPeriod,
    uploadUrl: context.session.uploadUrl,
    uploadBaseUrl: getUploadBaseUrl(),
    summary,
  })
  if (!draft) return false

  await insertMissingRequestDraft({
    context,
    subject: draft.subject,
    bodyHtml: draft.bodyHtml,
    criteriaSummary: draft.criteriaSummary,
  })

  console.info(`[generateMissingRequestDraft] 세션 ${context.sessionId} 요청 기간 부재 보충요청 초안 생성 완료`)
  return true
}

async function createDraftWithClaude(params: {
  context: DraftContext
  prompt: string
  successLog: string
}) {
  const { ANTHROPIC_API_KEY } = requireAiEnv()
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: params.prompt }],
  })

  const rawOutput = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonMatch) {
    throw new Error('Claude 응답에서 JSON을 찾지 못했습니다')
  }

  const parsed = missingDraftSchema.safeParse(JSON.parse(jsonMatch))
  if (!parsed.success) {
    throw new Error(`Claude 초안 Zod 검증 실패: ${parsed.error.message}`)
  }

  const { subject, body_html, criteria_summary } = parsed.data

  await insertMissingRequestDraft({
    context: params.context,
    subject,
    bodyHtml: body_html,
    criteriaSummary: criteria_summary ?? null,
  })

  console.info(params.successLog)
}

async function createFallbackValidationDraft(context: DraftContext, actionItems: ValidationRow[]) {
  const formattedPeriod = formatAccountingPeriod(context.session.accountingPeriod)
  const uploadLinkText = context.session.uploadUrl
    ? context.session.uploadUrl
    : `${getUploadBaseUrl()}/upload`
  const itemBlocks = actionItems.map((item) => {
    const statusLabel = customerFacingItemStatus(item.validationStatus)
    const note = customerFacingItemNote(item.validationStatus)
    return `
      <li style="margin-bottom:10px;">
        <strong>${escapeHtml(item.itemName)}</strong>
        <span style="display:inline-block;margin-left:6px;color:#b45309;">${escapeHtml(statusLabel)}</span><br />
        <span style="color:#4b5563;">${escapeHtml(note)}</span>
      </li>`
  }).join('')

  const subject = `[${context.clientRecord.name}] ${formattedPeriod} 제출 자료 확인 안내`
  const bodyHtml = `
    <div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;line-height:1.6;">
      <p>안녕하세요, ${escapeHtml(context.clientRecord.contactName ?? context.clientRecord.name)} 담당자님.</p>
      <p>제출해주신 ${escapeHtml(formattedPeriod)} 자료를 확인했습니다.</p>
      <p>아래 항목은 아직 제출되지 않았거나 추가 확인이 필요한 것으로 보입니다. 해당 자료가 있으시면 기한 내 기존 업로드 링크로 추가 업로드해 주세요.</p>
      <ul style="padding-left:20px;">${itemBlocks}</ul>
      <p>해당 자료가 없거나 관련 거래가 없다면 현재 제출해주신 자료를 기준으로 작업을 진행하겠습니다.</p>
      <p><a href="${escapeHtml(uploadLinkText)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;">자료 업로드하기</a></p>
      <p>감사합니다.<br />${escapeHtml(context.staffRecord.name)} 드림</p>
    </div>`

  await insertMissingRequestDraft({
    context,
    subject,
    bodyHtml,
    criteriaSummary: `제출자료 확인 안내 — ${actionItems.length}개 항목`,
  })
}

function parseAnalysisOutput(value: string | null): ParsedAnalysis | null {
  if (!value) return null
  try {
    const parsed = parsedAnalysisSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function shouldAskForFollowUp(file: {
  status: string
  parsed: ParsedAnalysis | null
  errorMessage: string | null
}) {
  if (file.status === 'failed' || file.status === 'rejected') return true
  if (file.status === 'needs_review') return true
  if (file.errorMessage) return true
  if (!file.parsed) return false
  if (file.parsed.routing_status === 'needs_review' || file.parsed.routing_status === 'failed') return true
  if (file.parsed.material_status === 'insufficient' || file.parsed.material_status === 'unknown') return true
  return (file.parsed.risk_flags?.length ?? 0) > 0
}

async function generateValidationBasedDraft(
  context: DraftContext,
  actionItems: ValidationRow[],
): Promise<void> {
  // actionItems는 호출부에서 이미 제출됨/고객 선언/담당자 제외를 걸러낸 "진짜 보충요청 대상"이다.
  if (actionItems.length === 0) return

  const formattedPeriod = formatAccountingPeriod(context.session.accountingPeriod)
  const uploadLinkText = context.session.uploadUrl
    ? context.session.uploadUrl
    : `${getUploadBaseUrl()}/upload (담당 회계사에게 링크를 요청하세요)`
  const dueSection = context.dueAt
    ? `**제출 마감:** ${context.dueAt.slice(0, 10)}\n`
    : ''

  const itemList = actionItems.map((item, i) => {
    const statusLabel = customerFacingItemStatus(item.validationStatus)
    const note = customerFacingItemNote(item.validationStatus)
    return `${i + 1}. [${statusLabel}] ${item.itemName}\n  안내 기준: ${note}`
  }).join('\n')

  const prompt = `당신은 회계법인의 기장 자료 수집 담당자를 돕는 AI입니다.
담당자가 검토한 항목별 제출 상태를 바탕으로 클라이언트에게 보낼 제출 자료 확인 이메일 초안을 작성해주세요.

**클라이언트 회사명:** ${context.clientRecord.name}
**담당 회계사:** ${context.staffRecord.name}
**자료 요청 기간:** ${formattedPeriod}
**업로드 포털 링크:** ${uploadLinkText}
${dueSection}
**제출되지 않았거나 확인이 필요한 항목:**
${itemList}

다음 규칙을 반드시 따르세요:
- "필수", "누락", "불합격" 같은 압박감 있는 표현을 사용하지 마세요
- 자료가 있으면 기한 내 기존 업로드 링크로 추가 업로드해 달라고 표현하세요
- 자료가 없거나 해당 거래가 없으면 현재 제출 자료 기준으로 작업을 진행하겠다고 안내하세요
- 판독이 어려운 항목도 단정하지 말고 더 정확한 자료가 있으면 업로드해 달라고 표현하세요
- 업로드 포털 링크를 버튼 형태로 포함하세요
- 정중하고 명확한 한국어로 작성하세요
- HTML 형식으로 작성하되 인라인 스타일만 사용하세요 (외부 CSS 없음)
- max-width: 600px, 흰 배경, 기본 sans-serif 폰트

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON):
{
  "subject": "이메일 제목",
  "body_html": "완전한 HTML 이메일 본문",
  "criteria_summary": "제출자료 확인 안내 — 항목 요약 한 줄"
}`

  try {
    await createDraftWithClaude({
      context,
      prompt,
      successLog: `[generateMissingRequestDraft] 세션 ${context.sessionId} validation 기반 제출자료 확인 초안 생성 완료`,
    })
  } catch (err) {
    console.error(`[generateMissingRequestDraft] 세션 ${context.sessionId} Claude 초안 생성 실패, 기본 초안으로 대체:`, err)
    await createFallbackValidationDraft(context, actionItems)
  }
}

async function generateEvaluationBasedDraft(
  context: DraftContext,
  evaluation: SessionEvaluation,
): Promise<void> {
  const actionItems = evaluation.criteria.filter(
    (c) => c.status === 'missing' || c.status === 'non_compliant' || c.status === 'uncertain',
  )
  if (actionItems.length === 0) return

  const formattedPeriod = formatAccountingPeriod(context.session.accountingPeriod)
  const uploadLinkText = context.session.uploadUrl
    ? context.session.uploadUrl
    : `${getUploadBaseUrl()}/upload (담당 회계사에게 링크를 요청하세요)`

  const itemList = actionItems.map((item, i) => {
    const statusLabel = customerFacingItemStatus(item.status)
    const note = customerFacingItemNote(item.status)
    return `${i + 1}. [${statusLabel}] ${item.criterion_text}\n  안내 기준: ${note}`
  }).join('\n')

  const prompt = `당신은 회계법인의 기장 자료 수집 담당자를 돕는 AI입니다.
AI 선검증 결과를 바탕으로 클라이언트에게 보낼 제출 자료 확인 이메일 초안을 작성해주세요.

**클라이언트 회사명:** ${context.clientRecord.name}
**담당 회계사:** ${context.staffRecord.name}
**자료 요청 기간:** ${formattedPeriod}
**업로드 포털 링크:** ${uploadLinkText}

**AI 선검증 요약:** ${evaluation.summary}

**제출되지 않았거나 확인이 필요한 항목:**
${itemList}

다음 규칙을 반드시 따르세요:
- "필수", "누락", "불합격" 같은 압박감 있는 표현을 사용하지 마세요
- 선검증 결과를 근거로 하되 단정적 표현은 피하세요
- 자료가 있으면 기한 내 기존 업로드 링크로 추가 업로드해 달라고 표현하세요
- 자료가 없거나 해당 거래가 없으면 현재 제출 자료 기준으로 작업을 진행하겠다고 안내하세요
- 업로드 포털 링크를 버튼 형태로 포함하세요
- 정중하고 명확한 한국어로 작성하세요
- HTML 형식으로 작성하되 인라인 스타일만 사용하세요 (외부 CSS 없음)
- max-width: 600px, 흰 배경, 기본 sans-serif 폰트

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON):
{
  "subject": "이메일 제목",
  "body_html": "완전한 HTML 이메일 본문",
  "criteria_summary": "AI 선검증 기반 제출자료 확인 안내 — 적용 기준 한 줄 요약"
}`

  await createDraftWithClaude({
    context,
    prompt,
      successLog: `[generateMissingRequestDraft] 세션 ${context.sessionId} 평가 기반 제출자료 확인 초안 생성 완료`,
  })
}

async function generateCriteriaBasedDraft(context: DraftContext): Promise<void> {
  const files = await db
    .select({
      id: uploadFile.id,
      originalFilename: uploadFile.originalFilename,
      fileType: uploadFile.fileType,
      status: uploadFile.status,
    })
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, context.sessionId), eq(uploadFile.tenantId, context.tenantId)))

  if (files.length === 0) return

  const runs = await db
    .select({
      uploadFileId: analysisRun.uploadFileId,
      provider: analysisRun.provider,
      status: analysisRun.status,
      errorMessage: analysisRun.errorMessage,
      parsedOutput: analysisRun.parsedOutput,
      criteriaSummary: analysisRun.criteriaSummary,
      confidence: analysisRun.confidence,
      consensusGroup: analysisRun.consensusGroup,
      createdAt: analysisRun.createdAt,
    })
    .from(analysisRun)
    .where(
      and(
        inArray(analysisRun.uploadFileId, files.map((file) => file.id)),
        eq(analysisRun.tenantId, context.tenantId),
      ),
    )

  const fileSummaries = files.map((file) => {
    const representativeRun = runs
      .filter((run) => run.uploadFileId === file.id)
      .sort((a, b) => {
        const aScore = a.status === 'completed' && a.parsedOutput ? 0 : a.status === 'completed' ? 1 : 2
        const bScore = b.status === 'completed' && b.parsedOutput ? 0 : b.status === 'completed' ? 1 : 2
        if (aScore !== bScore) return aScore - bScore
        return providerPriority(a.provider) - providerPriority(b.provider)
      })[0]
    const parsed = parseAnalysisOutput(representativeRun?.parsedOutput ?? null)

    return {
      filename: file.originalFilename,
      fileType: file.fileType,
      status: file.status,
      provider: representativeRun?.provider ?? null,
      confidence: representativeRun?.confidence ?? null,
      consensusGroup: representativeRun?.consensusGroup ?? null,
      criteriaSummary: representativeRun?.criteriaSummary ?? parsed?.criteria_summary ?? null,
      errorMessage: representativeRun?.errorMessage ?? null,
      parsed,
    }
  })

  const followUpTargets = fileSummaries.filter(shouldAskForFollowUp)
  if (followUpTargets.length === 0) return

  const formattedPeriod = formatAccountingPeriod(context.session.accountingPeriod)
  const uploadLinkText = context.session.uploadUrl
    ? context.session.uploadUrl
    : `${getUploadBaseUrl()}/upload (담당 회계사에게 링크를 요청하세요)`
  const criteriaSection = context.appliedNotes
    ? `\n**요청 메일에서 확정한 판단 기준:**\n${context.appliedNotes}`
    : '\n**요청 메일에서 확정한 판단 기준:**\n별도 기준 없음'
  const fileReviewList = followUpTargets
    .map((file, index) => {
      const riskFlags = file.parsed?.risk_flags?.length
        ? `\n  - 위험/불확실성: ${file.parsed.risk_flags.join('; ')}`
        : ''
      return `${index + 1}. ${file.filename}
  - 파일 상태: ${file.status}
  - 감지 자료: ${file.parsed?.detected_file_type ?? '불명'}
  - AI 판단: ${file.parsed?.explanation ?? file.errorMessage ?? '판단 근거 없음'}
  - 권장 조치: ${file.parsed?.recommended_action ?? '담당자 확인 필요'}
  - 적용 기준 요약: ${file.criteriaSummary ?? '없음'}${riskFlags}`
    })
    .join('\n')

  const prompt = `당신은 회계법인의 기장 자료 수집 담당자를 돕는 AI입니다.
체크리스트 항목은 없지만, 최초 요청 메일에서 추출한 판단 기준과 파일별 AI 분석 결과가 있습니다.
다음 정보를 바탕으로 클라이언트에게 보낼 제출 자료 확인 이메일 초안을 작성해주세요.

**클라이언트 회사명:** ${context.clientRecord.name}
**담당 회계사:** ${context.staffRecord.name}
**자료 요청 기간:** ${formattedPeriod}
**업로드 포털 링크:** ${uploadLinkText}
${criteriaSection}

**추가 확인이 필요한 파일과 AI 판단:**
${fileReviewList}

다음 규칙을 반드시 따르세요:
- 이미 제출된 파일은 인정하되, 왜 추가 확인이나 재제출이 필요한지 정중하게 설명하세요
- "필수", "누락", "불합격" 같은 압박감 있는 표현을 사용하지 마세요
- 자료가 있으면 기한 내 기존 업로드 링크로 추가 업로드해 달라고 표현하세요
- 자료가 없거나 해당 거래가 없으면 현재 제출 자료 기준으로 작업을 진행하겠다고 안내하세요
- 원본 근거가 약한 내용은 단정하지 말고 "확인 부탁드립니다" 식으로 표현하세요
- 요청 메일 기준에 맞지 않거나 불명확한 자료만 고객에게 확인하도록 안내하세요
- 업로드 포털 링크를 버튼 형태로 포함하세요
- 담당 회계사가 승인 후 발송할 초안이므로 과도하게 확정적인 표현을 피하세요
- HTML 형식으로 작성하되 인라인 스타일만 사용하세요 (외부 CSS 없음)
- max-width: 600px, 흰 배경, 기본 sans-serif 폰트

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON):
{
  "subject": "이메일 제목",
  "body_html": "완전한 HTML 이메일 본문",
  "criteria_summary": "적용된 요청 기준과 파일 분석 결과 한 줄 요약"
}`

  await createDraftWithClaude({
    context,
    prompt,
    successLog: `[generateMissingRequestDraft] 세션 ${context.sessionId} 기준 기반 제출자료 확인 초안 생성 완료`,
  })
}

async function loadDeclaredItemNames(sessionId: string, tenantId: string): Promise<string[]> {
  const rows = await db
    .select({ name: checklistItem.name })
    .from(uploadItemDeclaration)
    .innerJoin(checklistItem, eq(uploadItemDeclaration.checklistItemId, checklistItem.id))
    .where(
      and(
        eq(uploadItemDeclaration.uploadSessionId, sessionId),
        eq(uploadItemDeclaration.tenantId, tenantId),
      ),
    )

  return rows.map((row) => row.name)
}

export async function generateMissingRequestDraft(
  sessionId: string,
  tenantId: string,
  sessionEvaluation?: SessionEvaluation | null,
): Promise<void> {
  // 세션 + 클라이언트 + 담당자 조회
  const sessionRows = await db
    .select({
      session: {
        id: uploadSession.id,
        accountingPeriod: uploadSession.accountingPeriod,
        analysisNotes: uploadSession.analysisNotes,
        extractedCriteria: uploadSession.extractedCriteria,
        additionalCriteria: uploadSession.additionalCriteria,
        uploadUrl: uploadSession.uploadUrl,
        sessionEvaluation: uploadSession.sessionEvaluation,
        requestEventId: uploadSession.requestEventId,
        requestEmailCc: uploadSession.requestEmailCc,
      },
      clientRecord: client,
      staffRecord: staff,
    })
    .from(uploadSession)
    .innerJoin(client, eq(uploadSession.clientId, client.id))
    .innerJoin(staff, eq(uploadSession.createdByStaffId, staff.id))
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
    .limit(1)

  const row = sessionRows[0]
  if (!row) return

  const { session: rawSession, clientRecord, staffRecord } = row
  const session = {
    ...rawSession,
    uploadUrl: resolveStoredUploadUrl(rawSession.uploadUrl),
  }

  const appliedNotes =
    [
      clientRecord.analysisNotes,
      session.analysisNotes,
      session.extractedCriteria,
      session.additionalCriteria,
    ].filter(Boolean).join('\n') || null

  // request_item_validation rows 조회 (담당자 검토 상태 반영된 1차 소스)
  const validationRows = await db
    .select()
    .from(requestItemValidation)
    .where(and(eq(requestItemValidation.uploadSessionId, sessionId), eq(requestItemValidation.tenantId, tenantId)))

  const reviewSession = await loadReviewSessionById(tenantId, sessionId)
  const submittedValidationIds = new Set<string>()
  if (reviewSession) {
    const presentation = buildReviewSubmissionPresentation(reviewSession)
    for (const presented of presentation.presentedRows) {
      if (presented.submissionStatusKey === 'submitted') {
        submittedValidationIds.add(presented.validation.id)
      }
    }
  }

  const declaredItemNames = await loadDeclaredItemNames(sessionId, tenantId)
  const genuineMissingTargets = selectGenuineMissingTargets(
    validationRows.filter(isMissingRequestDraftTarget),
    submittedValidationIds,
    declaredItemNames,
  )

  // requestEventId로 dueAt 조회
  let dueAt: string | null = null
  if (session.requestEventId) {
    const eventRows = await db
      .select({ dueAt: clientRequestEvent.dueAt })
      .from(clientRequestEvent)
      .where(and(eq(clientRequestEvent.id, session.requestEventId), eq(clientRequestEvent.tenantId, tenantId)))
      .limit(1)
    dueAt = eventRows[0]?.dueAt ?? null
  }

  const context: DraftContext = {
    sessionId,
    tenantId,
    session,
    clientRecord,
    staffRecord,
    appliedNotes,
    dueAt,
  }

  const attributionSummary = await loadMaterialAttributionSummary({ sessionId, tenantId })
  const uploadedFiles = await db
    .select({ id: uploadFile.id })
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, sessionId), eq(uploadFile.tenantId, tenantId)))
  const uploadedFileCount = uploadedFiles.length

  if (attributionSummary && shouldCreatePeriodGapMissingRequestDraft(attributionSummary, uploadedFileCount)) {
    const keptPeriodGapDraftId = await reconcilePeriodGapMissingRequestDrafts(sessionId, tenantId)

    const existingDrafts = await listSessionMissingRequestDrafts(sessionId, tenantId)
    const staleDraftIds = existingDrafts
      .filter((draft) => !isPeriodGapMissingRequestCriteriaSummary(draft.criteriaSummary))
      .map((draft) => draft.id)
    if (staleDraftIds.length > 0) {
      await db.delete(outboundEmail).where(
        and(
          eq(outboundEmail.tenantId, tenantId),
          inArray(outboundEmail.id, staleDraftIds),
        ),
      )
    }

    if (!keptPeriodGapDraftId) {
      await generatePeriodGapDraft(context, attributionSummary)
      await reconcilePeriodGapMissingRequestDrafts(sessionId, tenantId)
    }
    return
  }

  const existingDrafts = await listSessionMissingRequestDrafts(sessionId, tenantId)

  const obsoletePeriodGapDraftIds = existingDrafts
    .filter((draft) => isPeriodGapMissingRequestCriteriaSummary(draft.criteriaSummary))
    .map((draft) => draft.id)
  if (obsoletePeriodGapDraftIds.length > 0) {
    await db.delete(outboundEmail).where(
      and(
        eq(outboundEmail.tenantId, tenantId),
        inArray(outboundEmail.id, obsoletePeriodGapDraftIds),
      ),
    )
  }

  const remainingDrafts = existingDrafts.filter((draft) => !obsoletePeriodGapDraftIds.includes(draft.id))
  if (validationRows.length > 0 && genuineMissingTargets.length === 0) {
    if (remainingDrafts.length > 0) {
      await db.delete(outboundEmail).where(
        and(
          eq(outboundEmail.tenantId, tenantId),
          inArray(outboundEmail.id, remainingDrafts.map((draft) => draft.id)),
        ),
      )
    }
    return
  }

  if (remainingDrafts.length > 0) return

  // 1순위: request_item_validation rows가 있으면 담당자 검토 상태 기반 초안
  // 실패 시 return 없이 하위 경로로 fallback (Claude 응답 파싱 실패 등 대비)
  if (validationRows.length > 0) {
    try {
      await generateValidationBasedDraft(context, genuineMissingTargets)
      return
    } catch (err) {
      console.error(`[generateMissingRequestDraft] 세션 ${sessionId} validation 기반 초안 생성 실패, sessionEvaluation으로 fallback:`, err)
    }
  }

  // 2순위: sessionEvaluation JSON이 있으면 평가 기반 초안 (validation rows 없는 레거시 세션)
  if (!sessionEvaluation && session.sessionEvaluation) {
    try {
      const { sessionEvaluationSchema } = await import('@/lib/validations/session-evaluation')
      const parsed = sessionEvaluationSchema.safeParse(JSON.parse(session.sessionEvaluation))
      if (parsed.success) sessionEvaluation = parsed.data
    } catch { /* ignore — fallback to checklist-based draft */ }
  }
  if (sessionEvaluation) {
    try {
      await generateEvaluationBasedDraft(context, sessionEvaluation)
      return
    } catch (err) {
      console.error(`[generateMissingRequestDraft] 세션 ${sessionId} 평가 기반 초안 생성 실패, checklist로 fallback:`, err)
    }
  }

  // 요청 체크리스트 항목 조회
  const requiredItemRows = await db
    .select({ item: checklistItem })
    .from(clientChecklist)
    .innerJoin(checklistTemplate, eq(clientChecklist.templateId, checklistTemplate.id))
    .innerJoin(checklistItem, eq(checklistItem.templateId, checklistTemplate.id))
    .where(
      and(
        eq(clientChecklist.clientId, clientRecord.id),
        eq(clientChecklist.tenantId, tenantId),
        eq(checklistItem.required, true),
      ),
    )

  if (requiredItemRows.length === 0) {
    try {
      await generateCriteriaBasedDraft(context)
    } catch (err) {
      console.error(`[generateMissingRequestDraft] 세션 ${sessionId} 기준 기반 초안 생성 실패:`, err)
    }
    return
  }

  // 이 세션의 충족된 매칭 항목 조회
  const files = uploadedFiles

  const satisfiedItemIds = new Set<string>()
  if (files.length > 0) {
    const satisfiedMatches = await db
      .select({ checklistItemId: materialMatch.checklistItemId })
      .from(materialMatch)
      .where(
        and(
          inArray(
            materialMatch.uploadFileId,
            files.map((f) => f.id),
          ),
          eq(materialMatch.tenantId, tenantId),
          inArray(materialMatch.status, ['matched', 'manual_approved']),
        ),
      )
    satisfiedMatches.forEach((m) => satisfiedItemIds.add(m.checklistItemId))
  }

  // 제출되지 않은 항목 계산
  const missingItems = requiredItemRows
    .map((r) => r.item)
    .filter((item) => !satisfiedItemIds.has(item.id))

  if (missingItems.length === 0) return
  // 체크리스트 경로도 미업로드(매칭 0건) 세션에는 보충요청을 만들지 않는다.
  if (files.length === 0 || satisfiedItemIds.size === 0) return

  const uploadUrl = session.uploadUrl

  const formattedPeriod = formatAccountingPeriod(session.accountingPeriod)
  const missingItemsList = missingItems
    .map((item, i) => `${i + 1}. ${item.name}${item.description ? ` (${item.description})` : ''}`)
    .join('\n')

  const criteriaSection = appliedNotes
    ? `\n**회사별 분석 기준:**\n${appliedNotes}`
    : ''

  const uploadLinkText = uploadUrl
    ? uploadUrl
    : `${getUploadBaseUrl()}/upload (담당 회계사에게 링크를 요청하세요)`

  const prompt = `당신은 회계법인의 기장 자료 수집 담당자를 돕는 AI입니다.
다음 정보를 바탕으로 클라이언트에게 보낼 제출 자료 확인 이메일 초안을 작성해주세요.

**클라이언트 회사명:** ${clientRecord.name}
**담당 회계사:** ${staffRecord.name}
**자료 요청 기간:** ${formattedPeriod}
**업로드 포털 링크:** ${uploadLinkText}
${criteriaSection}

**제출되지 않은 것으로 보이는 자료 목록:**
${missingItemsList}

다음 규칙을 반드시 따르세요:
- 원본 파일 근거가 약한 내용은 단정적으로 요청하지 말고 "확인 부탁드립니다" 식으로 표현하세요
- "필수", "누락", "불합격" 같은 압박감 있는 표현을 사용하지 마세요
- 구체적인 자료명과 요청 기간을 포함하되, 자료가 있으면 기한 내 기존 업로드 링크로 추가 업로드해 달라고 표현하세요
- 자료가 없거나 해당 거래가 없으면 현재 제출 자료 기준으로 작업을 진행하겠다고 안내하세요
- 업로드 포털 링크를 버튼 형태로 포함하세요
- 정중하고 명확한 한국어로 작성하세요
- HTML 형식으로 작성하되 인라인 스타일만 사용하세요 (외부 CSS 없음)
- max-width: 600px, 흰 배경, 기본 sans-serif 폰트

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON):
{
  "subject": "이메일 제목",
  "body_html": "완전한 HTML 이메일 본문",
  "criteria_summary": "적용된 회사별 분석 기준 한 줄 요약 (기준 없으면 null)"
}`

  try {
    await createDraftWithClaude({
      context,
      prompt,
      successLog: `[generateMissingRequestDraft] 세션 ${sessionId} 제출자료 확인 초안 생성 완료`,
    })
  } catch (err) {
    // 초안 생성 실패는 핵심 흐름(업로드·분석)을 차단하지 않음
    console.error(`[generateMissingRequestDraft] 세션 ${sessionId} 초안 생성 실패:`, err)
  }
}
