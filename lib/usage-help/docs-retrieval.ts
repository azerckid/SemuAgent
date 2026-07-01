import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { USAGE_HELP_DOCS_ALLOWLIST, type UsageHelpDocEntry } from '@/lib/usage-help/docs-allowlist'

export type UsageHelpDocSnippet = {
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

let cachedChunks: CachedChunk[] | null = null

function normalizeQuestionText(text: string) {
  return text
    .replace(/사유입력/g, '사유 입력')
    .replace(/제출없음/g, '제출 없음')
    .replace(/확인필요/g, '확인 필요')
}

function tokenize(text: string) {
  return normalizeQuestionText(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function splitMarkdownIntoChunks(markdown: string, entry: UsageHelpDocEntry): CachedChunk[] {
  const sections = markdown.split(/^##\s+/m).filter(Boolean)
  if (sections.length === 0) {
    const body = markdown.trim()
    return body
      ? [{
          sourceLabel: entry.sourceLabel,
          heading: entry.sourceLabel,
          body: body.slice(0, 2500),
          tokens: tokenize(`${entry.sourceLabel} ${body}`),
        }]
      : []
  }

  return sections.map((section) => {
    const [headingLine, ...rest] = section.split('\n')
    const heading = headingLine.trim()
    const body = rest.join('\n').trim().slice(0, 2500)
    return {
      sourceLabel: entry.sourceLabel,
      heading,
      body,
      tokens: tokenize(`${heading} ${body} ${entry.sourceLabel}`),
    }
  })
}

async function loadAllowlistedChunks() {
  if (cachedChunks) return cachedChunks

  const chunks: CachedChunk[] = []
  for (const entry of USAGE_HELP_DOCS_ALLOWLIST) {
    const absolutePath = path.join(/* turbopackIgnore: true */ process.cwd(), entry.relativePath)
    try {
      const markdown = await readFile(absolutePath, 'utf8')
      chunks.push(...splitMarkdownIntoChunks(markdown, entry))
    } catch {
      // Missing doc files should not crash the assistant; skip silently.
    }
  }

  cachedChunks = chunks
  return chunks
}

function scoreChunk(questionTokens: string[], chunk: CachedChunk) {
  if (questionTokens.length === 0) return 0
  let score = 0
  for (const token of questionTokens) {
    if (chunk.tokens.includes(token)) score += 1
    if (chunk.heading.toLowerCase().includes(token)) score += 2
    if (chunk.sourceLabel.toLowerCase().includes(token)) score += 1
  }
  return score
}

export async function retrieveUsageHelpDocSnippets(question: string, limit = 5) {
  const chunks = await loadAllowlistedChunks()
  const questionTokens = tokenize(question)
  const scored = chunks
    .map((chunk) => ({
      sourceLabel: chunk.sourceLabel,
      heading: chunk.heading,
      body: chunk.body,
      score: scoreChunk(questionTokens, chunk),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored
}

export function resetUsageHelpDocCacheForTests() {
  cachedChunks = null
}
