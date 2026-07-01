import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const reviewsComponentsDir = dirname(fileURLToPath(import.meta.url))
const libReviewsDir = join(reviewsComponentsDir, '../../../../../lib/reviews')

// review-submission-status.ts는 lib/reviews로 이동했으나, 공유 status 로직이
// staff_direct 분기를 갖지 않아야 한다는 parity 규칙은 새 위치에서도 동일하게 검증한다.
const sharedSubmissionStatusUiFiles = [
  join(reviewsComponentsDir, 'review-validation-table.tsx'),
  join(reviewsComponentsDir, 'criterion-review-actions.tsx'),
  join(reviewsComponentsDir, 'criterion-review-ui.ts'),
  join(libReviewsDir, 'review-submission-status.ts'),
]

const allowedStaffDirectShellFiles = new Set([
  'review-shell-copy.ts',
  'review-file-actions.tsx',
  'review-request-method.ts',
])

describe('review submission status UI parity', () => {
  it('keeps staff_direct branches out of shared submission-status components', () => {
    for (const filePath of sharedSubmissionStatusUiFiles) {
      const source = readFileSync(filePath, 'utf8')
      expect(source, filePath).not.toMatch(/staff_direct/)
      expect(source, filePath).not.toMatch(/customer_upload/)
      expect(source, filePath).not.toMatch(/source\s*===/)
    }
  })

  it('limits staff_direct conditionals to shell-only review components', () => {
    const shellFilesWithStaffDirect = [
      'review-shell-copy.ts',
      'review-file-actions.tsx',
      'review-request-method.ts',
    ]

    for (const fileName of shellFilesWithStaffDirect) {
      expect(allowedStaffDirectShellFiles.has(fileName), fileName).toBe(true)
      const source = readFileSync(join(reviewsComponentsDir, fileName), 'utf8')
      expect(source, fileName).toMatch(/staff_direct/)
    }
  })
})
