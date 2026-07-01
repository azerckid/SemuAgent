import { describe, expect, it } from 'vitest'
import { criterionReviewPatchSchema } from './criterion-review'

describe('criterionReviewPatchSchema', () => {
  it('requires staffNote for overridden review status', () => {
    const parsed = criterionReviewPatchSchema.safeParse({
      reviewStatus: 'overridden',
    })

    expect(parsed.success).toBe(false)
  })

  it('requires staffNote for excluded review status', () => {
    const parsed = criterionReviewPatchSchema.safeParse({
      reviewStatus: 'excluded',
      staffNote: '   ',
    })

    expect(parsed.success).toBe(false)
  })

  it('accepts confirmed review without staffNote', () => {
    const parsed = criterionReviewPatchSchema.safeParse({
      reviewStatus: 'confirmed',
    })

    expect(parsed.success).toBe(true)
  })
})
