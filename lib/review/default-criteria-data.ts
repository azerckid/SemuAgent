export type GeneralDefaultCriterion = {
  itemName: string
  itemGroup: string
  requiredness: 'required' | 'optional'
  conditionText: string | null
}

export type GeneralDefaultCriteriaWorkType = 'bookkeeping' | 'vat'

export const GENERAL_BOOKKEEPING_DEFAULT_CRITERIA: GeneralDefaultCriterion[] = [
  {
    itemName: '통장 거래내역',
    itemGroup: 'bank_statement',
    requiredness: 'required',
    conditionText: '기장 업무를 위해 해당 회계기간의 통장 거래내역을 확인합니다.',
  },
  {
    itemName: '카드 사용내역',
    itemGroup: 'card_statement',
    requiredness: 'required',
    conditionText: '기장 업무를 위해 해당 회계기간의 카드 사용내역을 확인합니다.',
  },
  {
    itemName: '매출 세금계산서',
    itemGroup: 'sales_tax_invoice',
    requiredness: 'required',
    conditionText: '기장 업무를 위해 해당 회계기간의 매출 세금계산서를 확인합니다.',
  },
  {
    itemName: '매입 세금계산서',
    itemGroup: 'purchase_tax_invoice',
    requiredness: 'required',
    conditionText: '기장 업무를 위해 해당 회계기간의 매입 세금계산서를 확인합니다.',
  },
  {
    itemName: '현금영수증',
    itemGroup: 'cash_receipt',
    requiredness: 'required',
    conditionText: '기장 업무를 위해 해당 회계기간의 현금영수증 내역을 확인합니다.',
  },
  {
    itemName: '온라인 매출/PG 정산자료',
    itemGroup: 'online_sales_pg_settlement',
    requiredness: 'required',
    conditionText: '스마트스토어, 오픈마켓, KCP, 네이버페이 등 온라인 매출과 PG 정산자료를 확인합니다.',
  },
  {
    itemName: '전표·입출금 정리',
    itemGroup: 'journal_entry_workbook',
    requiredness: 'optional',
    conditionText: '전표 작성·입출금 정리용 내부 장부(지출결의서 형식 포함)를 확인합니다. 미제출 시에도 검토 가능하나, 입출금·차용·급여 등이 정리된 파일이 있으면 제출을 권장합니다.',
  },
  {
    itemName: '기타 증빙자료',
    itemGroup: 'other_evidence',
    requiredness: 'optional',
    conditionText: '특이 거래나 추가 확인이 필요한 경우 보조 증빙자료를 확인합니다.',
  },
]

export const GENERAL_VAT_DEFAULT_CRITERIA: GeneralDefaultCriterion[] = [
  {
    itemName: '매출 세금계산서',
    itemGroup: 'vat_sales_tax_invoice',
    requiredness: 'required',
    conditionText: '부가세 신고 준비를 위해 해당 신고 대상 기간의 매출 세금계산서 자료를 확인합니다.',
  },
  {
    itemName: '매입 세금계산서',
    itemGroup: 'vat_purchase_tax_invoice',
    requiredness: 'required',
    conditionText: '부가세 신고 준비를 위해 해당 신고 대상 기간의 매입 세금계산서 자료를 확인합니다.',
  },
  {
    itemName: '신용카드 매출자료',
    itemGroup: 'vat_card_sales',
    requiredness: 'required',
    conditionText: '카드 단말기, PG, 배달앱 등 신용카드/전자결제 매출 집계 자료를 확인합니다.',
  },
  {
    itemName: '현금영수증 매출자료',
    itemGroup: 'vat_cash_receipt_sales',
    requiredness: 'required',
    conditionText: '현금영수증 매출 내역 또는 홈택스 현금영수증 매출 집계 자료를 확인합니다.',
  },
  {
    itemName: '사업용 신용카드 사용내역',
    itemGroup: 'vat_business_card_purchase',
    requiredness: 'required',
    conditionText: '부가세 매입세액 검토를 위해 사업용 신용카드 사용내역을 확인합니다.',
  },
  {
    itemName: '기타 부가세 증빙자료',
    itemGroup: 'vat_other_evidence',
    requiredness: 'optional',
    conditionText: '온라인 매출, 간이영수증, 수출입 증빙 등 추가 확인이 필요한 자료가 있으면 보조 증빙으로 확인합니다.',
  },
]

export function defaultCriteriaForWorkType(
  workType: GeneralDefaultCriteriaWorkType = 'bookkeeping',
) {
  return workType === 'vat' ? GENERAL_VAT_DEFAULT_CRITERIA : GENERAL_BOOKKEEPING_DEFAULT_CRITERIA
}

export function inferGeneralDefaultCriteriaWorkType(params: {
  requestEmailSubject?: string | null
  requestEmailBody?: string | null
}): GeneralDefaultCriteriaWorkType {
  const source = `${params.requestEmailSubject ?? ''}\n${params.requestEmailBody ?? ''}`.toLowerCase()
  return source.includes('부가세') || source.includes('vat') ? 'vat' : 'bookkeeping'
}

export function formatGeneralDefaultCriteriaForPrompt(
  workType: GeneralDefaultCriteriaWorkType = 'bookkeeping',
) {
  return defaultCriteriaForWorkType(workType)
    .map((criterion) => {
      const suffix = criterion.requiredness === 'optional' ? '참고 항목' : '요청 항목'
      return `- ${criterion.itemName} (${suffix}): ${criterion.conditionText}`
    })
    .join('\n')
}

export function formatGeneralDefaultCriteriaForEmail(
  workType: GeneralDefaultCriteriaWorkType = 'bookkeeping',
) {
  const criteria = defaultCriteriaForWorkType(workType)
  const requiredItems = criteria.filter((criterion) => criterion.requiredness === 'required')
  const optionalItems = criteria.filter((criterion) => criterion.requiredness !== 'required')

  const sections = [
    requiredItems.length > 0
      ? ['요청 항목', ...requiredItems.map((criterion) => `- ${criterion.itemName}`)].join('\n')
      : null,
    optionalItems.length > 0
      ? ['참고 항목', ...optionalItems.map((criterion) => `- ${criterion.itemName}`)].join('\n')
      : null,
  ].filter(Boolean)

  return ['요청 자료 기준', ...sections].join('\n\n')
}
