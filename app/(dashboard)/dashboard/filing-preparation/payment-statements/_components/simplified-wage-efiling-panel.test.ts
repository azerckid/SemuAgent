import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const panelSource = readFileSync(
  new URL('./simplified-wage-efiling-panel.tsx', import.meta.url),
  'utf8',
)

describe('SimplifiedWageEfilingPanel boundary', () => {
  it('renders the direct-entry contract', () => {
    expect(panelSource).toContain('홈택스 직접작성 값 정리')
    expect(panelSource).toContain('소득자별 직접작성 값')
    expect(panelSource).toContain('홈택스에서 직접 입력')
    expect(panelSource).toContain('원천징수세액은 간이지급명세서 입력값이 아닙니다.')
  })

  it('does not expose the retired file-generation workflow', () => {
    for (const retiredCopy of [
      '전자신고 파일 후보',
      '파일 생성 준비',
      'plain 후보 다운로드',
      'SimplifiedWageEfilingGenerateForm',
      'SimplifiedWageEfilingUploadGuide',
    ]) {
      expect(panelSource).not.toContain(retiredCopy)
    }
  })
})
