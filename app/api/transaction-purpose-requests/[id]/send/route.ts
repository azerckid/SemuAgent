import { retiredLegacyEmailResponse } from '@/lib/legacy-retirement'

// JC-031 Slice 2b-2: 거래 용도 확인 발송은 outbound_email과 sent_email_id FK를
// 생성하는 레거시 고객 요청메일 경로다. draft/row는 보존하되 발송만 차단한다.
export async function POST() {
  return retiredLegacyEmailResponse()
}
