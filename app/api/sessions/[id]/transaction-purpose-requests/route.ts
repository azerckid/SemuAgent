import { retiredLegacyEmailResponse } from '@/lib/legacy-retirement'

// JC-031 Slice 2c: 거래 용도 확인 draft 생성은 GIWA 고객 요청메일 워크플로.
// SemuAgent v1(self-use)에서는 내부 기장검토로 처리하며 신규 purpose email draft를 만들지 않는다.
export async function POST() {
  return retiredLegacyEmailResponse()
}
