import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspaceRoot = process.cwd()
const workspaceSource = readFileSync(
  join(workspaceRoot, 'app/(dashboard)/dashboard/sebiseo/_components/sebiseo-workspace.tsx'),
  'utf8',
)
const periodConfirmSource = readFileSync(
  join(workspaceRoot, 'app/(dashboard)/dashboard/sebiseo/_components/sebiseo-period-confirm.tsx'),
  'utf8',
)
const pageSource = readFileSync(
  join(workspaceRoot, 'app/(dashboard)/dashboard/sebiseo/page.tsx'),
  'utf8',
)
const uploadClientSource = readFileSync(
  join(workspaceRoot, 'lib/sebiseo/upload-client.ts'),
  'utf8',
)
const composerSource = readFileSync(
  join(workspaceRoot, 'app/(dashboard)/dashboard/sebiseo/_components/sebiseo-composer.tsx'),
  'utf8',
)
const chatClientSource = readFileSync(
  join(workspaceRoot, 'lib/sebiseo/chat/client.ts'),
  'utf8',
)
const threadSource = readFileSync(
  join(workspaceRoot, 'app/(dashboard)/dashboard/sebiseo/_components/sebiseo-thread.tsx'),
  'utf8',
)
const typewriterSource = readFileSync(
  join(workspaceRoot, 'app/(dashboard)/dashboard/sebiseo/_components/sebiseo-typewriter.tsx'),
  'utf8',
)

describe('세비서 workspace shell (JC-043 CUI-3b)', () => {
  it('keeps trust shell and enables attach with period confirm gate', () => {
    expect(workspaceSource).toContain('bg-[#171717]')
    expect(workspaceSource).toContain('세무 일정(참고)')
    expect(composerSource).toContain('세비서에게 묻기')
    expect(composerSource).toContain('대화와 파일 첨부를 사용할 수 있습니다')
    expect(workspaceSource).toContain('SebiseoPeriodConfirm')
    expect(workspaceSource).not.toContain('파일 올렸는데')
    expect(workspaceSource).not.toContain('예외·누락 거래가 있으니')
    expect(periodConfirmSource).toContain('적용 기간 확인')
    expect(periodConfirmSource).toContain('확인 후 업로드')
  })

  it('keeps Instant/Mic/Voice disabled and enables explicit chat only', () => {
    expect(composerSource).toContain('Instant')
    expect(composerSource).toContain('AudioLines')
    expect(composerSource).toMatch(/disabled[\s\S]*Instant/)
    expect(chatClientSource).toContain('/api/sebiseo/chat')
    expect(workspaceSource).toContain('requestSebiseoChat')
    expect(pageSource).not.toContain('openai')
    expect(pageSource).not.toContain('anthropic')
  })

  it('keeps chat ephemeral and redacts before the client request', () => {
    expect(workspaceSource).toContain("useState<SebiseoThreadItem[]>([])")
    expect(workspaceSource).toContain('redactAssistantText(message)')
    expect(workspaceSource).not.toContain('localStorage')
    expect(workspaceSource).not.toContain('indexedDB')
  })

  it('wires upload only through confirmed period + existing staff_direct path', () => {
    expect(pageSource).toContain('buildSebiseoPeriodOptions')
    expect(pageSource).toContain('loadSourceCollectionSummary')
    expect(uploadClientSource).toContain('/api/staff-direct-upload')
    expect(uploadClientSource).toContain('/api/upload/submit')
    expect(workspaceSource).toContain('createSebiseoUploadSession')
    expect(workspaceSource).toContain('Period confirm is required before any staff-direct-upload call')
  })
  it("animates only normal assistant answers and respects reduced motion", () => {
    expect(threadSource).toContain("SebiseoTypewriter")
    expect(threadSource).toContain("item.tone ===")
    expect(threadSource).toContain("complete ? <AssistantActions")
    expect(typewriterSource).toContain("prefers-reduced-motion: reduce")
    expect(typewriterSource).toContain("aria-live={isComplete")
  })

})
