import { z } from 'zod'

// ---------------------------------------------------------------------------
// Raw law.go.kr API response types
// ---------------------------------------------------------------------------

const KoreanDateString = z
  .string()
  .regex(/^\d{8}$/, 'Date must be in YYYYMMDD format')

export const RawLawObject = z.object({
  현행연혁코드: z.enum(['현행', '폐지']),
  법령일련번호: z.string(),
  법령명한글: z.string(),
  법령구분명: z.string(),
  소관부처명: z.string(),
  공포번호: z.string().optional().default(''),
  시행일자: KoreanDateString,
  공포일자: KoreanDateString,
  법령ID: z.string(),
  법령상세링크: z.string(),
  제개정구분명: z.string().optional(),
  소관부처코드: z.string().optional(),
  자법타법여부: z.string().optional(),
  공동부령정보: z.string().optional(),
  법령약칭명: z.string().optional(),
  id: z.string().optional(),
})

export type RawLawObject = z.infer<typeof RawLawObject>

export const RawLawApiResponse = z.object({
  LawSearch: z.object({
    // law.go.kr omits `law` entirely when totalCnt is 0, and returns a single
    // object (not an array) when exactly one law matches.
    law: z.union([RawLawObject, z.array(RawLawObject)]).optional().default([]),
    resultMsg: z.string(),
    resultCode: z.string(),
    totalCnt: z.string(),
    page: z.string(),
    numOfRows: z.string(),
    target: z.string(),
    section: z.string().optional(),
    키워드: z.string().optional(),
  }),
})

export type RawLawApiResponse = z.infer<typeof RawLawApiResponse>

// ---------------------------------------------------------------------------
// Normalized source types
// ---------------------------------------------------------------------------

export const SourceTypeEnum = z.enum([
  'statute',
  'enforcement_decree',
  'ministerial_order',
  'administrative_rule',
  'unknown',
])

export type SourceType = z.infer<typeof SourceTypeEnum>

export const AuthorityLevelEnum = z.enum([
  'official_law',
  'official_guidance',
  'unknown',
])

export type AuthorityLevel = z.infer<typeof AuthorityLevelEnum>

export const FreshnessEnum = z.enum(['fresh', 'stale', 'unknown'])

export type Freshness = z.infer<typeof FreshnessEnum>

export const NormalizedSource = z.object({
  sourceId: z.string(),
  sourceType: SourceTypeEnum,
  title: z.string(),
  shortName: z.string().nullable(),
  url: z.string(),
  agency: z.string(),
  publishedAt: z.string(),
  effectiveAt: z.string(),
  status: z.enum(['active', 'abolished']),
  authorityLevel: AuthorityLevelEnum,
  freshness: FreshnessEnum,
  retrievedAt: z.string(),
  metadata: z.record(z.string(), z.unknown()),
})

export type NormalizedSource = z.infer<typeof NormalizedSource>

// ---------------------------------------------------------------------------
// Consultation API request/response schemas
// ---------------------------------------------------------------------------

export const ConsultationSourcesRequest = z.object({
  question: z.string().min(1).max(500),
  domain: z.enum(['tax', 'accounting', 'labor', 'legal']).optional(),
})

export type ConsultationSourcesRequest = z.infer<typeof ConsultationSourcesRequest>

export const ConsultationSourcesResponse = z.object({
  status: z.enum(['success', 'no_results', 'error']),
  sources: z.array(NormalizedSource),
  totalCount: z.number().optional(),
  retrievedAt: z.string(),
  error: z.string().optional(),
})

export type ConsultationSourcesResponse = z.infer<typeof ConsultationSourcesResponse>

// ---------------------------------------------------------------------------
// Law content (lawService.do) — 현행법령 본문 조회
//   실제 응답은 조문마다 조문내용/항/호/목 구조가 제각각이라(조문내용에 제목만,
//   본문은 항/호/목 아래; 내용이 문자열·배열·중첩 등) Zod로 본문 형태를 고정하지
//   않는다. 봉투(법령.조문.조문단위)만 검증하고, 텍스트는 extractLawArticles가
//   '...내용' 키를 재귀로 수집한다. 조문 추출 0건이면 호출부에서 loud fail.
// ---------------------------------------------------------------------------

// 조문단위는 단일 객체 또는 배열, 내부 형태는 느슨하게 받는다.
const RawLawServiceArticle = z.record(z.string(), z.unknown())

export const RawLawServiceResponse = z
  .object({
    법령: z
      .object({
        조문: z
          .object({
            조문단위: z.union([RawLawServiceArticle, z.array(RawLawServiceArticle)]),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

export type RawLawServiceResponse = z.infer<typeof RawLawServiceResponse>

/** Normalized article text used to ground the answer. */
export const LawArticle = z.object({
  articleNo: z.string(),
  title: z.string().nullable(),
  text: z.string(),
})

export type LawArticle = z.infer<typeof LawArticle>

// ---------------------------------------------------------------------------
// Law search chat v1 (구 Slice 2) — answer generation
// ---------------------------------------------------------------------------

export const ConsultationAnswerStatus = z.enum([
  'answered',
  // 고객사 특정 판단 / 제공 출처로 답할 수 없는 질문 → 전문가 확인 안내
  'needs_expert',
  // 출처 없음 또는 제공된 출처가 질문과 무관
  'no_relevant_source',
])

export type ConsultationAnswerStatus = z.infer<typeof ConsultationAnswerStatus>

/**
 * Model-generated JSON. The model must NOT invent source URLs — it only
 * references provided sources by `sourceId` in `citedSourceIds`, which the
 * service resolves back to real `NormalizedSource` records (anti-hallucination).
 *
 * `practicalGuidance`/`legalBasis`/`missingInputs` split the answer into the
 * shape required by `27_AI_PROFESSIONAL_CONSULTATION_SPEC.md` §5.1: practical
 * accounting guidance (model's general knowledge, not law-grounded) must stay
 * visibly separate from the law-grounded tax/legal basis.
 */
export const ConsultationAnswerModelOutput = z.object({
  status: ConsultationAnswerStatus,
  practicalGuidance: z.string(), // 일반 실무 안내: 계산식·분개·처리 순서 (법령 출처 아님, 모델 일반 지식)
  legalBasis: z.string(), // 법령 근거 / 세무상 주의 — 제공된 조문 본문에서만
  missingInputs: z.array(z.string()), // 추가 확인 필요한 자료 (회사별 숫자를 만들어내지 않고 나열)
  summary: z.string(), // 짧은 결론
  practicalNote: z.string(), // 최종 주의 문구
  citedSourceIds: z.array(z.string()), // 사용한 출처의 sourceId (입력 sources에 존재해야 채택)
})

export type ConsultationAnswerModelOutput = z.infer<typeof ConsultationAnswerModelOutput>

// ---------------------------------------------------------------------------
// Query planning — 자연어 질문 → 관련 법령명 후보
//   law.go.kr 검색은 법령"명"만 매칭하므로, 자연어/개념 질문을 법령명으로
//   변환하는 단계가 필요하다.
// ---------------------------------------------------------------------------

export const LawQueryPlan = z.object({
  lawNames: z.array(z.string()).max(8),
  // 답변 근거 조문을 고를 핵심 개념어 (조사 없이). 조문 선택 점수화에 사용.
  keywords: z.array(z.string()).max(8).default([]),
})

export type LawQueryPlan = z.infer<typeof LawQueryPlan>

// ---------------------------------------------------------------------------
// Answer endpoint request/response
// ---------------------------------------------------------------------------

export const ConsultationAnswerRequest = z.object({
  question: z.string().min(1).max(500),
})

export type ConsultationAnswerRequest = z.infer<typeof ConsultationAnswerRequest>

export const ConsultationAnswerRelatedLaw = z.object({
  sourceId: z.string(),
  title: z.string(),
  url: z.string(),
  sourceType: SourceTypeEnum,
})

export type ConsultationAnswerRelatedLaw = z.infer<typeof ConsultationAnswerRelatedLaw>

export const ConsultationAnswerResponse = z.object({
  status: ConsultationAnswerStatus,
  practicalGuidance: z.string(),
  legalBasis: z.string(),
  missingInputs: z.array(z.string()),
  summary: z.string(),
  practicalNote: z.string(),
  relatedLaws: z.array(ConsultationAnswerRelatedLaw),
  disclaimer: z.string(),
  retrievedAt: z.string(),
  error: z.string().optional(),
})

export type ConsultationAnswerResponse = z.infer<typeof ConsultationAnswerResponse>
