import { retiredLegacyEmailResponse } from '@/lib/legacy-retirement'

// JC-031 Slice 2c: purpose request draft 조회/수정은 레거시 고객 요청메일 UI 전용.
export async function GET() {
  return retiredLegacyEmailResponse()
}

export async function PATCH() {
  return retiredLegacyEmailResponse()
}
