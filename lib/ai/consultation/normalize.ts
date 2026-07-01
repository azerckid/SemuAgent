import { DateTime } from 'luxon'
import {
  type AuthorityLevel,
  type Freshness,
  type LawArticle,
  type NormalizedSource,
  type RawLawApiResponse,
  type RawLawServiceResponse,
  type SourceType,
} from './schemas'

const LAW_GO_KR_BASE = 'https://www.law.go.kr'

function koreanDateToISO(dateStr: string): string {
  // Input: "20230808" → "2023-08-08T00:00:00.000Z"
  return DateTime.fromFormat(dateStr, 'yyyyMMdd', { zone: 'utc' }).toISO() ?? dateStr
}

function mapSourceType(koreanType: string): SourceType {
  const mapping: Record<string, SourceType> = {
    '법률': 'statute',
    '대통령령': 'enforcement_decree',
    '부령': 'ministerial_order',
    '행정규칙': 'administrative_rule',
  }
  return mapping[koreanType] ?? 'unknown'
}

function mapAuthorityLevel(sourceType: SourceType): AuthorityLevel {
  switch (sourceType) {
    case 'statute':
    case 'enforcement_decree':
    case 'ministerial_order':
      return 'official_law'
    case 'administrative_rule':
      return 'official_guidance'
    default:
      return 'unknown'
  }
}

function determineFreshness(_effectiveDateStr: string): Freshness {
  // Law statutes are quasi-static: once enacted they remain valid until amended.
  // We always retrieve from the live API so the result is always "fresh."
  // Cache staleness is handled separately at the cache layer.
  return 'fresh'
}

export function normalizeLawResponse(raw: RawLawApiResponse): NormalizedSource[] {
  const retrievedAt = DateTime.utc().toISO()

  // law.go.kr는 결과가 1건이면 law를 배열이 아닌 단일 객체로 준다.
  const laws = Array.isArray(raw.LawSearch.law) ? raw.LawSearch.law : [raw.LawSearch.law]

  return laws.map((item) => {
    const sourceType = mapSourceType(item.법령구분명)
    const authorityLevel = mapAuthorityLevel(sourceType)

    return {
      sourceId: `law.go.kr/${item.법령ID}`,
      sourceType,
      title: item.법령명한글,
      shortName: item.법령약칭명 ?? null,
      url: `${LAW_GO_KR_BASE}${item.법령상세링크}`,
      agency: item.소관부처명,
      publishedAt: koreanDateToISO(item.공포일자),
      effectiveAt: koreanDateToISO(item.시행일자),
      status: item.현행연혁코드 === '현행' ? 'active' : 'abolished',
      authorityLevel,
      freshness: determineFreshness(item.시행일자),
      retrievedAt,
      metadata: {
        serialNumber: item.법령일련번호,
        promulgationNumber: item.공포번호,
        agencyCode: item.소관부처코드 ?? null,
        revisionType: item.제개정구분명 ?? null,
      },
    } satisfies NormalizedSource
  })
}

type LawUnit = Record<string, unknown>

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/** Flattens any string leaves out of a value (string / array / nested object). */
function flattenText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(flattenText).filter(Boolean).join('\n')
  if (value && typeof value === 'object') {
    return Object.values(value).map(flattenText).filter(Boolean).join('\n')
  }
  return ''
}

/**
 * Recursively collects every "...내용" field (조문내용/항내용/호내용/목내용 …) found
 * anywhere under the article unit, so the substantive body — which may live in
 * nested 항/호/목 of varying shapes — is captured regardless of structure.
 */
function collectArticleText(node: unknown): string {
  const parts: string[] = []
  const walk = (n: unknown) => {
    if (Array.isArray(n)) {
      n.forEach(walk)
      return
    }
    if (n && typeof n === 'object') {
      for (const [key, value] of Object.entries(n)) {
        if (key.endsWith('내용')) {
          const text = flattenText(value).trim()
          if (text) parts.push(text)
        } else {
          walk(value)
        }
      }
    }
  }
  walk(node)
  return parts.join('\n')
}

/**
 * Flattens a lawService.do response into article texts. Returns [] when no
 * article content is present; the caller decides whether that is a hard error.
 * Structural headings (조문여부 !== '조문' — 장/절/관) are excluded.
 */
export function extractLawArticles(raw: RawLawServiceResponse): LawArticle[] {
  const unit = raw.법령?.조문?.조문단위
  if (!unit) return []

  return asArray<LawUnit>(unit as LawUnit | LawUnit[])
    .map((u): LawArticle | null => {
      const 조문여부 = u.조문여부
      // 조문여부가 명시되어 있고 '조문'이 아니면 구조 제목이므로 근거 후보에서 제외.
      if (typeof 조문여부 === 'string' && 조문여부 !== '조문') return null

      const text = collectArticleText(u).trim()
      if (!text) return null

      const articleNo = u.조문번호
      const title = u.조문제목
      return {
        articleNo: articleNo !== undefined && articleNo !== null ? String(articleNo) : '',
        title: typeof title === 'string' ? title : null,
        text,
      }
    })
    .filter((a): a is LawArticle => a !== null)
}
