import { randomUUID } from 'crypto'
import { eq, and, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  analysisRun,
  uploadSession,
  client,
  tenant,
  staff,
  clientRequestEvent,
  clientChecklist,
  checklistTemplate,
  checklistItem,
  uploadFile,
  materialMatch,
  requestTemplate,
  requestItemValidation,
  requestItemValidationFile,
} from '@/lib/db/schema'
import {
  defaultCriteriaForWorkType,
  inferGeneralDefaultCriteriaWorkType,
  type GeneralDefaultCriteriaWorkType,
} from '@/lib/review/default-criteria-data'
import { hashToken } from '@/lib/token'
import { fromISO, now, toDBString } from '@/lib/time'
import {
  PAYROLL_UPLOAD_BASELINE_ITEMS,
  PAYROLL_UPLOAD_CHECKLIST_TEMPLATE_NAME,
} from '@/lib/payroll/upload-checklist-baseline'

export async function verifyToken(rawToken: string) {
  const hash = hashToken(rawToken)

  const rows = await db
    .select()
    .from(uploadSession)
    .where(eq(uploadSession.tokenHash, hash))
    .limit(1)

  const session = rows[0]
  if (!session) return null

  if (session.status === 'expired' || session.status === 'revoked') return null

  if (fromISO(session.expiresAt) < now()) return null

  await db
    .update(uploadSession)
    .set({
      lastAccessedAt: toDBString(now()),
      ...(session.status === 'requested' ? { status: 'active' } : {}),
    })
    .where(eq(uploadSession.id, session.id))

  return session
}

async function listPortalChecklistItems(params: {
  clientId: string
  tenantId: string
}) {
  return db
    .select({ item: checklistItem })
    .from(clientChecklist)
    .innerJoin(checklistTemplate, eq(clientChecklist.templateId, checklistTemplate.id))
    .innerJoin(checklistItem, eq(checklistItem.templateId, checklistTemplate.id))
    .where(and(eq(clientChecklist.clientId, params.clientId), eq(clientChecklist.tenantId, params.tenantId)))
    .orderBy(checklistItem.sortOrder)
}

async function listChecklistItemsByTemplate(params: {
  tenantId: string
  templateId: string
}) {
  return db
    .select({ item: checklistItem })
    .from(checklistItem)
    .where(and(eq(checklistItem.templateId, params.templateId), eq(checklistItem.tenantId, params.tenantId)))
    .orderBy(checklistItem.sortOrder)
}

function inferPortalDefaultCriteriaWorkType(
  session: typeof uploadSession.$inferSelect,
): GeneralDefaultCriteriaWorkType | null {
  if (session.requestKind === 'payroll') return null

  return inferGeneralDefaultCriteriaWorkType({
    requestEmailSubject: session.requestEmailSubject,
    requestEmailBody: session.requestEmailBody,
  })
}

async function ensureDefaultChecklistTemplate(params: {
  tenantId: string
  workType: GeneralDefaultCriteriaWorkType
}) {
  const defaultTemplateRows = await db
    .select({ id: requestTemplate.checklistTemplateId })
    .from(requestTemplate)
    .where(
      and(
        eq(requestTemplate.tenantId, params.tenantId),
        eq(requestTemplate.workType, params.workType),
        eq(requestTemplate.isDefaultForWorkType, true),
        eq(requestTemplate.isActive, true),
        isNotNull(requestTemplate.checklistTemplateId),
      ),
    )
    .limit(1)

  const defaultTemplateId = defaultTemplateRows[0]?.id
  if (defaultTemplateId) return defaultTemplateId

  const templateName = params.workType === 'vat' ? '부가세 자료 기본 기준' : '기장 자료 기본 기준'
  const existingTemplateRows = await db
    .select({ id: checklistTemplate.id })
    .from(checklistTemplate)
    .where(and(eq(checklistTemplate.tenantId, params.tenantId), eq(checklistTemplate.name, templateName)))
    .limit(1)

  const timestamp = toDBString(now())
  const templateId = existingTemplateRows[0]?.id ?? randomUUID()
  if (!existingTemplateRows[0]) {
    await db.insert(checklistTemplate).values({
      id: templateId,
      tenantId: params.tenantId,
      name: templateName,
      description: '업로드 포털에서 기본 자료 목록을 표시하기 위한 시스템 기본 기준입니다.',
      createdAt: timestamp,
    })
  }

  const existingItems = await db
    .select({ name: checklistItem.name })
    .from(checklistItem)
    .where(and(eq(checklistItem.tenantId, params.tenantId), eq(checklistItem.templateId, templateId)))
  const existingItemNames = new Set(existingItems.map((item) => item.name.normalize('NFC').trim()))
  const missingItems = defaultCriteriaForWorkType(params.workType)
    .filter((criterion) => !existingItemNames.has(criterion.itemName.normalize('NFC').trim()))
    .map((criterion, index) => ({
      id: randomUUID(),
      tenantId: params.tenantId,
      templateId,
      name: criterion.itemName,
      description: criterion.conditionText,
      required: criterion.requiredness === 'required',
      analysisRules: null,
      sortOrder: (existingItems.length + index + 1) * 10,
      createdAt: timestamp,
    }))

  if (missingItems.length > 0) {
    await db.insert(checklistItem).values(missingItems)
  }

  return templateId
}

async function findPayrollChecklistTemplateId(params: {
  tenantId: string
  requestEventId?: string | null
}) {
  if (params.requestEventId) {
    const eventTemplateRows = await db
      .select({ id: requestTemplate.checklistTemplateId })
      .from(clientRequestEvent)
      .innerJoin(requestTemplate, eq(clientRequestEvent.requestTemplateId, requestTemplate.id))
      .where(
        and(
          eq(clientRequestEvent.id, params.requestEventId),
          eq(clientRequestEvent.tenantId, params.tenantId),
          eq(requestTemplate.tenantId, params.tenantId),
          eq(requestTemplate.workType, 'payroll'),
          eq(requestTemplate.isActive, true),
          isNotNull(requestTemplate.checklistTemplateId),
        ),
      )
      .limit(1)

    const eventTemplateId = eventTemplateRows[0]?.id
    if (eventTemplateId) return eventTemplateId
  }

  const defaultTemplateRows = await db
    .select({ id: requestTemplate.checklistTemplateId })
    .from(requestTemplate)
    .where(
      and(
        eq(requestTemplate.tenantId, params.tenantId),
        eq(requestTemplate.workType, 'payroll'),
        eq(requestTemplate.isDefaultForWorkType, true),
        eq(requestTemplate.isActive, true),
        isNotNull(requestTemplate.checklistTemplateId),
      ),
    )
    .limit(1)

  const defaultTemplateId = defaultTemplateRows[0]?.id
  if (defaultTemplateId) return defaultTemplateId

  const sampleTemplateRows = await db
    .select({ id: checklistTemplate.id })
    .from(checklistTemplate)
    .where(and(
      eq(checklistTemplate.tenantId, params.tenantId),
      eq(checklistTemplate.name, PAYROLL_UPLOAD_CHECKLIST_TEMPLATE_NAME),
    ))
    .limit(1)

  return sampleTemplateRows[0]?.id ?? null
}

async function ensurePayrollChecklistTemplate(tenantId: string) {
  const existingTemplateId = await findPayrollChecklistTemplateId({ tenantId })
  if (existingTemplateId) return existingTemplateId

  const timestamp = toDBString(now())
  const templateId = randomUUID()
  await db.insert(checklistTemplate).values({
    id: templateId,
    tenantId,
    name: PAYROLL_UPLOAD_CHECKLIST_TEMPLATE_NAME,
    description: '법정 임금대장 작성과 급여대장 초안 계산에 필요한 클라이언트 업로드 자료 기준입니다.',
    createdAt: timestamp,
  })
  await db.insert(checklistItem).values(PAYROLL_UPLOAD_BASELINE_ITEMS.map((item, index) => ({
    id: randomUUID(),
    tenantId,
    templateId,
    name: item.name,
    description: null,
    required: item.required,
    analysisRules: null,
    sortOrder: (index + 1) * 10,
    createdAt: timestamp,
  })))

  return templateId
}

async function listPayrollPortalChecklistItems(params: {
  session: typeof uploadSession.$inferSelect
  tenantId: string
}) {
  const templateId =
    await findPayrollChecklistTemplateId({
      tenantId: params.tenantId,
      requestEventId: params.session.requestEventId,
    }) ?? await ensurePayrollChecklistTemplate(params.tenantId)

  return listChecklistItemsByTemplate({ tenantId: params.tenantId, templateId })
}

async function ensurePortalDefaultClientChecklist(params: {
  session: typeof uploadSession.$inferSelect
  clientId: string
  tenantId: string
}) {
  const workType = inferPortalDefaultCriteriaWorkType(params.session)
  if (!workType) return false

  const templateId = await ensureDefaultChecklistTemplate({
    tenantId: params.tenantId,
    workType,
  })

  const existingAssignmentRows = await db
    .select({ id: clientChecklist.id })
    .from(clientChecklist)
    .where(
      and(
        eq(clientChecklist.tenantId, params.tenantId),
        eq(clientChecklist.clientId, params.clientId),
        eq(clientChecklist.templateId, templateId),
      ),
    )
    .limit(1)

  if (!existingAssignmentRows[0]) {
    await db.insert(clientChecklist).values({
      id: randomUUID(),
      tenantId: params.tenantId,
      clientId: params.clientId,
      templateId,
      createdAt: toDBString(now()),
    })
  }

  return true
}

export async function getPortalData(sessionId: string, tenantId: string) {
  const rows = await db
    .select({
      session: uploadSession,
      clientRecord: client,
      tenantRecord: tenant,
      staffRecord: staff,
    })
    .from(uploadSession)
    .innerJoin(client, eq(uploadSession.clientId, client.id))
    .innerJoin(tenant, eq(uploadSession.tenantId, tenant.id))
    .innerJoin(staff, eq(uploadSession.createdByStaffId, staff.id))
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
    .limit(1)

  if (!rows[0]) return null

  const { session, clientRecord, tenantRecord, staffRecord } = rows[0]

  let itemRows = session.requestKind === 'payroll'
    ? await listPayrollPortalChecklistItems({ session, tenantId })
    : await listPortalChecklistItems({ clientId: clientRecord.id, tenantId })
  if (session.requestKind !== 'payroll' && itemRows.length === 0) {
    const repaired = await ensurePortalDefaultClientChecklist({
      session,
      clientId: clientRecord.id,
      tenantId,
    })
    if (repaired) {
      itemRows = await listPortalChecklistItems({ clientId: clientRecord.id, tenantId })
    }
  }

  const files = await db
    .select()
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, sessionId), eq(uploadFile.tenantId, tenantId)))

  const matches =
    files.length > 0
      ? await db
          .select()
          .from(materialMatch)
          .where(
            and(
              inArray(
                materialMatch.uploadFileId,
                files.map((f) => f.id),
              ),
              eq(materialMatch.tenantId, tenantId),
            ),
          )
      : []

  const validations = await db
    .select({
      id: requestItemValidation.id,
      uploadSessionId: requestItemValidation.uploadSessionId,
      itemName: requestItemValidation.itemName,
      itemGroup: requestItemValidation.itemGroup,
      criterionType: requestItemValidation.criterionType,
      requiredness: requestItemValidation.requiredness,
      validationStatus: requestItemValidation.validationStatus,
      reviewStatus: requestItemValidation.reviewStatus,
      aiReasoning: requestItemValidation.aiReasoning,
      requestedAction: requestItemValidation.requestedAction,
      staffNote: requestItemValidation.staffNote,
      reviewedAt: requestItemValidation.reviewedAt,
    })
    .from(requestItemValidation)
    .where(and(eq(requestItemValidation.uploadSessionId, sessionId), eq(requestItemValidation.tenantId, tenantId)))
    .orderBy(requestItemValidation.createdAt)

  const validationLinks =
    validations.length > 0
      ? await db
          .select({
            validationId: requestItemValidationFile.validationId,
            uploadFileId: requestItemValidationFile.uploadFileId,
            contribution: requestItemValidationFile.contribution,
          })
          .from(requestItemValidationFile)
          .where(
            and(
              eq(requestItemValidationFile.tenantId, tenantId),
              inArray(
                requestItemValidationFile.validationId,
                validations.map((validation) => validation.id),
              ),
            ),
          )
      : []

  const analysisRuns =
    files.length > 0
      ? await db
          .select({
            id: analysisRun.id,
            uploadFileId: analysisRun.uploadFileId,
            provider: analysisRun.provider,
            model: analysisRun.model,
            confidence: analysisRun.confidence,
            consensusGroup: analysisRun.consensusGroup,
            status: analysisRun.status,
            parsedOutput: analysisRun.parsedOutput,
            errorMessage: analysisRun.errorMessage,
            criteriaSummary: analysisRun.criteriaSummary,
            createdAt: analysisRun.createdAt,
          })
          .from(analysisRun)
          .where(
            and(
              eq(analysisRun.tenantId, tenantId),
              inArray(
                analysisRun.uploadFileId,
                files.map((file) => file.id),
              ),
            ),
          )
      : []

  return {
    session,
    client: clientRecord,
    tenant: tenantRecord,
    staff: staffRecord,
    checklistItems: itemRows.map((r) => r.item),
    uploadedFiles: files,
    materialMatches: matches,
    requestItemValidations: validations,
    requestItemValidationFiles: validationLinks,
    analysisRuns,
  }
}
