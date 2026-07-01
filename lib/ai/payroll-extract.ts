import Anthropic from '@anthropic-ai/sdk'
import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { requireAnthropicEnv, requireGoogleAiEnv, requireOpenAiEnv, isGeminiEnabled } from '@/lib/env'
import { OPENAI_ANALYSIS_MODEL } from '@/lib/ai/models'
import { getActiveAiProviderOrder, type AiProvider } from '@/lib/ai/provider-order'
import {
  payrollExtractionResponseSchema,
  type PayrollExtractedRow,
  type PayrollExtractionResponse,
} from '@/lib/validations/payroll'

export type PayrollSourceText = {
  filename: string
  text: string | null
  summary: string | null
  chunkIndex?: number
  chunkTotal?: number
  sheetName?: string
  rowStart?: number
  rowEnd?: number
}

const MAX_PAYROLL_PROMPT_TEXT_CHARS = 55000
const MAX_PAYROLL_AI_BATCHES = 3
const SELECTION_WARNING_LABEL_LIMIT = 8
const CLAUDE_PAYROLL_MODEL = 'claude-sonnet-4-6'
const OPENAI_PAYROLL_MODEL = OPENAI_ANALYSIS_MODEL

export function getPayrollAiProviderOrder(): AiProvider[] {
  return getActiveAiProviderOrder()
}

export function getPayrollAiModelChainLabel(): string {
  return getActiveAiProviderOrder()
    .map((provider) => {
      if (provider === 'gemini') return 'gemini'
      if (provider === 'openai') return OPENAI_ANALYSIS_MODEL
      return CLAUDE_PAYROLL_MODEL
    })
    .join(' -> ')
}

type PayrollAiProvider = AiProvider

const PAYROLL_PROVIDER_LABELS: Record<PayrollAiProvider, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  claude: 'Claude',
}

const TEXT_ROW_FIELDS = [
  'employeeCode',
  'employeeName',
  'department',
  'jobTitle',
  'jobType',
] as const

const AMOUNT_ROW_FIELDS = [
  'baseSalary',
  'bonus',
  'mealAllowance',
  'transportationAllowance',
  'holidayWorkAllowance',
  'domesticTravelAllowance',
  'annualLeaveAllowance',
  'rndAllowance',
  'otherAllowance',
  'performanceIncentive',
  'nightWorkAllowance',
  'vehicleMaintenanceAllowance',
  'retroactivePay',
  'overtimeAllowance',
  'childcareAllowance',
  'nationalPension',
  'healthInsurance',
  'longTermCare',
  'employmentInsurance',
  'incomeTax',
  'localIncomeTax',
  'otherDeduction',
  'deductionAmount',
] as const

const CONFIDENCE_RANK: Record<NonNullable<PayrollExtractedRow['confidence']>, number> = {
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
}

const SYSTEM_PROMPT = `당신은 대한민국 회계법인의 급여정산 업무를 보조하는 AI입니다.
제공된 급여 관련 자료를 읽고 직원별 급여 변동 정보를 추출합니다.
금액은 반드시 정수(원 단위)로 반환하고, 불명확하거나 파악할 수 없는 필드는 null로 반환합니다.
주민등록번호·계좌번호는 추출하지 않습니다.
반환 형식은 요청한 구조화 형식 지시를 엄격히 따릅니다.`

const PAYROLL_EXTRACTION_TOOL: Tool = {
  name: 'submit_payroll_extraction',
  description: '직원별 급여정산 추출 결과와 주의사항을 제출합니다.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      payrollPeriod: { type: 'string' },
      rows: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            employeeCode: { type: ['string', 'null'] },
            employeeName: { type: ['string', 'null'] },
            department: { type: ['string', 'null'] },
            jobTitle: { type: ['string', 'null'] },
            jobType: { type: ['string', 'null'] },
            baseSalary: { type: ['integer', 'null'] },
            bonus: { type: ['integer', 'null'] },
            mealAllowance: { type: ['integer', 'null'] },
            transportationAllowance: { type: ['integer', 'null'] },
            holidayWorkAllowance: { type: ['integer', 'null'] },
            domesticTravelAllowance: { type: ['integer', 'null'] },
            annualLeaveAllowance: { type: ['integer', 'null'] },
            rndAllowance: { type: ['integer', 'null'] },
            otherAllowance: { type: ['integer', 'null'] },
            performanceIncentive: { type: ['integer', 'null'] },
            nightWorkAllowance: { type: ['integer', 'null'] },
            vehicleMaintenanceAllowance: { type: ['integer', 'null'] },
            retroactivePay: { type: ['integer', 'null'] },
            overtimeAllowance: { type: ['integer', 'null'] },
            childcareAllowance: { type: ['integer', 'null'] },
            nationalPension: { type: ['integer', 'null'] },
            healthInsurance: { type: ['integer', 'null'] },
            longTermCare: { type: ['integer', 'null'] },
            employmentInsurance: { type: ['integer', 'null'] },
            incomeTax: { type: ['integer', 'null'] },
            localIncomeTax: { type: ['integer', 'null'] },
            otherDeduction: { type: ['integer', 'null'] },
            deductionAmount: { type: ['integer', 'null'] },
            memo: { type: ['string', 'null'] },
            confidence: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] },
            aiVerdict: { type: 'string', enum: ['pass', 'fail'] },
            aiVerdictReason: { type: ['string', 'null'] },
            sourceReference: {
              type: ['object', 'null'],
              additionalProperties: true,
              properties: {
                filename: { type: ['string', 'null'] },
                sheetName: { type: ['string', 'null'] },
                rowHint: { type: ['string', 'null'] },
              },
            },
          },
          required: [
            'employeeCode',
            'employeeName',
            'department',
            'jobTitle',
            'jobType',
            'baseSalary',
            'bonus',
            'mealAllowance',
            'transportationAllowance',
            'holidayWorkAllowance',
            'domesticTravelAllowance',
            'annualLeaveAllowance',
            'rndAllowance',
            'otherAllowance',
            'performanceIncentive',
            'nightWorkAllowance',
            'vehicleMaintenanceAllowance',
            'retroactivePay',
            'overtimeAllowance',
            'childcareAllowance',
            'nationalPension',
            'healthInsurance',
            'longTermCare',
            'employmentInsurance',
            'incomeTax',
            'localIncomeTax',
            'otherDeduction',
            'deductionAmount',
            'confidence',
            'aiVerdict',
            'aiVerdictReason',
            'sourceReference',
          ],
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['payrollPeriod', 'rows', 'warnings'],
  },
}

function buildPrompt(
  fileTexts: PayrollSourceText[],
  payrollPeriod: string,
  responseMode: 'tool' | 'json' = 'tool',
): string {
  const fileBlocks = fileTexts.map((f) => {
    if (!f.text) {
      return `[파일: ${f.filename}]\n상태: ${f.summary ?? '파싱 불가 — 담당자 직접 확인 필요'}`
    }
    return `[파일: ${f.filename}]\n${f.text}`
  }).join('\n\n---\n\n')

  const responseInstruction = responseMode === 'tool'
    ? [
      '반드시 submit_payroll_extraction 도구를 호출해 응답하세요.',
      '설명, 마크다운, 일반 텍스트 응답은 금지합니다.',
    ].join('\n')
    : [
      '반드시 아래 구조의 JSON 객체 하나만 반환하세요.',
      '설명, 마크다운, 코드블록, 일반 텍스트 응답은 금지합니다.',
      '최상위 키는 payrollPeriod, rows, warnings만 사용하세요.',
      'rows의 각 항목은 필드 매핑에 있는 키를 사용하고, 모르는 값은 null로 둡니다.',
    ].join('\n')

  return `급여 기간: ${payrollPeriod}

아래 자료에서 직원별 급여정산 정보를 추출하세요.

${fileBlocks}

---

${responseInstruction}

필드 매핑:
- employeeCode: 사원코드
- employeeName: 사원명
- department: 부서
- jobTitle: 직급
- jobType: 직종
- baseSalary: 더존 업로드 양식의 기본급 칸에 들어갈 고정급 금액. 입력자료에 기본급만 있으면 기본급을 사용하고, 통상임금/월고정급/고정급합계/월급여/기준급여/월지급액처럼 매월 고정 지급 합계를 뜻하는 컬럼이 있으면 그 금액을 사용합니다. 자격급/자격수당/직책급/직책수당/직무급 같은 고정 구성항목은 별도 수당 칸에 중복 반영하지 않습니다.
- bonus: 상여
- mealAllowance: 식대
- transportationAllowance: 교통비
- holidayWorkAllowance: 휴일근무
- domesticTravelAllowance: 국내출장
- annualLeaveAllowance: 연차수당
- rndAllowance: 연구개발비
- otherAllowance: 기타수당 (차량유지비/소급적용/연장근무/보육수당 등 전용 필드가 있는 항목은 포함하지 않습니다)
- performanceIncentive: 일반성과인센티브
- nightWorkAllowance: 심야근무
- vehicleMaintenanceAllowance: 차량유지비 (자가운전보조금/차량보조금 포함)
- retroactivePay: 급여인상분 소급적용 (소급분/소급수당 포함)
- overtimeAllowance: 연장근무수당 (연장근로수당/시간외수당. 야간·휴일근무와 구분)
- childcareAllowance: 보육수당 (육아수당/양육수당 포함)
- nationalPension: 국민연금
- healthInsurance: 건강보험
- longTermCare: 장기요양
- employmentInsurance: 고용보험
- incomeTax: 소득세
- localIncomeTax: 지방소득세
- otherDeduction: 기타공제
- deductionAmount: 공제금액

다중 시트 Excel 처리:
- 하나의 workbook 안에 직원 기초자료, 지급/수당/연차/충당액 등 여러 sheet가 나뉘어 있을 수 있습니다.
- 같은 직원의 정보가 여러 sheet에 나뉘어 있으면 employeeCode 또는 employeeName을 기준으로 병합하세요.
- 컬럼명은 완전히 같지 않을 수 있습니다. 예: 기본급/본봉/기본임금, 자격급/자격수당/직능급, 직책급/직책수당/직무급, 통상임금/월고정급/고정급합계/월급여/기준급여/월지급액은 의미와 금액 관계를 함께 보고 판단하세요.
- 고정급 합계가 기본급+자격급+직책급 등 고정 구성항목 합계와 맞으면 baseSalary에는 고정급 합계를 넣고, 구성항목을 otherAllowance 등에 다시 더하지 마세요.
- sourceReference에는 가능한 한 filename, sheetName, rowHint를 남겨 담당자가 원자료 위치를 확인할 수 있게 하세요.
- 관련 없는 sheet는 rows에 억지로 넣지 말고 warnings에 제외 사유를 적으세요.
- 합계/소계/총계/누계/평균/인원/총인원/계 같은 집계·요약 행은 개별 직원이 아니므로 rows에 넣지 말고 warnings에 제외 사유를 적으세요. 표 하단의 합계행(예: "인원 : 6", "합계")처럼 금액이 여러 직원의 합과 일치하거나 사원코드/사원명 칸에 집계 라벨이 들어 있는 행이 대표적입니다.

AI 판정 기준:
- 직원별 필수 식별 정보와 지급 금액이 자료에 명확히 있고, 급여 기간(${payrollPeriod})에 맞으면 aiVerdict는 "pass"입니다.
- 기간 불일치, 금액 누락, 직원 식별 불명확, 항목 중복 가능성, 원본 확인이 필요한 사유가 있으면 aiVerdict는 "fail"입니다.
- aiVerdict가 "fail"이면 aiVerdictReason에 구체적인 이유를 한 문장으로 적으세요.
- aiVerdict가 "pass"이면 aiVerdictReason은 null로 둡니다.

요청한 급여 기간(${payrollPeriod})과 맞지 않는 자료는 rows에 넣지 말고 warnings에 사유를 적으세요.`
}

function estimateSourceTextChars(fileTexts: PayrollSourceText[]): number {
  return fileTexts.reduce((sum, fileText) => sum + (fileText.text?.length ?? 0), 0)
}

function groupPayrollSourceTexts(fileTexts: PayrollSourceText[]): PayrollSourceText[][] {
  const groups: PayrollSourceText[][] = []
  let currentGroup: PayrollSourceText[] = []
  let currentChars = 0

  for (const fileText of fileTexts) {
    const nextChars = fileText.text?.length ?? 0
    if (currentGroup.length > 0 && currentChars + nextChars > MAX_PAYROLL_PROMPT_TEXT_CHARS) {
      groups.push(currentGroup)
      currentGroup = []
      currentChars = 0
    }
    currentGroup.push(fileText)
    currentChars += nextChars
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

type PayrollSourceTextSelection = {
  fileTexts: PayrollSourceText[]
  warnings: string[]
  filtered: boolean
}

function compactForSearch(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

function stripGeneratedChunkMetadata(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/^(\s*)?(파일명:|시트 수:|추출 프로필:|chunk:)/.test(line))
    .join('\n')
}

function buildPayrollPeriodTokens(payrollPeriod: string): string[] {
  const match = payrollPeriod.match(/^(\d{4})-(\d{2})$/)
  if (!match) return [payrollPeriod]

  const [, year, month] = match
  const monthNumber = String(Number(month))
  const shortYear = year.slice(2)

  return [
    `${year}-${month}`,
    `${year}.${month}`,
    `${year}/${month}`,
    `${year}${month}`,
    `${year}년${monthNumber}월`,
    `${year}년${month}월`,
    `${shortYear}년${monthNumber}월`,
    `${shortYear}년${month}월`,
  ]
}

function sourceSearchText(source: PayrollSourceText): string {
  return [
    source.sheetName ?? '',
    stripGeneratedChunkMetadata(source.text ?? ''),
  ].join('\n')
}

function sourceContainsAnyPeriodToken(source: PayrollSourceText, tokens: string[]): boolean {
  const compacted = compactForSearch(sourceSearchText(source))
  return tokens.some((token) => compacted.includes(compactForSearch(token)))
}

function hasPayrollSignal(source: PayrollSourceText): boolean {
  const compacted = compactForSearch(sourceSearchText(source))
  return /급여|변동|지급|대장|명세|근로|근무|식대|수당|상여|공제|입퇴사|조퇴|지각/.test(compacted)
}

function isPayrollMasterSource(source: PayrollSourceText): boolean {
  const sheetName = compactForSearch(source.sheetName ?? '')
  const compacted = compactForSearch(sourceSearchText(source).slice(0, 4000))
  const hasEmployeeIdentity = compacted.includes('개인번호')
    || compacted.includes('사원코드')
    || compacted.includes('직원코드')
  const hasEmployeeName = compacted.includes('성명')
    || compacted.includes('사원명')
    || compacted.includes('직원명')
    || compacted.includes('이름')
  const hasWageBasis = /기본급|본봉|기본임금|통상임금|월고정급|고정급합계|월급여|기준급여|월지급액/.test(compacted)

  return /기초자료|직원기초|사원기초|인사기초|employee|master|base/.test(sheetName)
    || (hasEmployeeIdentity && hasEmployeeName && hasWageBasis)
}

function isPeriodSpecificPayrollSource(source: PayrollSourceText, tokens: string[]): boolean {
  if (!sourceContainsAnyPeriodToken(source, tokens)) return false

  const sheetName = source.sheetName ?? ''
  const sheetHasExactPeriod = tokens.some((token) => compactForSearch(sheetName).includes(compactForSearch(token)))
  return sheetHasExactPeriod || hasPayrollSignal(source)
}

function formatSourceLabel(source: PayrollSourceText): string {
  const sheet = source.sheetName ?? source.filename
  if (source.rowStart && source.rowEnd) {
    return `${sheet} ${source.rowStart}-${source.rowEnd}행`
  }
  return sheet
}

export function selectPayrollSourceTextsForPeriod(
  fileTexts: PayrollSourceText[],
  payrollPeriod: string,
): PayrollSourceTextSelection {
  const originalGroups = groupPayrollSourceTexts(fileTexts)
  if (originalGroups.length <= 1) {
    return { fileTexts, warnings: [], filtered: false }
  }

  const periodTokens = buildPayrollPeriodTokens(payrollPeriod)
  const annotated = fileTexts.map((source) => ({
    source,
    isMaster: isPayrollMasterSource(source),
    isPeriodSpecific: isPeriodSpecificPayrollSource(source, periodTokens),
  }))

  if (!annotated.some((item) => item.isPeriodSpecific)) {
    return { fileTexts, warnings: [], filtered: false }
  }

  const selected = annotated
    .filter((item) => item.isMaster || item.isPeriodSpecific)
    .map((item) => item.source)

  if (selected.length === 0 || selected.length === fileTexts.length) {
    return { fileTexts, warnings: [], filtered: false }
  }

  const omitted = annotated
    .filter((item) => !item.isMaster && !item.isPeriodSpecific)
    .map((item) => formatSourceLabel(item.source))

  const shownOmitted = omitted.slice(0, SELECTION_WARNING_LABEL_LIMIT)
  const extraOmittedCount = omitted.length - shownOmitted.length

  const warnings = [
    `요청 급여 기간(${payrollPeriod}) 기준으로 관련 sheet/chunk ${selected.length.toLocaleString('ko-KR')}/${fileTexts.length.toLocaleString('ko-KR')}개만 AI 추출에 사용했습니다.`,
    [
      `제외된 sheet/chunk: ${shownOmitted.join(', ')}`,
      extraOmittedCount > 0 ? `외 ${extraOmittedCount.toLocaleString('ko-KR')}개` : null,
    ].filter(Boolean).join(' '),
  ]

  return { fileTexts: selected, warnings, filtered: true }
}

function normalizeMergeKey(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, '').trim().toLowerCase()
  return normalized ? normalized : null
}

function getRowMergeAliases(row: PayrollExtractedRow): string[] {
  const aliases: string[] = []
  const employeeCode = normalizeMergeKey(row.employeeCode)
  if (employeeCode) aliases.push(`code:${employeeCode}`)

  const employeeName = normalizeMergeKey(row.employeeName)
  if (employeeName) aliases.push(`name:${employeeName}`)

  return aliases
}

function lowerConfidence(
  left: PayrollExtractedRow['confidence'],
  right: PayrollExtractedRow['confidence'],
): PayrollExtractedRow['confidence'] {
  const safeLeft = left ?? 'unknown'
  const safeRight = right ?? 'unknown'
  return CONFIDENCE_RANK[safeLeft] <= CONFIDENCE_RANK[safeRight] ? safeLeft : safeRight
}

function sourceReferencesOf(value: PayrollExtractedRow['sourceReference']): unknown[] {
  if (!value) return []
  const sources = (value as { sources?: unknown }).sources
  if (Array.isArray(sources)) return sources
  return [value]
}

function mergeSourceReferences(
  left: PayrollExtractedRow['sourceReference'],
  right: PayrollExtractedRow['sourceReference'],
): PayrollExtractedRow['sourceReference'] {
  const sources = [...sourceReferencesOf(left), ...sourceReferencesOf(right)]
  if (sources.length === 0) return null
  if (sources.length === 1 && typeof sources[0] === 'object' && sources[0] !== null) {
    return sources[0] as Record<string, unknown>
  }
  return { sources: sources.slice(0, 30) }
}

function appendFailReason(row: PayrollExtractedRow, reason: string): void {
  row.aiVerdict = 'fail'
  row.aiVerdictReason = [row.aiVerdictReason, reason].filter(Boolean).join(' / ')
}

function mergeRowInto(
  target: PayrollExtractedRow,
  incoming: PayrollExtractedRow,
  warnings: string[],
): void {
  const label = target.employeeCode ?? target.employeeName ?? incoming.employeeCode ?? incoming.employeeName ?? '직원'

  for (const field of TEXT_ROW_FIELDS) {
    const existing = target[field]
    const next = incoming[field]
    if (!existing && next) {
      target[field] = next
      continue
    }
    if (existing && next && normalizeMergeKey(existing) !== normalizeMergeKey(next)) {
      const warning = `${label}: ${field} 값이 chunk 간 다릅니다 (${existing} / ${next})`
      warnings.push(warning)
      appendFailReason(target, warning)
    }
  }

  for (const field of AMOUNT_ROW_FIELDS) {
    const existing = target[field]
    const next = incoming[field]
    if (existing == null && next != null) {
      target[field] = next
      continue
    }
    if (existing != null && next != null && existing !== next) {
      const warning = `${label}: ${field} 금액이 chunk 간 다릅니다 (${existing.toLocaleString('ko-KR')} / ${next.toLocaleString('ko-KR')})`
      warnings.push(warning)
      appendFailReason(target, warning)
    }
  }

  target.confidence = lowerConfidence(target.confidence, incoming.confidence)
  target.sourceReference = mergeSourceReferences(target.sourceReference, incoming.sourceReference)

  if (target.aiVerdict !== 'fail') {
    target.aiVerdict = incoming.aiVerdict ?? target.aiVerdict
  }
  if (incoming.aiVerdict === 'fail') {
    appendFailReason(target, incoming.aiVerdictReason ?? 'chunk 추출 결과가 부적합입니다')
  }
}

export function mergePayrollExtractionResponses(
  responses: PayrollExtractionResponse[],
  payrollPeriod: string,
): PayrollExtractionResponse {
  const warnings = responses.flatMap((response) => response.warnings)
  const rowsByAlias = new Map<string, PayrollExtractedRow>()
  const mergedRows: PayrollExtractedRow[] = []

  for (const response of responses) {
    for (const row of response.rows) {
      const aliases = getRowMergeAliases(row)
      const matchedRows = [...new Set(
        aliases
          .map((alias) => rowsByAlias.get(alias))
          .filter((matchedRow): matchedRow is PayrollExtractedRow => Boolean(matchedRow)),
      )]

      if (matchedRows.length === 0) {
        const clonedRow: PayrollExtractedRow = {
          ...row,
          confidence: row.confidence ?? 'unknown',
          aiVerdict: row.aiVerdict ?? (row.confidence === 'high' ? 'pass' : 'fail'),
          aiVerdictReason: row.aiVerdictReason ?? null,
          sourceReference: row.sourceReference ?? null,
        }
        mergedRows.push(clonedRow)
        for (const alias of aliases) {
          rowsByAlias.set(alias, clonedRow)
        }
        continue
      }

      const primaryRow = matchedRows[0]
      for (const duplicateRow of matchedRows.slice(1)) {
        mergeRowInto(primaryRow, duplicateRow, warnings)
        const duplicateIndex = mergedRows.indexOf(duplicateRow)
        if (duplicateIndex >= 0) {
          mergedRows.splice(duplicateIndex, 1)
        }
        for (const [alias, aliasedRow] of rowsByAlias.entries()) {
          if (aliasedRow === duplicateRow) {
            rowsByAlias.set(alias, primaryRow)
          }
        }
      }

      mergeRowInto(primaryRow, row, warnings)
      for (const alias of aliases) {
        rowsByAlias.set(alias, primaryRow)
      }
    }
  }

  return {
    payrollPeriod,
    rows: mergedRows,
    warnings: [...new Set(warnings)],
  }
}

function extractJson(text: string): string | null {
  const codeBlock = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (codeBlock) return codeBlock[1]
  const bare = text.match(/\{[\s\S]*\}/)
  return bare ? bare[0] : null
}

function parseToolInput(rawInput: unknown): PayrollExtractionResult {
  const parsed = payrollExtractionResponseSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: `응답 스키마 검증 실패: ${parsed.error.message}` }
  }
  return { success: true, data: parsed.data }
}

export type PayrollExtractionResult =
  | { success: true; data: PayrollExtractionResponse }
  | { success: false; error: string; rawOutput?: string }

function parseJsonOutput(rawOutput: string): PayrollExtractionResult {
  const jsonStr = extractJson(rawOutput)
  if (!jsonStr) {
    return { success: false, error: 'AI 응답에서 JSON을 찾을 수 없습니다', rawOutput }
  }

  try {
    const parsed = payrollExtractionResponseSchema.safeParse(JSON.parse(jsonStr))
    if (!parsed.success) {
      return { success: false, error: `응답 스키마 검증 실패: ${parsed.error.message}`, rawOutput }
    }
    return { success: true, data: parsed.data }
  } catch (err) {
    return { success: false, error: `AI 응답 JSON 파싱 실패: ${(err as Error).message}`, rawOutput }
  }
}

function normalizeProviderError(error: string): string {
  return error.replace(/\s+/g, ' ').trim().slice(0, 260)
}

export async function extractPayrollWithGemini(
  fileTexts: PayrollSourceText[],
  payrollPeriod: string,
): Promise<PayrollExtractionResult> {
  if (!isGeminiEnabled()) {
    return { success: false, error: 'Gemini provider is disabled (GEMINI_ENABLED=false)' }
  }

  const { GOOGLE_AI_API_KEY, GEMINI_ANALYSIS_MODEL } = requireGoogleAiEnv()
  const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: GEMINI_ANALYSIS_MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  let rawOutput = ''
  try {
    const response = await model.generateContent(buildPrompt(fileTexts, payrollPeriod, 'json'))
    rawOutput = response.response.text()
    return parseJsonOutput(rawOutput)
  } catch (err) {
    return { success: false, error: (err as Error).message, rawOutput }
  }
}

export async function extractPayrollWithOpenAI(
  fileTexts: PayrollSourceText[],
  payrollPeriod: string,
): Promise<PayrollExtractionResult> {
  const { OPENAI_API_KEY } = requireOpenAiEnv()
  const client = new OpenAI({ apiKey: OPENAI_API_KEY })

  let rawOutput = ''
  try {
    const response = await client.chat.completions.create({
      model: OPENAI_PAYROLL_MODEL,
      // GPT-5 계열은 max_tokens 대신 max_completion_tokens를 요구한다.
      // reasoning 토큰이 출력 한도에 포함되므로 여유를 더 둔다.
      max_completion_tokens: 16000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(fileTexts, payrollPeriod, 'json') },
      ],
    })

    rawOutput = response.choices[0]?.message?.content ?? ''
    return parseJsonOutput(rawOutput)
  } catch (err) {
    return { success: false, error: (err as Error).message, rawOutput }
  }
}

export async function extractPayrollWithClaude(
  fileTexts: PayrollSourceText[],
  payrollPeriod: string,
): Promise<PayrollExtractionResult> {
  const { ANTHROPIC_API_KEY } = requireAnthropicEnv()
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  let rawOutput = ''
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_PAYROLL_MODEL,
      max_tokens: 12000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(fileTexts, payrollPeriod) }],
      tools: [PAYROLL_EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: PAYROLL_EXTRACTION_TOOL.name },
    })

    const toolUse = response.content.find((block) => block.type === 'tool_use')
    if (toolUse?.type === 'tool_use') {
      const result = parseToolInput(toolUse.input)
      return result.success ? result : { ...result, rawOutput: JSON.stringify(toolUse.input) }
    }

    rawOutput = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    return parseJsonOutput(rawOutput)
  } catch (err) {
    return { success: false, error: (err as Error).message, rawOutput }
  }
}

async function extractPayrollWithProvider(
  provider: PayrollAiProvider,
  fileTexts: PayrollSourceText[],
  payrollPeriod: string,
): Promise<PayrollExtractionResult> {
  if (provider === 'gemini') return extractPayrollWithGemini(fileTexts, payrollPeriod)
  if (provider === 'openai') return extractPayrollWithOpenAI(fileTexts, payrollPeriod)
  return extractPayrollWithClaude(fileTexts, payrollPeriod)
}

export async function extractPayrollWithProviderFallback(
  fileTexts: PayrollSourceText[],
  payrollPeriod: string,
): Promise<PayrollExtractionResult> {
  const failedProviders: string[] = []
  const failedProviderLabels: string[] = []

  for (const provider of getActiveAiProviderOrder()) {
    const providerLabel = PAYROLL_PROVIDER_LABELS[provider]
    const result = await extractPayrollWithProvider(provider, fileTexts, payrollPeriod).catch((err: unknown) => ({
      success: false as const,
      error: err instanceof Error ? err.message : String(err),
    }))

    if (result.success) {
      if (failedProviders.length === 0) return result

      return {
        success: true,
        data: {
          ...result.data,
          warnings: [
            ...new Set([
              // 추출은 성공했으므로 담당자 화면에는 짧은 안내만 남기고,
              // provider 에러 원문은 위 console.warn(서버 기록)으로만 보존한다.
              `${failedProviderLabels.join(' → ')} 실패 후 ${providerLabel}로 급여 추출을 완료했습니다.`,
              ...result.data.warnings,
            ]),
          ],
        },
      }
    }

    console.warn(`[payroll-extract] ${providerLabel} 추출 실패:`, normalizeProviderError(result.error))
    failedProviders.push(`${providerLabel}: ${normalizeProviderError(result.error)}`)
    failedProviderLabels.push(providerLabel)
  }

  const attemptedProviders = getActiveAiProviderOrder()
    .map((provider) => PAYROLL_PROVIDER_LABELS[provider])
    .join(', ')

  return {
    success: false,
    error: [
      `${attemptedProviders} 순서로 급여 AI 추출을 시도했지만 모두 실패했습니다.`,
      ...failedProviders,
    ].join('\n'),
  }
}

export async function extractPayrollWithProviderFallbackInBatches(
  fileTexts: PayrollSourceText[],
  payrollPeriod: string,
): Promise<PayrollExtractionResult> {
  const sourceSelection = selectPayrollSourceTextsForPeriod(fileTexts, payrollPeriod)
  const selectedFileTexts = sourceSelection.fileTexts
  const totalTextChars = estimateSourceTextChars(selectedFileTexts)
  if (selectedFileTexts.length <= 1 || totalTextChars <= MAX_PAYROLL_PROMPT_TEXT_CHARS) {
    const result = await extractPayrollWithProviderFallback(selectedFileTexts, payrollPeriod)
    if (!result.success || sourceSelection.warnings.length === 0) return result
    return {
      success: true,
      data: {
        ...result.data,
        warnings: [...new Set([...sourceSelection.warnings, ...result.data.warnings])],
      },
    }
  }

  const groups = groupPayrollSourceTexts(selectedFileTexts)
  if (groups.length > MAX_PAYROLL_AI_BATCHES) {
    return {
      success: false,
      error: [
        `급여 원자료가 ${groups.length.toLocaleString('ko-KR')}개 AI 묶음으로 나뉘어 안전 제한(${MAX_PAYROLL_AI_BATCHES.toLocaleString('ko-KR')}개)을 초과했습니다.`,
        sourceSelection.filtered
          ? `요청 급여 기간(${payrollPeriod}) 기준으로 관련 sheet/chunk만 선별했지만 아직 자료가 너무 큽니다.`
          : null,
        '파일을 나누어 다시 업로드하거나 원자료 범위를 줄인 뒤 재추출해 주세요.',
      ].filter(Boolean).join('\n'),
    }
  }

  const responses: PayrollExtractionResponse[] = []
  const warnings: string[] = [
    ...sourceSelection.warnings,
    `급여 원자료가 길어 ${groups.length.toLocaleString('ko-KR')}개 묶음으로 나누어 추출했습니다.`,
  ]

  for (const [index, group] of groups.entries()) {
    const result = await extractPayrollWithProviderFallback(group, payrollPeriod)
    if (result.success) {
      responses.push(result.data)
      continue
    }

    warnings.push(`묶음 ${index + 1}/${groups.length} 추출 실패: ${result.error}`)
  }

  if (responses.length === 0) {
    return {
      success: false,
      error: warnings.join('\n'),
    }
  }

  const merged = mergePayrollExtractionResponses(responses, payrollPeriod)
  return {
    success: true,
    data: {
      ...merged,
      warnings: [...new Set([...warnings, ...merged.warnings])],
    },
  }
}

export const extractPayrollWithClaudeInBatches = extractPayrollWithProviderFallbackInBatches
