import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  uploadSession,
  uploadFile,
  analysisRun,
  client,
  requestItemValidation,
  requestItemValidationFile,
} from '@/lib/db/schema'
import { requireAiEnv } from '@/lib/env'
import {
  defaultCriteriaForWorkType,
  inferGeneralDefaultCriteriaWorkType,
  mergeGeneralDefaultCriteriaRows,
} from '@/lib/review/default-criteria'
import { now, toDBString } from '@/lib/time'
import {
  sessionEvaluationSchema,
} from '@/lib/validations/session-evaluation'
import {
  applyDeterministicDefaultCriteriaLinks,
  inferDefaultCriterionGroup,
  type EvaluationFileSummary,
} from './session-eval-default-links'
import { normalizeEvaluationFilenameKey } from './filename-normalization'
import { providerPriority } from './provider-order'
import type { SessionEvaluationOutcome } from './session-evaluation-outcome'

async function rollbackSessionToSubmitted(sessionId: string, tenantId: string) {
  await db
    .update(uploadSession)
    .set({ status: 'submitted' })
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
}

function buildEvaluationPrompt(params: {
  clientName: string
  accountingPeriod: string
  requestEmailBody: string | null
  extractedCriteria: string | null
  additionalCriteria: string | null
  requestItemCriteria: string | null
  clientAnalysisNotes: string | null
  sessionAnalysisNotes: string | null
  fileSummaries: EvaluationFileSummary[]
}): string {
  const criteriaSection = [
    params.requestEmailBody ? `**요청 메일 원문:**\n${params.requestEmailBody}` : null,
    params.extractedCriteria ? `**요청 메일에서 추출한 기준:**\n${params.extractedCriteria}` : null,
    params.additionalCriteria ? `**담당자 추가 기준:**\n${params.additionalCriteria}` : null,
    params.requestItemCriteria ? `**요청자료 기준:**\n${params.requestItemCriteria}` : null,
    params.clientAnalysisNotes ? `**회사 기본 기준:**\n${params.clientAnalysisNotes}` : null,
    params.sessionAnalysisNotes ? `**세션 기준:**\n${params.sessionAnalysisNotes}` : null,
  ].filter(Boolean).join('\n\n')

  const fileList = params.fileSummaries.map((f, i) => `${i + 1}. [파일명: ${f.filename}] (${f.fileType})
  - 파일 상태: ${f.status}
  - 감지 자료 유형: ${f.detectedFileType ?? '불명'}
  - AI 판단: ${f.explanation ?? '근거 없음'}
  - 자료 충족 여부: ${f.materialStatus ?? '불명'}
  - 라우팅: ${f.routingStatus ?? '불명'}
  - 신뢰도: ${f.confidence ?? '불명'}
  - 위험 플래그: ${f.riskFlags.length > 0 ? f.riskFlags.join(', ') : '없음'}`).join('\n')

  return `당신은 한국 회계법인의 기장 자료 수집을 검토하는 전문 AI입니다.

회계담당자가 클라이언트에게 보낸 요청 메일의 조건과, 클라이언트가 실제로 제출한 파일을 비교해 전체 제출물을 평가하세요.

**클라이언트:** ${params.clientName}
**회계 기간:** ${params.accountingPeriod}

${criteriaSection || '(별도 기준 없음 — 파일 분석 결과만으로 판단하세요)'}

**제출된 파일 목록 및 AI 분석 결과:**
${fileList || '(제출된 파일 없음)'}

평가 원칙:
- criteria는 요청 메일 원문 또는 요청자료 기준에 명시된 조건만 포함하세요. 명시된 기준에 없는 일반 회계 관례, 추론에 의한 기준(예: "사업자번호 유효성", "복수 계좌 여부")은 절대 추가하지 마세요.
- 요청자료 기준이 제시된 경우, 해당 기준에 나열된 항목은 요청 항목과 참고 항목을 모두 criteria에 정확히 1개씩 포함하세요.
- related_filenames에는 위 목록의 [파일명: ...] 안에 있는 값만 정확히 그대로 복사하세요. 요약하거나 변형하지 마세요.
- 파일명과 감지 자료 유형/AI 판단이 충돌하면 파일명보다 감지 자료 유형과 내부 내용 근거를 우선하세요.
- 파일명은 요청자료처럼 보이지만 내부 내용이 월별 집계표, 신고요약표, 설명자료처럼 거래일자/거래처/건별 금액이 없는 경우, 해당 파일만으로 material 항목을 satisfied 처리하지 마세요.
- 잘못 올린 파일은 관련 요청자료 항목을 non_compliant로 판정하고, requested_action에 실제 필요한 거래/정산 상세내역 재제출 요청을 적으세요.
- criterion_type은 요청 메일 원문 또는 요청자료 기준을 기준으로 다음 중 하나로 분류하세요: material(자료 제출 자체), reconciliation(자료 간 금액/기간/거래 흐름 대사 — 명시된 경우만), format_check(파일 형식/읽기 가능성 — 명시된 경우만), other(위 셋에 해당 없고 명확한 조항이 있을 때만).
- reconciliation, format_check, other는 요청 메일 또는 요청자료 기준에 명확한 근거가 없으면 아예 생략하세요.
- 요청 메일 원문 또는 요청자료 기준에 명시된 조건을 기준으로 각 항목을 satisfied/missing/non_compliant/uncertain 중 하나로 판정하세요.
- 자료가 아예 제출되지 않았으면 missing으로 분류하세요.
- 요청자료 기준에 "참고 항목"으로 표시된 자료는 관련 파일이 없어도 missing으로 분류하지 말고 satisfied로 처리하거나 criteria에서 생략하세요.
- 파일이 제출되었지만 기간, 자료 종류, 내용, 금액, 범위, 대사 결과가 요건과 맞지 않으면 non_compliant로 분류하세요.
- 원문에 "특별 요청 없으면 제출 불필요"처럼 제외 조건이 있으면 satisfied로 처리하세요.
- uncertain은 파일 손상, 암호, 열람 실패, 텍스트/표 추출 실패처럼 자료를 읽을 수 없는 예외 상황에만 사용하세요. 단순히 확신이 낮거나 담당자 확인이 필요하다는 이유만으로 uncertain을 사용하지 마세요.
- overall_verdict는 criterion_type = material인 항목만 기준으로 판정하세요. reconciliation/format_check/other 항목은 전체 판정에 포함하지 마세요. material 항목이 모두 satisfied면 sufficient, missing/non_compliant가 하나라도 있으면 needs_resubmission, uncertain만 있으면 uncertain으로 판정하세요.

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON):
{
  "overall_verdict": "sufficient | needs_resubmission | uncertain",
  "criteria": [
    {
      "criterion_text": "조건 원문 또는 요약",
      "criterion_type": "material | reconciliation | format_check | other",
      "status": "satisfied | missing | non_compliant | uncertain",
      "related_filenames": ["실제파일명.pdf"],
      "reason": "판단 근거 (2~3문장)",
      "requested_action": "클라이언트에게 요청할 조치 또는 null",
      "confidence": "high | medium | low"
    }
  ],
  "summary": "전체 평가 요약 (2~3문장, 한국어)",
  "applied_criteria_snapshot": "평가에 사용된 주요 기준 원문 요약"
}`
}

export async function evaluateSessionAgainstCriteria(
  sessionId: string,
  tenantId: string,
): Promise<SessionEvaluationOutcome> {
  // 1. 세션 + 클라이언트 조회 (담당자 join 실패로 평가가 막히지 않도록 leftJoin)
  const sessionRows = await db
    .select({
      session: uploadSession,
      clientRecord: client,
    })
    .from(uploadSession)
    .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
    .limit(1)

  const row = sessionRows[0]
  if (!row) {
    return {
      ok: false,
      code: 'session_not_found',
      message: '세션을 찾을 수 없습니다.',
    }
  }

  const { session, clientRecord } = row

  // 이미 평가 완료된 상태면 스킵
  if (['needs_resubmission', 'ready_for_accountant', 'completed'].includes(session.status)) {
    return {
      ok: false,
      code: 'already_evaluated',
      message: '이미 평가가 완료된 세션입니다.',
    }
  }

  // 2. 상태를 ai_checking으로 전환
  await db
    .update(uploadSession)
    .set({ status: 'ai_checking' })
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))

  try {
    // 3. 파일 목록 + 분석 결과 수집
    const files = await db
      .select()
      .from(uploadFile)
      .where(and(eq(uploadFile.uploadSessionId, sessionId), eq(uploadFile.tenantId, tenantId)))

    const runs = files.length > 0
      ? await db
          .select()
          .from(analysisRun)
          .where(
            and(
              inArray(analysisRun.uploadFileId, files.map((f) => f.id)),
              eq(analysisRun.tenantId, tenantId),
            ),
          )
      : []

    const fileSummaries = files.map((file) => {
      const representativeRun = runs
        .filter((r) => r.uploadFileId === file.id)
        .sort((a, b) => {
          const score = (r: typeof a) =>
            r.status === 'completed' && r.parsedOutput ? 0 : r.status === 'completed' ? 1 : 2
          const diff = score(a) - score(b)
          if (diff !== 0) return diff
          return providerPriority(a.provider) - providerPriority(b.provider)
        })[0]

      let parsed: Record<string, unknown> | null = null
      try {
        if (representativeRun?.parsedOutput) {
          parsed = JSON.parse(representativeRun.parsedOutput) as Record<string, unknown>
        }
      } catch { /* ignore */ }

      const explanation = [
        parsed?.explanation,
        parsed?.staff_unlinked_reason,
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join('\n')

      return {
        filename: file.originalFilename,
        fileType: file.fileType,
        status: file.status,
        detectedFileType: (parsed?.detected_file_type as string | null) ?? null,
        explanation: (explanation || representativeRun?.errorMessage) ?? null,
        materialStatus: (parsed?.material_status as string | null) ?? null,
        routingStatus: (parsed?.routing_status as string | null) ?? null,
        confidence: representativeRun?.confidence ?? null,
        riskFlags: Array.isArray(parsed?.risk_flags) ? (parsed.risk_flags as string[]) : [],
      }
    })

    const defaultWorkType = inferGeneralDefaultCriteriaWorkType({
      requestEmailSubject: session.requestEmailSubject,
      requestEmailBody: session.requestEmailBody,
    })

    const existingCriteriaRows = await db
      .select({
        itemName: requestItemValidation.itemName,
        itemGroup: requestItemValidation.itemGroup,
        requiredness: requestItemValidation.requiredness,
        conditionText: requestItemValidation.conditionText,
      })
      .from(requestItemValidation)
      .where(and(eq(requestItemValidation.uploadSessionId, sessionId), eq(requestItemValidation.tenantId, tenantId)))

    const shouldMergeDefaultCriteria =
      session.requestKind === 'general' &&
      !session.extractedCriteria?.trim() &&
      !session.additionalCriteria?.trim()

    const criteriaRowsForPrompt = shouldMergeDefaultCriteria
      ? mergeGeneralDefaultCriteriaRows(existingCriteriaRows, defaultWorkType)
      : existingCriteriaRows

    const requestItemCriteria = criteriaRowsForPrompt.length > 0
      ? criteriaRowsForPrompt
          .map((criterion) => {
            const suffix = criterion.requiredness === 'optional' ? '참고 항목' : '요청 항목'
            return `- ${criterion.itemName} (${suffix})${criterion.conditionText ? `: ${criterion.conditionText}` : ''}`
          })
          .join('\n')
      : null

    // 4. Claude로 세션 전체 평가
    const { ANTHROPIC_API_KEY } = requireAiEnv()
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const prompt = buildEvaluationPrompt({
      clientName: clientRecord.name,
      accountingPeriod: session.accountingPeriod,
      requestEmailBody: session.requestEmailBody,
      extractedCriteria: session.extractedCriteria,
      additionalCriteria: session.additionalCriteria,
      requestItemCriteria,
      clientAnalysisNotes: clientRecord.analysisNotes,
      sessionAnalysisNotes: session.analysisNotes,
      fileSummaries,
    })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawOutput = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonMatch) throw new Error('Claude 평가 응답에서 JSON을 찾지 못했습니다')

    const parsed = sessionEvaluationSchema.safeParse(JSON.parse(jsonMatch))
    if (!parsed.success) throw new Error(`평가 결과 Zod 검증 실패: ${parsed.error.message}`)

    const evaluation = applyDeterministicDefaultCriteriaLinks({
      evaluation: parsed.data,
      fileSummaries,
      workType: defaultWorkType,
    })

    // 5. 평가 결과 저장 + validation insert + 상태 전환을 단일 transaction으로 묶음
    // — 세션 상태가 바뀌기 전에 validation rows가 반드시 존재함을 보장
    // — loop 중간 실패 시 세션 상태도 함께 롤백되어 다음 실행이 재시도 가능

    // material 항목만으로 verdict 재계산 — AI가 프롬프트 지시를 어겨도 코드에서 보정
    // material이 0개인데 다른 기준만 있으면 자동 통과시키지 않고 보수적으로 보충/확인 흐름으로 보낸다.
    const materialCriteria = evaluation.criteria.filter(c => c.criterion_type === 'material')
    const computedVerdict =
      materialCriteria.length === 0
        ? evaluation.criteria.length === 0 ? 'sufficient' : 'uncertain'
        : materialCriteria.some(c => ['missing', 'non_compliant'].includes(c.status))
        ? 'needs_resubmission'
        : materialCriteria.every(c => c.status === 'satisfied')
        ? 'sufficient'
        : 'uncertain'

    // AI verdict와 코드 계산 불일치 시 로그 (모니터링용)
    if (evaluation.overall_verdict !== computedVerdict) {
      console.warn('[session-eval] AI verdict와 material-only 재계산 불일치', {
        sessionId,
        aiVerdict: evaluation.overall_verdict,
        computedVerdict,
        materialCount: materialCriteria.length,
        totalCount: evaluation.criteria.length,
      })
    }

    const nextStatus = computedVerdict === 'sufficient'
      ? 'ready_for_accountant'
      : 'needs_resubmission'

    const ts = toDBString(now())
    const requestEventId = session.requestEventId ?? null

    let persisted = false

    await db.transaction(async (tx) => {
      const currentSessionRows = await tx
        .select({ status: uploadSession.status })
        .from(uploadSession)
        .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
        .limit(1)

      if (currentSessionRows[0]?.status !== 'ai_checking') {
        console.warn('[session-eval] 파일 구성 변경으로 오래된 평가 저장 스킵', {
          sessionId,
          currentStatus: currentSessionRows[0]?.status ?? null,
        })
        return
      }

      // 재평가 시 session_evaluation과 request_item_validation이 반드시 같은 결과를 가리키도록
      // 기존 validation rows를 지우고 현재 평가 결과로 다시 만든다.
      const existingValidations = await tx
        .select({ id: requestItemValidation.id })
        .from(requestItemValidation)
        .where(
          and(
            eq(requestItemValidation.uploadSessionId, sessionId),
            eq(requestItemValidation.tenantId, tenantId),
          ),
        )
      const existingValidationIds = existingValidations.map((row) => row.id)

      if (existingValidationIds.length > 0) {
        await tx
          .delete(requestItemValidationFile)
          .where(
            and(
              eq(requestItemValidationFile.tenantId, tenantId),
              inArray(requestItemValidationFile.validationId, existingValidationIds),
            ),
          )
        await tx
          .delete(requestItemValidation)
          .where(
            and(
              eq(requestItemValidation.tenantId, tenantId),
              eq(requestItemValidation.uploadSessionId, sessionId),
            ),
          )
      }

      // filename → fileId 역색인 (대소문자 구분 없이 매칭)
      const filenameToId = new Map(
        files.map((f) => [normalizeEvaluationFilenameKey(f.originalFilename), f.id]),
      )

      const CONTRIBUTION_MAP: Record<string, 'satisfied' | 'non_compliant' | 'partial' | 'uncertain'> = {
        satisfied: 'satisfied',
        non_compliant: 'non_compliant',
        uncertain: 'uncertain',  // "판독 불가" — partial(일부 기여)과 구분
        // missing은 파일이 없으므로 매핑 제외
      }

      for (const criterion of evaluation.criteria) {
        const validationId = randomUUID()
        const defaultCriterion = inferDefaultCriterionGroup(criterion, defaultCriteriaForWorkType(defaultWorkType))

        await tx.insert(requestItemValidation).values({
          id: validationId,
          tenantId,
          uploadSessionId: sessionId,
          requestEventId,
          itemName: criterion.criterion_text,
          itemGroup: defaultCriterion?.itemGroup ?? null,
          criterionType: criterion.criterion_type,
          requiredness: defaultCriterion?.requiredness ?? 'required',
          conditionText: defaultCriterion?.conditionText ?? null,
          validationStatus: criterion.status,
          aiReasoning: criterion.reason,
          requestedAction: criterion.requested_action ?? null,
          createdAt: ts,
          updatedAt: ts,
        })

        const contribution = CONTRIBUTION_MAP[criterion.status]
        if (contribution && criterion.related_filenames.length > 0) {
          const insertedFileIds = new Set<string>()
          for (const filename of criterion.related_filenames) {
            const fileId = filenameToId.get(normalizeEvaluationFilenameKey(filename))
            if (!fileId) {
              console.warn('[session-eval] related_filenames 매칭 실패', {
                sessionId,
                criterion: criterion.criterion_text,
                filename,
                candidates: Array.from(filenameToId.keys()),
              })
              continue
            }
            if (insertedFileIds.has(fileId)) continue

            insertedFileIds.add(fileId)
            await tx.insert(requestItemValidationFile).values({
              id: randomUUID(),
              tenantId,
              validationId,
              uploadFileId: fileId,
              contribution,
              createdAt: ts,
            })
          }
        }
      }

      await tx
        .update(uploadSession)
        .set({
          sessionEvaluation: JSON.stringify(evaluation),
          status: nextStatus,
        })
        .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))

      persisted = true
    })

    if (!persisted) {
      await rollbackSessionToSubmitted(sessionId, tenantId)
      return {
        ok: false,
        code: 'skipped_stale',
        message: '세션 상태가 변경되어 평가 결과를 저장하지 못했습니다. 자료 다시 검토를 다시 시도해 주세요.',
      }
    }

    console.info(
      `[session-eval] 세션 ${sessionId} 평가 완료: ${evaluation.overall_verdict} → ${nextStatus}`,
    )

    return { ok: true, status: nextStatus }
  } catch (err) {
    console.error(`[session-eval] 세션 ${sessionId} 평가 실패:`, err)
    await rollbackSessionToSubmitted(sessionId, tenantId)
    return {
      ok: false,
      code: 'evaluation_failed',
      message: err instanceof Error ? err.message : '세션 평가 중 오류가 발생했습니다.',
    }
  }
}
