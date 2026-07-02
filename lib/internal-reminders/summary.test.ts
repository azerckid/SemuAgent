import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { buildCompanyHomePeriod } from '@/lib/company-home/summary'
import {
  buildInternalReminderProviderState,
  buildInternalReminderRecipients,
  buildInternalReminderRules,
  buildInternalReminderStats,
  isInternalReminderProviderConfigured,
  renderReminderTemplate,
  triggerLabel,
} from './summary'

const period = buildCompanyHomePeriod({
  periodKey: '2026-H1',
  today: DateTime.fromISO('2026-07-02T00:00:00', { zone: 'Asia/Seoul' }),
  timezone: 'Asia/Seoul',
})

describe('internal reminder provider state', () => {
  it('locks sending when Resend settings are missing or placeholders', () => {
    expect(isInternalReminderProviderConfigured({})).toBe(false)
    expect(isInternalReminderProviderConfigured({
      RESEND_API_KEY: 'your-resend-key',
      EMAIL_FROM: 'noreply@example.com',
    })).toBe(false)
    expect(isInternalReminderProviderConfigured({
      RESEND_API_KEY: 're_real_key',
      EMAIL_FROM: 'your-email@example.com',
    })).toBe(false)
    expect(isInternalReminderProviderConfigured({
      RESEND_API_KEY: 're_real_key',
      EMAIL_FROM: 'JARYO <noreply@example.com>',
    })).toBe(true)
  })

  it('exposes a provider-missing message for the UI state card', () => {
    expect(buildInternalReminderProviderState(false)).toMatchObject({
      configured: false,
      label: 'missing',
    })
    expect(buildInternalReminderProviderState(false).message).toContain('RESEND_API_KEY')
  })
})

describe('internal reminder recipients', () => {
  it('uses staff/self recipients first and excludes inactive or email-missing staff', () => {
    const recipients = buildInternalReminderRecipients([
      {
        id: 'staff-2',
        userId: 'user-2',
        email: 'sumin@example.com',
        name: '이수민',
        role: 'member',
        active: true,
      },
      {
        id: 'staff-1',
        userId: 'user-1',
        email: 'owner@example.com',
        name: '김대표',
        role: 'owner',
        active: true,
      },
      {
        id: 'staff-3',
        userId: 'user-3',
        email: '',
        name: '정하늘',
        role: 'member',
        active: true,
      },
    ], 'user-1')

    expect(recipients.map((recipient) => [recipient.name, recipient.chipLabel, recipient.included])).toEqual([
      ['김대표', '본인', true],
      ['이수민', 'staff', true],
      ['정하늘', '제외', false],
    ])
    expect(recipients[2].email).toContain('알림 수신 꺼짐')
  })
})

describe('internal reminder rule derivation', () => {
  it('builds the approved default rules and keeps filing support manual-disabled by default', () => {
    const rules = buildInternalReminderRules({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      period,
      payrollLabel: '2026년 6월 급여',
      attentions: [
        { domain: 'vat', count: 3, label: '공제 검토 3건' },
        { domain: 'payroll', count: 1, label: '급여 확인 필요 1건' },
      ],
      storedRules: [],
      now: DateTime.fromISO('2026-07-02T00:00:00', { zone: 'Asia/Seoul' }),
    })

    expect(rules).toHaveLength(4)
    expect(rules.filter((rule) => rule.enabled)).toHaveLength(3)
    expect(rules.map((rule) => rule.domain)).toEqual(['vat', 'payroll', 'source_collection', 'filing_support'])
    expect(rules.find((rule) => rule.domain === 'filing_support')).toMatchObject({
      triggerType: 'manual',
      enabled: false,
      nextRunAt: null,
    })
    expect(rules.find((rule) => rule.domain === 'vat')?.subjectPreview).toContain('공제 검토 3건')
    expect(rules.find((rule) => rule.domain === 'payroll')?.subjectPreview).toContain('2026년 6월 급여')
  })

  it('uses stored rule settings to override default enablement', () => {
    const rules = buildInternalReminderRules({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      period,
      payrollLabel: '최근 급여',
      attentions: [],
      storedRules: [{
        id: 'internal_reminder_rule__tenant-1__client-1__vat__deadline_offset__3',
        domain: 'vat',
        triggerType: 'deadline_offset',
        offsetDays: 3,
        enabled: false,
        recipientSource: 'staff',
        subjectTemplate: '부가세 {{attentionCount}}',
        bodyTemplate: '부가세 본문',
      }],
    })

    expect(rules.find((rule) => rule.domain === 'vat')).toMatchObject({
      enabled: false,
      subjectPreview: '부가세 0',
      nextRunAt: null,
    })
  })

  it('renders templates and trigger labels for preview copy', () => {
    expect(renderReminderTemplate('{{periodLabel}} / {{payrollLabel}} / {{dDay}} / {{attentionCount}} / {{domainLabel}}', {
      periodLabel: '2026년 1기',
      payrollLabel: '2026년 6월 급여',
      dDay: 23,
      attentionCount: 2,
      domainLabel: '부가세',
    })).toBe('2026년 1기 / 2026년 6월 급여 / 23 / 2 / 부가세')

    expect(triggerLabel({ triggerType: 'deadline_offset', offsetDays: 3 })).toBe('마감 D-7 / D-3 / D-1')
    expect(triggerLabel({ triggerType: 'daily_digest', offsetDays: null })).toBe('일일 요약 09:00')
    expect(triggerLabel({ triggerType: 'manual', offsetDays: null })).toBe('수동 발송')
  })
})

describe('internal reminder stats', () => {
  it('counts active rules, attention domains, and failed sends', () => {
    expect(buildInternalReminderStats({
      rules: [{ enabled: true }, { enabled: true }, { enabled: false }],
      attentions: [
        { domain: 'vat', count: 3, label: '공제 검토 3건' },
        { domain: 'payroll', count: 1, label: '급여 확인 필요 1건' },
        { domain: 'source_collection', count: 0, label: '자료수집 확인 필요 없음' },
      ],
      logs: [{ status: 'sent' }, { status: 'failed' }, { status: 'skipped' }],
    })).toEqual({
      enabledRuleCount: 2,
      pendingAttentionCount: 2,
      failedSendCount: 1,
    })
  })
})
