import {
  PAYROLL_RULE_PROFILE_SCHEMA_VERSION,
  type ClientPayrollRuleProfileV1,
  type PayrollRuleItem,
  type PayrollRuleSecurityLane,
  type PayrollRuleSourceSummary,
  type PayrollRuleSourceType,
} from '@/lib/validations/payroll-rule-profile'
import {
  buildOutOfScopePayrollRuleConflict,
  isDuzonPayrollUploadRule,
  resolvePayrollTargetField,
  sanitizeSensitiveText,
} from './rule-profile-mapping-table'
import type { RuleTransformResponse } from './rule-profile-nl-transform'

export type AssembleRuleDraftInput = {
  clientId: string
  effectiveFrom: string
  effectiveTo?: string | null
  sourceType: PayrollRuleSourceType
  sourceHash: string
  sourceFileId: string | null
  securityLane: PayrollRuleSecurityLane
  model: string
  aiData: RuleTransformResponse
  ruleIdPrefix: string
  citationReferenceFallback: string
}

export type AssembleRuleDraftResult =
  | { status: 'ok'; profile: ClientPayrollRuleProfileV1; sourceSummary: PayrollRuleSourceSummary }
  | { status: 'failed'; error: string }

function sanitizeOptionalString(value: string | null | undefined): string | null {
  if (!value) return null
  const sanitized = sanitizeSensitiveText(value)
  return sanitized.length > 0 ? sanitized : null
}

function toRuleItems(
  response: RuleTransformResponse,
  sourceType: PayrollRuleSourceType,
  ruleIdPrefix: string,
  citationReferenceFallback: string,
): PayrollRuleItem[] {
  return response.rules.map((rule, index): PayrollRuleItem => {
    const resolved = resolvePayrollTargetField(rule.targetField)
    const targetField = resolved ?? (rule.targetField.trim() || `unmapped:${ruleIdPrefix}-${index + 1}`)
    return {
      sourceRuleId: `${ruleIdPrefix}-${index + 1}`,
      displayName: sanitizeSensitiveText(rule.displayName),
      category: rule.category,
      targetField,
      formulaKind: rule.formulaKind,
      formulaJson: {
        summary: sanitizeSensitiveText(rule.formulaSummary),
        basisType: rule.basisType,
        lawBasis: rule.lawBasis.map((basis) => ({
          lawName: sanitizeSensitiveText(basis.lawName),
          article: sanitizeSensitiveText(basis.article),
          summary: sanitizeOptionalString(basis.summary) ?? undefined,
          url: basis.url,
        })),
        calculation: rule.calculation
          ? {
              expression: sanitizeOptionalString(rule.calculation.expression),
              unitAmount: rule.calculation.unitAmount ?? null,
              unit: sanitizeOptionalString(rule.calculation.unit),
              quantityInputKey: sanitizeOptionalString(rule.calculation.quantityInputKey),
              multiplier: rule.calculation.multiplier ?? null,
              resultField: sanitizeOptionalString(rule.calculation.resultField),
            }
          : null,
        nonTaxableLimit: rule.nonTaxableLimit ?? null,
        // 실행 가능한 정액(전 직원 공통). fixed_amount일 때만 의미가 있어 적용기가 이 값으로 F~T를 채운다.
        amount: rule.formulaKind === 'fixed_amount' && typeof rule.amount === 'number' ? rule.amount : null,
      },
      taxableTreatment: rule.taxableTreatment,
      requiredInputs: rule.requiredInputs.map(sanitizeSensitiveText),
      sourceCitations: [{
        sourceType,
        reference: sanitizeSensitiveText(rule.sourceQuote || citationReferenceFallback),
      }],
      status: 'needs_review',
    }
  })
}

export function assembleRuleDraftFromAiResponse(input: AssembleRuleDraftInput): AssembleRuleDraftResult {
  const rules = toRuleItems(
    input.aiData,
    input.sourceType,
    input.ruleIdPrefix,
    input.citationReferenceFallback,
  )
  if (rules.length === 0) {
    return { status: 'failed', error: '파일에서 구조화할 급여 규칙을 찾지 못했습니다' }
  }

  const allowanceRules = rules.filter(isDuzonPayrollUploadRule)
  const outOfScopeRules = rules.filter((rule) => !isDuzonPayrollUploadRule(rule))
  if (allowanceRules.length === 0) {
    return {
      status: 'failed',
      error: '더존 지급(F~T) 항목으로 변환할 수 있는 급여 규칙을 찾지 못했습니다',
    }
  }

  const taxabilityRules = allowanceRules.map((rule) => ({
    targetField: rule.targetField,
    treatment: rule.taxableTreatment,
    nonTaxableLimit: (rule.formulaJson as { nonTaxableLimit?: number | null }).nonTaxableLimit ?? null,
    note: rule.status === 'needs_review' ? '출력필드 매핑 검토필요' : undefined,
  }))
  const requiredInputKeys = [...new Set(allowanceRules.flatMap((rule) => rule.requiredInputs))]

  const profile: ClientPayrollRuleProfileV1 = {
    schemaVersion: PAYROLL_RULE_PROFILE_SCHEMA_VERSION,
    clientId: input.clientId,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo || undefined,
    sourcePriority: [input.sourceType, 'statutory_default'],
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
    status: 'ok',
    profile,
    sourceSummary: {
      sources: [{
        sourceType: input.sourceType,
        sourceHash: input.sourceHash,
        sourceFileId: input.sourceFileId,
        securityLane: input.securityLane,
        aiProviderMetadata: JSON.stringify({
          mode: 'single_provider_fallback',
          model: input.model,
          consensusPending: true,
        }),
      }],
    },
  }
}
