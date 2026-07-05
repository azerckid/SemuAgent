import { retiredLegacyEmailResponse } from '@/lib/legacy-retirement'

export async function POST() {
  return retiredLegacyEmailResponse()
}
