import { describe, expect, it } from 'vitest'
import { extractDocumentText } from '@/lib/ai/extract'

describe('extractDocumentText text/word', () => {
  it('txt 파일에서 UTF-8 텍스트를 추출한다', async () => {
    const buffer = new TextEncoder().encode('식대는 월 20만원 비과세').buffer
    const result = await extractDocumentText({
      fileBuffer: buffer,
      fileType: 'text',
      originalFilename: 'rules.txt',
    })
    expect(result.text).toContain('식대')
  })
})
