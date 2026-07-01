import { createHash } from 'crypto'
import { z } from 'zod'
import {
  PAYROLL_RULE_PROFILE_SCHEMA_VERSION,
  payrollPeriodMonthSchema,
  type ClientPayrollRuleProfileV1,
  type PayrollRuleItem,
  type PayrollRuleSecurityLane,
  type PayrollRuleSourceSummary,
} from '@/lib/validations/payroll-rule-profile'
import {
  payrollExcelMappingFields,
  payrollExcelTemplateColumnLabels,
} from '@/lib/validations/payroll'

const REQUIRED_HEADERS = ['항목명', '분류', '출력필드', '과세', '계산종류'] as const
const OPTIONAL_HEADERS = ['비과세한도', '계산값', '필요입력', '출처'] as const

export const createPayrollRuleMappingDraftSchema = z.object({
  effectiveFrom: payrollPeriodMonthSchema,
  effectiveTo: payrollPeriodMonthSchema.nullish(),
  sourceLabel: z.string().trim().min(1).max(120).default('수당 매핑표'),
  mappingText: z.string().trim().min(1).max(100_000),
}).refine((input) => !input.effectiveTo || input.effectiveTo >= input.effectiveFrom, {
  message: 'effectiveTo는 effectiveFrom 이상이어야 합니다',
  path: ['effectiveTo'],
})
export type CreatePayrollRuleMappingDraftInput = z.infer<typeof createPayrollRuleMappingDraftSchema>

export type PayrollRuleMappingDraftBuildResult = {
  profile: ClientPayrollRuleProfileV1
  sourceSummary: PayrollRuleSourceSummary
  sourceHash: string
  securityLane: PayrollRuleSecurityLane
}

const categoryMap: Record<string, PayrollRuleItem['category']> = {
  수당: 'allowance',
  allowance: 'allowance',
  공제: 'deduction',
  deduction: 'deduction',
  세금: 'tax',
  tax: 'tax',
  보험: 'insurance',
  insurance: 'insurance',
  기타: 'other',
  other: 'other',
}

const taxableTreatmentMap: Record<string, PayrollRuleItem['taxableTreatment']> = {
  과세: 'taxable',
  taxable: 'taxable',
  비과세: 'non_taxable',
  nontaxable: 'non_taxable',
  'non-taxable': 'non_taxable',
  일부비과세: 'partially_non_taxable',
  부분비과세: 'partially_non_taxable',
  partiallynontaxable: 'partially_non_taxable',
  'partially-non-taxable': 'partially_non_taxable',
  미정: 'unknown',
  unknown: 'unknown',
  확인필요: 'unknown',
}

const formulaKindMap: Record<string, PayrollRuleItem['formulaKind']> = {
  고정금액: 'fixed_amount',
  fixedamount: 'fixed_amount',
  fixed: 'fixed_amount',
  단가수량: 'unit_rate',
  단가: 'unit_rate',
  unitrate: 'unit_rate',
  요율: 'rate',
  rate: 'rate',
  시간배수: 'hours_multiplier',
  hoursmultiplier: 'hours_multiplier',
  표조회: 'table_lookup',
  tablelookup: 'table_lookup',
  수기입력: 'manual_input',
  manualinput: 'manual_input',
  수동입력: 'manual_input',
  해당없음: 'not_applicable',
  notapplicable: 'not_applicable',
  na: 'not_applicable',
  'n/a': 'not_applicable',
}

// 더존 업로드 양식은 지급(수당) 항목(F~T)만 받는다. 국민연금·건강보험·소득세 등
// 공제는 더존이 직원 설정·요율로 자동 계산하므로 업로드 컬럼이 없다. 따라서 target
// 필드는 지급 항목(payrollExcelMappingFields)으로만 해석하고, 공제·세금·보험 규칙은
// 프로필 row가 아니라 업로드 제외 conflict로 보존한다.
const supportedTargetFields = new Set<string>(payrollExcelMappingFields)

const targetFieldAliases = new Map<string, string>([
  ...payrollExcelMappingFields.map((field) => [normalizeToken(field), field] as const),
  ...Object.entries(payrollExcelTemplateColumnLabels).map(([field, label]) => [normalizeToken(label), field] as const),
])

const sensitivePatterns = [
  /\b\d{6}\s*-\s*\d{7}\b/,
  /\b01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
]

const categoryLabels: Record<PayrollRuleItem['category'], string> = {
  allowance: '지급',
  deduction: '공제',
  tax: '세금',
  insurance: '보험',
  other: '기타',
}

type PayrollRuleConflictItem = ClientPayrollRuleProfileV1['conflictItems'][number]

export function isDuzonPayrollUploadRule(rule: PayrollRuleItem): boolean {
  return rule.category === 'allowance'
}

export function buildOutOfScopePayrollRuleConflict(rule: PayrollRuleItem): PayrollRuleConflictItem {
  return {
    ruleId: rule.sourceRuleId,
    kind: 'other',
    detail: `더존 업로드 제외: ${rule.displayName}은(는) ${categoryLabels[rule.category]} 항목이라 더존 지급(F~T) 업로드 규칙에 포함하지 않습니다.`,
  }
}

export function buildPayrollRuleProfileDraftFromMappingTable(params: {
  clientId: string
  input: CreatePayrollRuleMappingDraftInput
}): PayrollRuleMappingDraftBuildResult {
  const parsedRows = parseMappingTable(params.input.mappingText)
  const sourceHash = createHash('sha256').update(params.input.mappingText).digest('hex')
  const securityLane: PayrollRuleSecurityLane = containsSensitiveText(params.input.mappingText)
    ? 'tee_required'
    : 'normal'

  const rules = parsedRows.map((row, index): PayrollRuleItem => {
    const sourceRuleId = `mapping-${index + 1}`
    const displayName = sanitizeSensitiveText(requiredCell(row, '항목명'))
    const category = parseRequiredEnum(categoryMap, requiredCell(row, '분류'), `분류(row ${index + 2})`)
    const rawTargetField = sanitizeSensitiveText(requiredCell(row, '출력필드'))
    const targetField = resolveTargetField(rawTargetField) ?? (rawTargetField || `unmapped:${sourceRuleId}`)
    const taxableTreatment = parseTaxableTreatment(row['과세'])
    const formulaKind = parseRequiredEnum(formulaKindMap, requiredCell(row, '계산종류'), `계산종류(row ${index + 2})`)
    const requiredInputs = splitList(row['필요입력']).map(sanitizeSensitiveText)
    const citationReference = sanitizeSensitiveText(row['출처']?.trim() || params.input.sourceLabel)
    const nonTaxableLimit = parseOptionalInteger(row['비과세한도'], `비과세한도(row ${index + 2})`)
    const status: PayrollRuleItem['status'] = supportedTargetFields.has(targetField) ? 'ready' : 'needs_review'

    return {
      sourceRuleId,
      displayName,
      category,
      targetField,
      formulaKind,
      formulaJson: {
        raw: sanitizeSensitiveText(row['계산값']?.trim() || ''),
        nonTaxableLimit,
      },
      taxableTreatment,
      requiredInputs,
      sourceCitations: [{
        sourceType: 'mapping_table',
        reference: citationReference,
        locator: `row ${index + 2}`,
      }],
      status,
    }
  })

  const allowanceRules = rules.filter(isDuzonPayrollUploadRule)
  const outOfScopeRules = rules.filter((rule) => !isDuzonPayrollUploadRule(rule))
  if (allowanceRules.length === 0) {
    throw new Error('더존 지급(F~T) 항목으로 변환할 수 있는 규칙이 없습니다')
  }

  const taxabilityRules = allowanceRules.map((rule) => {
    const formula = rule.formulaJson as { nonTaxableLimit?: number | null }
    return {
      targetField: rule.targetField,
      treatment: rule.taxableTreatment,
      nonTaxableLimit: formula.nonTaxableLimit ?? null,
      note: rule.status === 'needs_review' ? '출력필드 매핑 검토필요' : undefined,
    }
  })

  const requiredInputKeys = [...new Set(allowanceRules.flatMap((rule) => rule.requiredInputs))]
  const profile: ClientPayrollRuleProfileV1 = {
    schemaVersion: PAYROLL_RULE_PROFILE_SCHEMA_VERSION,
    clientId: params.clientId,
    effectiveFrom: params.input.effectiveFrom,
    effectiveTo: params.input.effectiveTo || undefined,
    sourcePriority: ['mapping_table', 'statutory_default'],
    allowanceRules,
    deductionRules: [],
    taxabilityRules,
    statutoryFallbacks: [],
    requiredInputs: requiredInputKeys.map((key) => ({ key, label: key })),
    conflictItems: outOfScopeRules.map(buildOutOfScopePayrollRuleConflict),
    approvalChecklist: {
      sourcesReviewed: false,
      mappingReviewed: false,
      formulasReviewed: false,
      statutoryReviewed: false,
    },
  }

  return {
    profile,
    sourceSummary: {
      sources: [{
        sourceType: 'mapping_table',
        sourceHash,
        sourceFileId: null,
        securityLane,
      }],
    },
    sourceHash,
    securityLane,
  }
}

function parseMappingTable(text: string): Record<string, string>[] {
  const rows = parseDelimitedRows(text)
  if (rows.length < 2) {
    throw new Error('매핑표에는 헤더와 최소 1개 데이터 행이 필요합니다')
  }
  const headerRow = rows[0]?.map((cell) => cell.trim()) ?? []
  const headerIndexes = resolveHeaderIndexes(headerRow)
  const records = rows.slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => {
      const record: Record<string, string> = {}
      for (const header of [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]) {
        const index = headerIndexes.get(header)
        record[header] = index == null ? '' : (row[index] ?? '').trim()
      }
      return record
    })
  if (records.length === 0) {
    throw new Error('매핑표에는 최소 1개 데이터 행이 필요합니다')
  }
  return records
}

function parseDelimitedRows(text: string): string[][] {
  const delimiter = inferDelimiter(text)
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && char === delimiter) {
      row.push(current)
      current = ''
      continue
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index += 1
      row.push(current)
      rows.push(row)
      row = []
      current = ''
      continue
    }
    current += char
  }
  row.push(current)
  rows.push(row)
  return rows.filter((cells) => cells.some((cell) => cell.trim()))
}

function inferDelimiter(text: string): ',' | '\t' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  return firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ','
}

function resolveHeaderIndexes(headers: string[]): Map<string, number> {
  const normalizedToIndex = new Map(headers.map((header, index) => [normalizeToken(header), index]))
  const indexes = new Map<string, number>()
  for (const header of REQUIRED_HEADERS) {
    const index = normalizedToIndex.get(normalizeToken(header))
    if (index == null) throw new Error(`필수 헤더가 없습니다: ${header}`)
    indexes.set(header, index)
  }
  for (const header of OPTIONAL_HEADERS) {
    const index = normalizedToIndex.get(normalizeToken(header))
    if (index != null) indexes.set(header, index)
  }
  return indexes
}

function requiredCell(row: Record<string, string>, field: string): string {
  const value = row[field]?.trim()
  if (!value) throw new Error(`필수 값이 비어 있습니다: ${field}`)
  return value
}

function parseRequiredEnum<T extends string>(map: Record<string, T>, value: string, label: string): T {
  const parsed = map[normalizeToken(value)]
  if (!parsed) throw new Error(`${label} 값이 지원되지 않습니다: ${value}`)
  return parsed
}

function parseTaxableTreatment(value: string | undefined): PayrollRuleItem['taxableTreatment'] {
  const normalized = normalizeToken(value ?? '')
  if (!normalized) return 'unknown'
  const parsed = taxableTreatmentMap[normalized]
  if (!parsed) throw new Error(`과세 값이 지원되지 않습니다: ${value}`)
  return parsed
}

function parseOptionalInteger(value: string | undefined, label: string): number | null {
  const raw = value?.trim()
  if (!raw) return null
  const numeric = Number(raw.replace(/,/g, '').replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(numeric)) throw new Error(`${label} 값은 숫자여야 합니다`)
  return Math.round(numeric)
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function resolveTargetField(value: string): string | null {
  return targetFieldAliases.get(normalizeToken(value)) ?? null
}

/** 더존 출력 필드 키/한글 라벨을 캐논 키로 해석한다. 매핑 불가 시 null. */
export function resolvePayrollTargetField(value: string): string | null {
  return resolveTargetField(value)
}

/** 캐논 출력 필드 키가 더존 양식에서 지원되는지. */
export function isPayrollTargetFieldSupported(field: string): boolean {
  return supportedTargetFields.has(field)
}

function normalizeToken(value: string): string {
  return value.replace(/\s+/g, '').replace(/[()]/g, '').replace(/_/g, '').toLowerCase()
}

function containsSensitiveText(value: string): boolean {
  return sensitivePatterns.some((pattern) => pattern.test(value))
}

export function sanitizeSensitiveText(value: string): string {
  return sensitivePatterns.reduce((result, pattern) => result.replace(pattern, '[민감정보]'), value)
}
