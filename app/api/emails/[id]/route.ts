import { retiredLegacyEmailResponse } from '@/lib/legacy-retirement'

export async function PATCH() {
  return retiredLegacyEmailResponse()
}
