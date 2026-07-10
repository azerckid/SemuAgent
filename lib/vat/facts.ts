import { z } from 'zod'

export const vatDirectionSchema = z.enum(['sale', 'purchase', 'not_applicable', 'needs_review'])
export const vatTaxTypeSchema = z.enum(['taxable', 'zero_rated', 'exempt', 'non_taxable', 'needs_review'])
export const vatFactSourceSchema = z.enum(['parser', 'manual'])
export const vatFactStatusSchema = z.enum(['derived', 'confirmed', 'needs_review', 'excluded'])

const exactVatFactValuesSchema = z.object({
  direction: z.enum(['sale', 'purchase', 'not_applicable']),
  taxType: z.enum(['taxable', 'zero_rated', 'exempt', 'non_taxable']),
  supplyAmountKrw: z.number().int().nonnegative(),
  taxAmountKrw: z.number().int().nonnegative(),
  grossAmountKrw: z.number().int().nonnegative(),
})

function validateExactVatArithmetic(
  value: z.infer<typeof exactVatFactValuesSchema>,
  context: z.RefinementCtx,
) {
  if (value.supplyAmountKrw + value.taxAmountKrw !== value.grossAmountKrw) {
    context.addIssue({
      code: 'custom',
      path: ['grossAmountKrw'],
      message: '공급가액과 세액의 합계가 총액과 일치해야 합니다.',
    })
  }

  if (value.taxType !== 'taxable' && value.taxAmountKrw !== 0) {
    context.addIssue({
      code: 'custom',
      path: ['taxAmountKrw'],
      message: '영세율·면세·비과세 거래의 세액은 0이어야 합니다.',
    })
  }
}

export const parsedVatFactSchema = exactVatFactValuesSchema.extend({
  sourceReference: z.string().min(1).max(500),
}).superRefine(validateExactVatArithmetic)

export const manualVatFactInputSchema = exactVatFactValuesSchema.superRefine(validateExactVatArithmetic)

export type ParsedVatFact = z.infer<typeof parsedVatFactSchema>
export type ManualVatFactInput = z.infer<typeof manualVatFactInputSchema>

type BookkeepingSourceType = 'bank' | 'card' | 'receipt' | 'tax_invoice' | 'other'
type BookkeepingDirection = 'income' | 'expense' | 'unknown'

export type StoredVatFactFields = {
  vatDirection: z.infer<typeof vatDirectionSchema> | null
  vatTaxType: z.infer<typeof vatTaxTypeSchema> | null
  vatSupplyAmountKrw: number | null
  vatTaxAmountKrw: number | null
  vatGrossAmountKrw: number | null
  vatFactSource: z.infer<typeof vatFactSourceSchema> | null
  vatFactSourceRef: string | null
  vatFactStatus: z.infer<typeof vatFactStatusSchema> | null
}

const EMPTY_VAT_FACT_FIELDS: StoredVatFactFields = {
  vatDirection: null,
  vatTaxType: null,
  vatSupplyAmountKrw: null,
  vatTaxAmountKrw: null,
  vatGrossAmountKrw: null,
  vatFactSource: null,
  vatFactSourceRef: null,
  vatFactStatus: null,
}

export function isVatEvidenceSource(sourceType: BookkeepingSourceType) {
  return sourceType === 'tax_invoice' || sourceType === 'card' || sourceType === 'receipt'
}

export function vatDirectionFromBookkeeping(direction: BookkeepingDirection) {
  if (direction === 'income') return 'sale' as const
  if (direction === 'expense') return 'purchase' as const
  return 'needs_review' as const
}

export function buildParsedVatFactFields(params: {
  sourceType: BookkeepingSourceType
  direction: BookkeepingDirection
  sourceReference: string
  vatFact?: ParsedVatFact
}): StoredVatFactFields {
  if (!isVatEvidenceSource(params.sourceType)) return { ...EMPTY_VAT_FACT_FIELDS }

  const parsed = params.vatFact ? parsedVatFactSchema.safeParse(params.vatFact) : null
  if (!parsed?.success) {
    return {
      ...EMPTY_VAT_FACT_FIELDS,
      vatDirection: vatDirectionFromBookkeeping(params.direction),
      vatTaxType: 'needs_review',
      vatFactSource: 'parser',
      vatFactSourceRef: params.sourceReference,
      vatFactStatus: 'needs_review',
    }
  }

  return {
    vatDirection: parsed.data.direction,
    vatTaxType: parsed.data.taxType,
    vatSupplyAmountKrw: parsed.data.supplyAmountKrw,
    vatTaxAmountKrw: parsed.data.taxAmountKrw,
    vatGrossAmountKrw: parsed.data.grossAmountKrw,
    vatFactSource: 'parser',
    vatFactSourceRef: parsed.data.sourceReference,
    vatFactStatus: 'derived',
  }
}

export function buildManualVatFactFields(
  input: ManualVatFactInput,
  sourceReference: string,
): StoredVatFactFields | null {
  const parsed = manualVatFactInputSchema.safeParse(input)
  if (!parsed.success) return null

  return {
    vatDirection: parsed.data.direction,
    vatTaxType: parsed.data.taxType,
    vatSupplyAmountKrw: parsed.data.supplyAmountKrw,
    vatTaxAmountKrw: parsed.data.taxAmountKrw,
    vatGrossAmountKrw: parsed.data.grossAmountKrw,
    vatFactSource: 'manual',
    vatFactSourceRef: sourceReference,
    vatFactStatus: 'confirmed',
  }
}

export function buildClearedManualVatFactFields(params: {
  direction: BookkeepingDirection
  sourceReference: string
}): StoredVatFactFields {
  return {
    ...EMPTY_VAT_FACT_FIELDS,
    vatDirection: vatDirectionFromBookkeeping(params.direction),
    vatTaxType: 'needs_review',
    vatFactSource: 'manual',
    vatFactSourceRef: params.sourceReference,
    vatFactStatus: 'needs_review',
  }
}
