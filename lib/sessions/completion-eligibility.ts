export type CriterionEligibilityInput = {
  criterionType: string | null
  requiredness: string
  validationStatus: string
  reviewStatus: string
}

export type CompletionEligibility = {
  eligible: boolean
  completionKind: 'normal' | 'exception' | null
  requiredMaterialCount: number
  unresolvedRequiredCount: number
  hasStaffExceptionResolution: boolean
  blockReason: 'no_criteria' | 'no_material_criteria' | 'unresolved_required' | null
}

export function isMaterialCriterion(validation: Pick<CriterionEligibilityInput, 'criterionType'>) {
  return validation.criterionType === 'material' || validation.criterionType === null
}

export function isRequiredCriterion(validation: Pick<CriterionEligibilityInput, 'requiredness'>) {
  return validation.requiredness === 'required' || validation.requiredness === 'conditional'
}

export function isCriterionResolved(validation: CriterionEligibilityInput) {
  if (validation.validationStatus === 'satisfied') return true
  if (validation.reviewStatus === 'overridden' || validation.reviewStatus === 'excluded') return true
  return false
}

export function isUnresolvedRequiredMaterial(validation: CriterionEligibilityInput) {
  if (!isMaterialCriterion(validation)) return false
  if (!isRequiredCriterion(validation)) return false
  return !isCriterionResolved(validation)
}

export function computeCompletionEligibility(
  validations: CriterionEligibilityInput[],
): CompletionEligibility {
  if (validations.length === 0) {
    return {
      eligible: false,
      completionKind: null,
      requiredMaterialCount: 0,
      unresolvedRequiredCount: 0,
      hasStaffExceptionResolution: false,
      blockReason: 'no_criteria',
    }
  }

  const materialValidations = validations.filter(isMaterialCriterion)
  const requiredMaterial = materialValidations.filter(isRequiredCriterion)

  if (requiredMaterial.length === 0) {
    return {
      eligible: false,
      completionKind: null,
      requiredMaterialCount: 0,
      unresolvedRequiredCount: 0,
      hasStaffExceptionResolution: false,
      blockReason: materialValidations.length === 0 ? 'no_material_criteria' : 'no_material_criteria',
    }
  }

  const unresolvedRequired = requiredMaterial.filter(isUnresolvedRequiredMaterial)
  const hasStaffExceptionResolution = requiredMaterial.some((validation) => (
    (validation.reviewStatus === 'overridden' || validation.reviewStatus === 'excluded') &&
    validation.validationStatus !== 'satisfied'
  ))
  const allAiSatisfied = requiredMaterial.every((validation) => validation.validationStatus === 'satisfied')

  if (unresolvedRequired.length > 0) {
    return {
      eligible: false,
      completionKind: null,
      requiredMaterialCount: requiredMaterial.length,
      unresolvedRequiredCount: unresolvedRequired.length,
      hasStaffExceptionResolution,
      blockReason: 'unresolved_required',
    }
  }

  return {
    eligible: true,
    completionKind: allAiSatisfied && !hasStaffExceptionResolution ? 'normal' : 'exception',
    requiredMaterialCount: requiredMaterial.length,
    unresolvedRequiredCount: 0,
    hasStaffExceptionResolution,
    blockReason: null,
  }
}

export function resolveSessionStatusAfterReview(params: {
  currentStatus: string
  eligibility: CompletionEligibility
}): 'needs_resubmission' | 'ready_for_accountant' | null {
  const { currentStatus, eligibility } = params
  if (!['needs_resubmission', 'ready_for_accountant'].includes(currentStatus)) return null

  if (eligibility.eligible) {
    return currentStatus === 'needs_resubmission' ? 'ready_for_accountant' : null
  }

  return currentStatus === 'ready_for_accountant' ? 'needs_resubmission' : null
}

export function isStaffResolvedForFollowUp(
  validation: Pick<CriterionEligibilityInput, 'reviewStatus'>,
) {
  return validation.reviewStatus === 'overridden' || validation.reviewStatus === 'excluded'
}

export function isMissingRequestDraftTarget(
  validation: Pick<CriterionEligibilityInput, 'reviewStatus' | 'validationStatus'>,
) {
  if (isStaffResolvedForFollowUp(validation)) return false
  // 보충요청은 이미 올린 자료에 대한 추가 확인만. 제출 없음(미업로드)은 제외.
  return validation.validationStatus === 'non_compliant'
    || validation.validationStatus === 'uncertain'
    || validation.validationStatus === 'partially_satisfied'
}

export function buildCompletionCriteriaSummary(params: {
  completionKind: 'normal' | 'exception'
  acceptedFileCount: number
}) {
  if (params.completionKind === 'exception') {
    return `담당자 예외 검토 완료 · 부합 자료 ${params.acceptedFileCount}개`
  }
  return `자료 충족 완료 승인 · 부합 자료 ${params.acceptedFileCount}개`
}
