import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('source collection UI boundaries (JC-004 slice)', () => {
  const source = readFileSync(new URL('./source-collection.tsx', import.meta.url), 'utf8')

  it('does not link to the external upload portal or customer submission routes (S-70)', () => {
    expect(source).not.toContain('/upload/[token]')
    expect(source).not.toContain('/upload/submit')
    expect(source).not.toContain('purpose-request')
  })

  it('does not use accounting-firm or client-request wording (S-71)', () => {
    const forbiddenWords = ['고객사', '세무사', '회계법인', '고객 요청']
    for (const word of forbiddenWords) {
      expect(source).not.toContain(word)
    }
  })

  it('does not reference excluded mail/request tables or UI (S-72)', () => {
    const forbiddenIdentifiers = ['outboundEmail', 'inboundEmail', 'staffMailbox', 'requestTemplate']
    for (const identifier of forbiddenIdentifiers) {
      expect(source).not.toContain(identifier)
    }
  })

  it('uses preview-aligned section labels and table columns (Phase A parity)', () => {
    expect(source).toContain('자료유형 정규화')
    expect(source).toContain('전체 보기')
    expect(source).toContain('>파일</TableHead>')
    expect(source).toContain('>자료유형</TableHead>')
    expect(source).toContain('SourceCollectionUploadDropzone')
    expect(source).toContain('upload-dropzone')
  })
})
