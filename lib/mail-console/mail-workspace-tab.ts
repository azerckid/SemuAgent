import { z } from 'zod'

export const mailWorkspaceTabSchema = z.enum(['bulk', 'templates', 'history', 'inbox', 'compose', 'addresses'])

export type MailWorkspaceTab = z.infer<typeof mailWorkspaceTabSchema>

export const MAIL_WORKSPACE_TAB_LABEL: Record<MailWorkspaceTab, string> = {
  bulk: '일괄 발송',
  templates: '템플릿',
  history: '발송 이력',
  inbox: '메일함',
  compose: '메일쓰기',
  addresses: '메일주소',
}

// 메일 메뉴는 기본업무메일(자료 요청/업로드 링크)과 일반업무메일(사람이 직접
// 주고받는 메일)로 분리한다 (docs/02_UI_Screens/19_WORK_EMAIL_INBOX_UX.md §2).
export const MAIL_WORKSPACE_GROUPS: { label: string; tabs: MailWorkspaceTab[] }[] = [
  { label: '기본업무메일', tabs: ['bulk', 'templates', 'history'] },
  { label: '일반업무메일', tabs: ['inbox', 'compose', 'addresses'] },
]

export function parseMailWorkspaceTab(value: string | null | undefined): MailWorkspaceTab {
  const parsed = mailWorkspaceTabSchema.safeParse(value ?? 'bulk')
  return parsed.success ? parsed.data : 'bulk'
}

export function mailWorkspaceTabHref(tab: MailWorkspaceTab): string {
  if (tab === 'bulk') return '/dashboard/emails'
  return `/dashboard/emails?tab=${tab}`
}
