import type { MailConsoleClient, MailConsoleTemplateDraft } from './mail-console-types'

const TOKEN_PATTERN = /\[\[[^\]]+\]\]/g

export function getTokenReplacements(
  draft: MailConsoleTemplateDraft,
  client?: MailConsoleClient
): Record<string, string> {
  return {
    '[[고객명]]': client?.name ?? '',
    '[[담당자명]]': client?.managerName ?? '',
    '[[회계기간]]': draft.accountingPeriod,
    '[[제출기한]]': draft.dueDate,
    '[[업로드링크]]': '발송 시 고객사별로 생성',
  }
}

export function applyTokenReplacements(
  value: string,
  draft: MailConsoleTemplateDraft,
  client?: MailConsoleClient
): string {
  const replacements = getTokenReplacements(draft, client)
  return Object.entries(replacements).reduce(
    (result, [token, replacement]) => result.split(token).join(replacement),
    value
  )
}

export function countUnresolvedTokens(
  draft: MailConsoleTemplateDraft,
  client?: MailConsoleClient
): number {
  const replacements = getTokenReplacements(draft, client)
  const text = `${draft.subject}\n${draft.body}`
  return Array.from(new Set(text.match(TOKEN_PATTERN) ?? []))
    .filter((token) => !replacements[token])
    .length
}
