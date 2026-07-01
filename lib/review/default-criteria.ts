import { randomUUID } from 'crypto'
import { requestItemValidation } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import {
  defaultCriteriaForWorkType,
  type GeneralDefaultCriterion,
  type GeneralDefaultCriteriaWorkType,
} from './default-criteria-data'

export {
  defaultCriteriaForWorkType,
  formatGeneralDefaultCriteriaForEmail,
  formatGeneralDefaultCriteriaForPrompt,
  GENERAL_BOOKKEEPING_DEFAULT_CRITERIA,
  GENERAL_VAT_DEFAULT_CRITERIA,
  inferGeneralDefaultCriteriaWorkType,
  type GeneralDefaultCriterion,
  type GeneralDefaultCriteriaWorkType,
} from './default-criteria-data'

export async function seedGeneralDefaultCriteria(params: {
  dbClient: Pick<typeof import('@/lib/db').db, 'insert'>
  tenantId: string
  uploadSessionId: string
  requestEventId: string | null
  workType?: GeneralDefaultCriteriaWorkType
}) {
  const ts = toDBString(now())

  await params.dbClient.insert(requestItemValidation).values(
    defaultCriteriaForWorkType(params.workType).map((criterion) => ({
      id: randomUUID(),
      tenantId: params.tenantId,
      uploadSessionId: params.uploadSessionId,
      requestEventId: params.requestEventId,
      itemName: criterion.itemName,
      itemGroup: criterion.itemGroup,
      criterionType: 'material' as const,
      requiredness: criterion.requiredness,
      conditionText: criterion.conditionText,
      validationStatus: 'uncertain' as const,
      reviewStatus: 'ai_suggested' as const,
      aiReasoning: params.workType === 'vat'
        ? '부가세 자료 요청 기본 검토 기준입니다. 고객 제출 완료 후 AI가 파일과 기준을 다시 평가합니다.'
        : '기장자료 요청 기본 검토 기준입니다. 고객 제출 완료 후 AI가 파일과 기준을 다시 평가합니다.',
      requestedAction: null,
      createdAt: ts,
      updatedAt: ts,
    })),
  )
}

type CriteriaPromptRow = Pick<GeneralDefaultCriterion, 'itemName' | 'conditionText'> & {
  itemGroup?: string | null
  requiredness: 'required' | 'conditional' | 'optional'
}

function normalizeCriterionKey(value: string | null | undefined) {
  return (value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function mergeGeneralDefaultCriteriaRows(
  existingRows: CriteriaPromptRow[],
  workType: GeneralDefaultCriteriaWorkType = 'bookkeeping',
): CriteriaPromptRow[] {
  const merged = [...existingRows]
  const existingGroups = new Set(
    existingRows
      .map((row) => normalizeCriterionKey(row.itemGroup))
      .filter(Boolean),
  )
  const existingNames = new Set(existingRows.map((row) => normalizeCriterionKey(row.itemName)))

  for (const criterion of defaultCriteriaForWorkType(workType)) {
    const groupKey = normalizeCriterionKey(criterion.itemGroup)
    const nameKey = normalizeCriterionKey(criterion.itemName)
    if (existingGroups.has(groupKey) || existingNames.has(nameKey)) continue
    merged.push({
      itemName: criterion.itemName,
      itemGroup: criterion.itemGroup,
      requiredness: criterion.requiredness,
      conditionText: criterion.conditionText,
    })
  }

  return merged
}
