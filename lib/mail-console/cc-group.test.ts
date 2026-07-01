import { describe, expect, it } from 'vitest'
import {
  filterCcGroupsForWorkType,
  pickDefaultCcGroup,
  resolveCcGroupSelection,
} from './cc-group'

const groups = [
  {
    id: 'general-default',
    name: '기장 CC',
    purpose: 'general' as const,
    emails: 'general@example.com',
    isDefault: true,
  },
  {
    id: 'general-alt',
    name: '기장 보조',
    purpose: 'general' as const,
    emails: 'general-alt@example.com',
    isDefault: false,
  },
  {
    id: 'payroll-default',
    name: '급여 CC',
    purpose: 'payroll' as const,
    emails: 'payroll@example.com',
    isDefault: true,
  },
]

describe('pickDefaultCcGroup', () => {
  it('prefers payroll groups for payroll work type', () => {
    expect(pickDefaultCcGroup(groups, 'payroll')?.id).toBe('payroll-default')
  })

  it('prefers general groups for bookkeeping and vat work types', () => {
    expect(pickDefaultCcGroup(groups, 'bookkeeping')?.id).toBe('general-default')
    expect(pickDefaultCcGroup(groups, 'vat')?.id).toBe('general-default')
  })

  it('falls back to general groups for payroll when no payroll groups exist', () => {
    const generalOnly = groups.filter((group) => group.purpose === 'general')
    expect(pickDefaultCcGroup(generalOnly, 'payroll')?.id).toBe('general-default')
  })

  it('returns null when no cc groups exist', () => {
    expect(pickDefaultCcGroup([], 'payroll')).toBeNull()
    expect(pickDefaultCcGroup([], 'bookkeeping')).toBeNull()
  })
})

describe('filterCcGroupsForWorkType', () => {
  it('includes all-purpose groups for the active work type', () => {
    const allPurposeGroup = {
      id: 'all',
      name: '공통 CC',
      purpose: 'all' as const,
      emails: 'all@example.com',
      isDefault: false,
    }

    expect(filterCcGroupsForWorkType([...groups, allPurposeGroup], 'payroll').map((group) => group.id)).toEqual([
      'payroll-default',
      'all',
    ])
  })
})

describe('resolveCcGroupSelection', () => {
  it('uses explicit selection when provided', () => {
    expect(resolveCcGroupSelection(groups, 'bookkeeping', 'general-alt')?.id).toBe('general-alt')
  })

  it('returns null when CC is explicitly disabled', () => {
    expect(resolveCcGroupSelection(groups, 'bookkeeping', null)).toBeNull()
  })
})
