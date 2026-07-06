import { describe, expect, it } from 'vitest'
import {
  HOMETAX_SIMPLIFIED_WAGE_CONVERT_URL,
  HOMETAX_SIMPLIFIED_WAGE_UPLOAD_STEPS,
  SIMPLIFIED_WAGE_OPERATIONAL_CHECKLIST,
  hometaxUploadStepSchema,
} from './hometax-guide'

describe('hometax-guide', () => {
  it('uses official hometax deep link for simplified wage conversion', () => {
    expect(HOMETAX_SIMPLIFIED_WAGE_CONVERT_URL).toMatch(/^https:\/\/www\.hometax\.go\.kr\//)
    expect(HOMETAX_SIMPLIFIED_WAGE_CONVERT_URL).toContain('tm3lIdx=4401100000')
  })

  it('defines upload steps in order', () => {
    expect(HOMETAX_SIMPLIFIED_WAGE_UPLOAD_STEPS).toHaveLength(5)
    for (const step of HOMETAX_SIMPLIFIED_WAGE_UPLOAD_STEPS) {
      expect(hometaxUploadStepSchema.safeParse(step).success).toBe(true)
    }
  })

  it('includes operational checklist from Brief §9', () => {
    expect(SIMPLIFIED_WAGE_OPERATIONAL_CHECKLIST.length).toBeGreaterThanOrEqual(4)
    expect(SIMPLIFIED_WAGE_OPERATIONAL_CHECKLIST.some((i) => i.id === 'staging-upload')).toBe(true)
  })
})
