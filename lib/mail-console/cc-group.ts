import type { MailTemplateWorkType } from './default-templates'

export type CcGroupRecord = {
  id: string
  name: string
  purpose: 'general' | 'payroll' | 'all'
  emails: string
  isDefault: boolean
}

export function ccGroupPurposeForWorkType(
  workType: MailTemplateWorkType,
): 'general' | 'payroll' {
  return workType === 'payroll' ? 'payroll' : 'general'
}

export function filterCcGroupsForWorkType(
  groups: CcGroupRecord[],
  workType: MailTemplateWorkType,
): CcGroupRecord[] {
  const purpose = ccGroupPurposeForWorkType(workType)
  return groups.filter((group) => group.purpose === purpose || group.purpose === 'all')
}

export function pickDefaultCcGroup(
  groups: CcGroupRecord[],
  workType: MailTemplateWorkType,
): CcGroupRecord | null {
  const preferred = filterCcGroupsForWorkType(groups, workType)
  return (
    preferred.find((group) => group.isDefault)
    ?? preferred[0]
    ?? groups.find((group) => group.isDefault)
    ?? groups[0]
    ?? null
  )
}

export function resolveCcGroupSelection(
  groups: CcGroupRecord[],
  workType: MailTemplateWorkType,
  selectedCcGroupId: string | null | undefined,
): CcGroupRecord | null {
  if (selectedCcGroupId) {
    const selected = groups.find((group) => group.id === selectedCcGroupId)
    if (selected) return selected
  }

  if (selectedCcGroupId === null) {
    return null
  }

  return pickDefaultCcGroup(groups, workType)
}

export function buildDefaultCcSelections(
  clients: Array<{ id: string; ccGroups: CcGroupRecord[] }>,
  workType: MailTemplateWorkType,
): Record<string, string | null> {
  return Object.fromEntries(
    clients.map((client) => {
      const defaultGroup = pickDefaultCcGroup(client.ccGroups, workType)
      return [client.id, defaultGroup?.id ?? null]
    }),
  )
}
