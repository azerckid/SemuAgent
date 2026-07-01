import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages'
import { SchemaType, type ResponseSchema } from '@google/generative-ai'
import {
  materialAttributionAiOutputSchema,
  type MaterialAttributionAiOutput,
} from './schemas'

export const MATERIAL_ATTRIBUTION_STRUCTURED_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    candidates: {
      type: 'array',
      maxItems: 25,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          index: { type: 'integer', minimum: 0 },
          evidenceDate: { type: ['string', 'null'] },
          attributedPeriod: { type: ['string', 'null'] },
          periodRelation: {
            type: 'string',
            enum: ['requested', 'prior', 'future', 'unknown'],
          },
          recommendation: {
            type: 'string',
            enum: ['include', 'hold', 'exclude_duplicate', 'reference_only'],
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          reason: {
            type: 'string',
            minLength: 1,
            maxLength: 120,
          },
        },
        required: [
          'index',
          'evidenceDate',
          'attributedPeriod',
          'periodRelation',
          'recommendation',
          'confidence',
          'reason',
        ],
      },
    },
  },
  required: ['candidates'],
} as const

export const MATERIAL_ATTRIBUTION_GEMINI_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    candidates: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          index: { type: SchemaType.INTEGER },
          evidenceDate: { type: SchemaType.STRING, nullable: true },
          attributedPeriod: { type: SchemaType.STRING, nullable: true },
          periodRelation: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: ['requested', 'prior', 'future', 'unknown'],
          },
          recommendation: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: ['include', 'hold', 'exclude_duplicate', 'reference_only'],
          },
          confidence: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: ['high', 'medium', 'low'],
          },
          reason: { type: SchemaType.STRING },
        },
        required: [
          'index',
          'evidenceDate',
          'attributedPeriod',
          'periodRelation',
          'recommendation',
          'confidence',
          'reason',
        ],
      },
    },
  },
  required: ['candidates'],
}

export const MATERIAL_ATTRIBUTION_SUBMIT_TOOL: Tool = {
  name: 'submit_material_attribution',
  description: '귀속기간 판단 결과를 구조화된 JSON 형식으로 제출합니다.',
  input_schema: MATERIAL_ATTRIBUTION_STRUCTURED_JSON_SCHEMA as unknown as Tool['input_schema'],
}

export type MaterialAttributionParseFailureMeta = {
  provider?: string
  stopReason?: string | null
  structured?: boolean
}

export type MaterialAttributionProviderRunResult =
  | { ok: true; data: MaterialAttributionAiOutput }
  | { ok: false; error: string }

function logStructuredParseFailure(
  kind: string,
  preview: string,
  meta?: MaterialAttributionParseFailureMeta,
) {
  console.warn('[bookkeeping-period-attribution-ai] structured parse failure detail', {
    kind,
    provider: meta?.provider ?? null,
    stopReason: meta?.stopReason ?? null,
    structured: meta?.structured ?? true,
    previewLength: preview.length,
    preview: preview.slice(0, 400),
  })
}

export function parseMaterialAttributionStructuredValue(
  value: unknown,
  meta?: MaterialAttributionParseFailureMeta,
): MaterialAttributionProviderRunResult {
  const parsed = materialAttributionAiOutputSchema.safeParse(value)
  if (!parsed.success) {
    const preview = typeof value === 'string' ? value : JSON.stringify(value)
    logStructuredParseFailure('schema_validation_failed', preview, meta)
    return { ok: false, error: parsed.error.message }
  }
  return { ok: true, data: parsed.data }
}

function extractJsonFromResponse(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced?.[1]) return fenced[1]
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  return text.slice(first, last + 1)
}

export function parseMaterialAttributionJsonText(
  rawText: string,
  meta?: MaterialAttributionParseFailureMeta,
): MaterialAttributionProviderRunResult {
  const json = extractJsonFromResponse(rawText)
  if (!json) {
    logStructuredParseFailure('json_not_found', rawText, { ...meta, structured: false })
    return { ok: false, error: '귀속기간 보조 판정 JSON을 찾을 수 없습니다' }
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(json)
  } catch {
    logStructuredParseFailure('json_parse_failed', rawText, { ...meta, structured: false })
    return { ok: false, error: '귀속기간 보조 판정 JSON 파싱에 실패했습니다' }
  }

  return parseMaterialAttributionStructuredValue(parsedJson, meta)
}
