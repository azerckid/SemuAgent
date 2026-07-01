import {
  buildDefaultCcSelections,
  resolveCcGroupSelection,
} from '@/lib/mail-console/cc-group'
import type { MailTemplateWorkType } from '@/lib/mail-console/default-templates'
import type { MailConsoleClient } from './mail-console-types'

export function applyCcSelectionsToClients(
  clients: MailConsoleClient[],
  workType: MailTemplateWorkType,
  ccSelections: Record<string, string | null>,
): MailConsoleClient[] {
  return clients.map((client) => {
    const selectedCcGroup = resolveCcGroupSelection(
      client.ccGroups,
      workType,
      ccSelections[client.id],
    )

    return {
      ...client,
      ccGroup: selectedCcGroup?.name ?? null,
      ccEmails: selectedCcGroup?.emails ?? null,
      ccGroupPurpose: selectedCcGroup?.purpose ?? null,
    }
  })
}

export { buildDefaultCcSelections }
