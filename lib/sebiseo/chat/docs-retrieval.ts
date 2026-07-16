import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

type SebiseoDocEntry = {
  relativePath: string
  sourceLabel: string
}

export type SebiseoDocSnippet = {
  sourceLabel: string
  heading: string
  body: string
  score: number
}

type CachedChunk = {
  sourceLabel: string
  heading: string
  body: string
  tokens: string[]
}

const SEBISEO_DOCS: SebiseoDocEntry[] = [
  { relativePath: 'docs/01_Concept_Design/01_PRODUCT_BASELINE.md', sourceLabel: '제품 기준' },
  { relativePath: 'docs/01_Concept_Design/02_FILING_PREPARATION_PIPELINE.md', sourceLabel: '신고 준비 흐름' },
  { relativePath: 'docs/01_Concept_Design/04_CONVERSATIONAL_TAX_WORKSPACE_PRODUCT_DIRECTION.md', sourceLabel: '세비서 범위' },
  { relativePath: 'docs/02_UI_Screens/00_SCREEN_FLOW.md', sourceLabel: '화면 흐름' },
  { relativePath: 'docs/02_UI_Screens/01_UI_DESIGN.md', sourceLabel: '화면 안내' },
  { relativePath: 'docs/03_Technical_Specs/05_SOURCE_COLLECTION_PRE_CODE_BRIEF.md', sourceLabel: '자료수집' },
  { relativePath: 'docs/03_Technical_Specs/15_FILING_PREPARATION_PRE_CODE_BRIEF.md', sourceLabel: '신고 준비' },
  { relativePath: 'docs/03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md', sourceLabel: '홈택스·위택스 입력 준비' },
  { relativePath: 'docs/03_Technical_Specs/40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md', sourceLabel: '신고 준비 상태' },
  { relativePath: 'docs/03_Technical_Specs/53_JC030_VAT_PATH1B_PRE_CODE_BRIEF.md', sourceLabel: '부가세 직접입력' },
]

let cachedChunks: CachedChunk[] | null = null

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function splitMarkdown(markdown: string, entry: SebiseoDocEntry): CachedChunk[] {
  const sections = markdown.split(/^##\s+/m).filter(Boolean)
  return sections.flatMap((section) => {
    const [headingLine, ...rest] = section.split('\n')
    const heading = headingLine.trim()
    const body = rest.join('\n').trim().slice(0, 2400)
    if (!body) return []
    return [{
      sourceLabel: entry.sourceLabel,
      heading,
      body,
      tokens: tokenize(`${entry.sourceLabel} ${heading} ${body}`),
    }]
  })
}

async function loadChunks() {
  if (cachedChunks) return cachedChunks
  const chunks: CachedChunk[] = []
  for (const entry of SEBISEO_DOCS) {
    try {
      const markdown = await readFile(
        path.join(/* turbopackIgnore: true */ process.cwd(), entry.relativePath),
        'utf8',
      )
      chunks.push(...splitMarkdown(markdown, entry))
    } catch {
      // A missing optional document must not break the assistant.
    }
  }
  cachedChunks = chunks
  return chunks
}

function scoreChunk(tokens: string[], chunk: CachedChunk) {
  let score = 0
  for (const token of tokens) {
    if (chunk.tokens.includes(token)) score += 1
    if (chunk.heading.toLowerCase().includes(token)) score += 2
    if (chunk.sourceLabel.includes(token)) score += 1
  }
  return score
}

export async function retrieveSebiseoDocSnippets(message: string, limit = 4): Promise<SebiseoDocSnippet[]> {
  const chunks = await loadChunks()
  const tokens = tokenize(message)
  const ranked = chunks
    .map((chunk) => ({
      sourceLabel: chunk.sourceLabel,
      heading: chunk.heading,
      body: chunk.body,
      score: scoreChunk(tokens, chunk),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)

  const selected: SebiseoDocSnippet[] = []
  const usedSources = new Set<string>()
  for (const chunk of ranked) {
    if (usedSources.has(chunk.sourceLabel)) continue
    selected.push(chunk)
    usedSources.add(chunk.sourceLabel)
    if (selected.length === limit) break
  }
  return selected
}

export function resetSebiseoDocCacheForTests() {
  cachedChunks = null
}
