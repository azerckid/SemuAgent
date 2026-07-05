import { describe, expect, it } from 'vitest'
import { RETIRED_LEGACY_EMAIL_MESSAGE, retiredLegacyEmailResponse } from './legacy-retirement'

describe('retiredLegacyEmailResponse', () => {
  it('returns a stable 410 response for retired legacy request-mail write routes', async () => {
    const response = retiredLegacyEmailResponse()

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({ error: RETIRED_LEGACY_EMAIL_MESSAGE })
  })
})
