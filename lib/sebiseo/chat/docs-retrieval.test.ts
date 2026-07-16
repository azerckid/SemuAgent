import { describe, expect, it } from 'vitest'
import {
  resetSebiseoDocCacheForTests,
  retrieveSebiseoDocSnippets,
} from './docs-retrieval'

describe('retrieveSebiseoDocSnippets', () => {
  it('retrieves SemuAgent product documents for workflow questions', async () => {
    resetSebiseoDocCacheForTests()
    const snippets = await retrieveSebiseoDocSnippets('자료수집 파일 업로드 화면')
    expect(snippets.length).toBeGreaterThan(0)
    expect(snippets.some((snippet) => snippet.sourceLabel.includes('자료수집'))).toBe(true)
    expect(new Set(snippets.map((snippet) => snippet.sourceLabel)).size).toBe(snippets.length)
  })
})
