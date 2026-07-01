// 일반업무메일 운영 수신 도메인.
// 기본업무메일의 noreply 발신 주소와 섞지 않고, 사무소 소유 업무 메일주소에만 사용한다.
export const STAFF_MAILBOX_DOMAIN = 'jaaryo.online'

export function buildStaffMailboxAddress(alias: string): string {
  return `${alias}@${STAFF_MAILBOX_DOMAIN}`
}
