import { createHash } from 'crypto'
import { z } from 'zod'
import {
  type ClientPayrollRuleProfileV1,
  payrollRuleBasisTypeSchema,
  payrollRuleCalculationSchema,
  payrollRuleFormulaKindSchema,
  payrollRuleLawBasisSchema,
  type PayrollRuleSecurityLane,
  type PayrollRuleSourceSummary,
} from '@/lib/validations/payroll-rule-profile'
import { assembleRuleDraftFromAiResponse } from './rule-profile-draft-assembly'

/**
 * 자연어 사내규칙 → AI 구조화 → draft 급여기준 프로필 (Slice 4a).
 *
 * 보안 경계: 자연어에 주민번호·계좌번호 등 민감정보가 섞이면 `tee_required`로
 * 분류하고, 실제 TEE 실행이 없는 현재 단계에서는 일반 AI로 보내지 않고 차단한다
 * (no silent fallback). AI 응답은 Zod로 검증하며 unknown enum은 fail closed.
 * draft만 생성하고 승인 전에는 적용하지 않는다.
 *
 * 실제 AI provider 호출(env/SDK 의존)은 `rule-profile-nl-providers`로 분리해
 * 이 모듈은 결정론적 로직만 담는다(테스트가 env 없이 돈다).
 */

// 회계/급여는 개인정보 민감도가 높아 감지를 넓게 잡는다(오탐 시 차단=안전 측 실패).
// 규칙 텍스트의 정상 숫자(예: 비과세 한도 200000)는 구분자가 없어 매칭되지 않는다.
const SENSITIVE_PATTERNS = [
  /\b\d{6}\s*-\s*\d{7}\b/, // 주민등록번호(구분자)
  /\b\d{13}\b/, // 주민/외국인등록번호(구분자 없음 13자리)
  /\b\d{2,3}\s*-\s*\d{2,6}\s*-\s*\d{2,7}\b/, // 계좌번호/사업자번호류(구분자 2그룹 이상)
  /\b01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}\b/, // 휴대폰
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // 이메일
]

export function classifyNaturalLanguageSecurityLane(text: string): PayrollRuleSecurityLane {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text)) ? 'tee_required' : 'normal'
}

export function classifyPayrollRuleTextSecurityLane(text: string): PayrollRuleSecurityLane {
  return classifyNaturalLanguageSecurityLane(text)
}

const aiRuleSchema = z.object({
  displayName: z.string().min(1),
  category: z.enum(['allowance', 'deduction', 'tax', 'insurance', 'other']),
  targetField: z.string().min(1),
  formulaKind: payrollRuleFormulaKindSchema,
  formulaSummary: z.string().default(''),
  basisType: payrollRuleBasisTypeSchema.default('unknown'),
  lawBasis: z.array(payrollRuleLawBasisSchema).default([]),
  calculation: payrollRuleCalculationSchema.nullish(),
  // fixed_amount이고 전 직원 공통 정액일 때의 지급액(규칙 파라미터, 개인정보 아님). 그 외 null.
  amount: z.number().int().nonnegative().nullish(),
  taxableTreatment: z.enum(['taxable', 'non_taxable', 'partially_non_taxable', 'unknown']),
  nonTaxableLimit: z.number().int().nonnegative().nullish(),
  requiredInputs: z.array(z.string()).default([]),
  sourceQuote: z.string().default(''),
})

export const ruleTransformResponseSchema = z.object({
  rules: z.array(aiRuleSchema),
  notes: z.array(z.string()).default([]),
})
export type RuleTransformResponse = z.infer<typeof ruleTransformResponseSchema>

export type StructureRulesResult =
  | { success: true; data: RuleTransformResponse; model: string }
  | { success: false; error: string }

export type StructureRulesFn = (sourceText: string) => Promise<StructureRulesResult>

export type NlTransformInput = {
  clientId: string
  effectiveFrom: string
  effectiveTo?: string | null
  naturalLanguage: string
}

export type NlTransformResult =
  | { status: 'blocked_tee'; securityLane: 'tee_required' }
  | {
      status: 'ok'
      profile: ClientPayrollRuleProfileV1
      sourceSummary: PayrollRuleSourceSummary
      sourceHash: string
      model: string
    }
  | { status: 'failed'; error: string }

// 기본 AI 호출자는 env/SDK를 쓰므로 동적 import로 지연 로드한다(테스트는 callAi 주입).
const defaultCallAi: StructureRulesFn = async (naturalLanguage) => {
  const { structurePayrollRulesWithProviderFallback } = await import('./rule-profile-nl-providers')
  return structurePayrollRulesWithProviderFallback(naturalLanguage, 'natural_language')
}

export async function transformNaturalLanguageToRuleDraft(
  input: NlTransformInput,
  callAi: StructureRulesFn = defaultCallAi,
): Promise<NlTransformResult> {
  // 보안 경계: 민감정보 감지 시 일반 AI로 보내지 않고 차단(no silent fallback)
  if (classifyNaturalLanguageSecurityLane(input.naturalLanguage) === 'tee_required') {
    return { status: 'blocked_tee', securityLane: 'tee_required' }
  }

  const aiResult = await callAi(input.naturalLanguage)
  if (!aiResult.success) return { status: 'failed', error: aiResult.error }

  if (aiResult.data.rules.length === 0) {
    return { status: 'failed', error: '자연어에서 구조화할 급여 규칙을 찾지 못했습니다' }
  }

  const sourceHash = createHash('sha256').update(input.naturalLanguage).digest('hex')
  const assembled = assembleRuleDraftFromAiResponse({
    clientId: input.clientId,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    sourceType: 'natural_language',
    sourceHash,
    sourceFileId: null,
    securityLane: 'normal',
    model: aiResult.model,
    aiData: aiResult.data,
    ruleIdPrefix: 'nl',
    citationReferenceFallback: '담당자 자연어 설명',
  })
  if (assembled.status === 'failed') return assembled

  return {
    status: 'ok',
    profile: assembled.profile,
    sourceSummary: assembled.sourceSummary,
    sourceHash,
    model: aiResult.model,
  }
}
