import { describe, expect, it } from 'vitest'
import {
  HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_STEPS,
  HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_URL,
  HOMETAX_SIMPLIFIED_WAGE_MENU_PATH,
  hometaxDirectEntryStepSchema,
} from './hometax-guide'

describe('hometax-guide', () => {
  it('uses the official Hometax entry point', () => {
    expect(HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_URL).toBe('https://www.hometax.go.kr/')
  })

  it('defines the current direct-entry path without conversion-file wording', () => {
    expect(HOMETAX_SIMPLIFIED_WAGE_MENU_PATH).toContain('직접작성 제출')
    expect(HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_STEPS).toHaveLength(3)
    expect(HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_STEPS.map((step) => step.label).join(' ')).not.toContain('변환 파일')
    expect(HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_STEPS.map((step) => step.label).join(' ')).not.toContain('암호화')
    for (const step of HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_STEPS) {
      expect(hometaxDirectEntryStepSchema.safeParse(step).success).toBe(true)
    }
  })
})
