import {
  VAT_TAX_TREATMENT_EVIDENCE_SOURCES,
  vatTaxTreatmentEvidenceSearchSchema,
  type VatTaxTreatmentEvidenceSearch,
  type VatTaxTreatmentEvidenceTraceItem,
} from '@/lib/validations/vat-tax-treatment'

type EvidenceSourceType = 'bank' | 'card' | 'receipt' | 'tax_invoice' | 'other' | null

function sourceTypeLabel(sourceType: EvidenceSourceType) {
  if (sourceType === 'tax_invoice') return '세금계산서'
  if (sourceType === 'card') return '카드 승인'
  if (sourceType === 'receipt') return '현금영수증'
  if (sourceType === 'bank') return '통장 거래'
  return '기타 거래'
}

export function buildVatTaxTreatmentEvidenceSearch(params: {
  classificationRowId: string
  sourceType?: EvidenceSourceType
  linkedEvidenceRowId?: string | null
  priorConfirmedReferences?: string[]
  ruleReference?: string | null
}): VatTaxTreatmentEvidenceSearch {
  const sourceType = params.sourceType ?? null
  const currentReference = `classification:${params.classificationRowId}`
  const linkedEvidenceReference = params.linkedEvidenceRowId
    ? `classification:${params.linkedEvidenceRowId}`
    : null
  const sourceIsEvidence = sourceType === 'tax_invoice' || sourceType === 'card' || sourceType === 'receipt'
  const priorReferences = [...new Set(params.priorConfirmedReferences ?? [])]

  const evidenceTrace: VatTaxTreatmentEvidenceTraceItem[] = [
    {
      source: 'current_transaction',
      status: 'found',
      reference: currentReference,
      summary: `${sourceTypeLabel(sourceType)} 현재 거래 행을 확인했습니다.`,
    },
    linkedEvidenceReference
      ? {
        source: 'linked_evidence',
        status: 'found',
        reference: linkedEvidenceReference,
        summary: '사용자가 연결한 증빙 행을 확인했습니다.',
      }
      : sourceIsEvidence
        ? {
          source: 'linked_evidence',
          status: 'found',
          reference: currentReference,
          summary: `${sourceTypeLabel(sourceType)} 원천 행 자체를 적격증빙으로 확인했습니다.`,
        }
        : {
          source: 'linked_evidence',
          status: 'not_found',
          reference: null,
          summary: '연결된 세금계산서·카드·현금영수증을 찾지 못했습니다.',
        },
    {
      source: 'exact_vat_fact',
      status: 'found',
      reference: `${currentReference}:vat-fact`,
      summary: '공급가액·세액·합계액이 일치하는 exact VAT fact를 확인했습니다.',
    },
    linkedEvidenceReference
      ? {
        source: 'reconciliation_result',
        status: 'found',
        reference: linkedEvidenceReference,
        summary: '자료대조원장에서 확정한 증빙 연결을 확인했습니다.',
      }
      : sourceIsEvidence
        ? {
          source: 'reconciliation_result',
          status: 'not_applicable',
          reference: null,
          summary: '원천 증빙 행은 별도 통장 연결 없이 자체 근거로 사용합니다.',
        }
        : {
          source: 'reconciliation_result',
          status: 'not_found',
          reference: null,
          summary: '확정된 자료대조 연결을 찾지 못했습니다.',
        },
    priorReferences.length > 0
      ? {
        source: 'prior_confirmed_decision',
        status: 'found',
        reference: `classification:${priorReferences[0]}`,
        summary: `같은 거래처·방향의 과거 사용자 확정 ${priorReferences.length}건을 확인했습니다.`,
      }
      : {
        source: 'prior_confirmed_decision',
        status: 'not_found',
        reference: null,
        summary: '같은 거래처·방향의 과거 사용자 확정을 찾지 못했습니다.',
      },
    params.ruleReference
      ? {
        source: 'official_rule',
        status: 'found',
        reference: params.ruleReference,
        summary: `적용 규칙 ${params.ruleReference}을 확인했습니다.`,
      }
      : {
        source: 'official_rule',
        status: 'not_found',
        reference: null,
        summary: '현재 거래에 직접 적용된 versioned 공식 규칙이 없습니다.',
      },
  ]

  return vatTaxTreatmentEvidenceSearchSchema.parse({
    evidenceTrace,
    searchedSources: [...VAT_TAX_TREATMENT_EVIDENCE_SOURCES],
  })
}
