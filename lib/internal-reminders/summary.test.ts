import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { buildCompanyHomePeriod } from '@/lib/company-home/summary'
import {
  INTERNAL_REMINDER_SYSTEM_USER_ID,
  buildInternalReminderProviderState,
  buildInternalReminderRecipients,
  buildInternalReminderRules,
  buildInternalReminderStats,
  isInternalReminderProviderConfigured,
  isInternalReminderRuleDue,
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

  it('system scope (cron, no session) marks no staff as 본인 and keeps active staff included', () => {
    const recipients = buildInternalReminderRecipients([
      {
        id: 'staff-1',
        userId: 'user-1',
        email: 'owner@example.com',
        name: '김대표',
        role: 'owner',
        active: true,
      },
      {
        id: 'staff-2',
        userId: 'user-2',
        email: 'sumin@example.com',
        name: '이수민',
        role: 'member',
        active: true,
      },
    ], INTERNAL_REMINDER_SYSTEM_USER_ID)

    expect(recipients.every((recipient) => recipient.chipLabel !== '본인')).toBe(true)
    expect(recipients.filter((recipient) => recipient.included)).toHaveLength(2)
  })
})

describe('internal reminder cron due judgment', () => {
  const today = DateTime.fromISO('2026-07-02T00:00:00', { zone: 'Asia/Seoul' })
  const deadlineMinus = (days: number) =>
    today
      .set({
        year: Number(period.filingDeadline.slice(0, 4)),
        month: Number(period.filingDeadline.slice(5, 7)),
        day: Number(period.filingDeadline.slice(8, 10)),
      })
      .minus({ days })

  it('sends daily_digest only when there is attention (skips 0-count) and never sends manual via cron', () => {
    // 확인 필요 건이 있을 때만 발송
    expect(isInternalReminderRuleDue({
      rule: { triggerType: 'daily_digest', offsetDays: null, enabled: true, domain: 'payroll', attentionCount: 1 },
      period,
      today,
    })).toBe(true)
    // 확인 필요 0건이면 발송하지 않는다 (0건 메일 스팸 방지)
    expect(isInternalReminderRuleDue({
      rule: { triggerType: 'daily_digest', offsetDays: null, enabled: true, domain: 'payroll', attentionCount: 0 },
      period,
      today,
    })).toBe(false)
    expect(isInternalReminderRuleDue({
      rule: { triggerType: 'manual', offsetDays: null, enabled: true, domain: 'filing_support', attentionCount: 5 },
      period,
      today,
    })).toBe(false)
  })

  it('sends deadline_offset(vat) on filingDeadline − offsetDays regardless of attention', () => {
    const dueDay = deadlineMinus(3)
    // deadline_offset은 마감 리마인드이므로 attentionCount 0이어도 마감일 기준으로 발송한다
    expect(isInternalReminderRuleDue({
      rule: { triggerType: 'deadline_offset', offsetDays: 3, enabled: true, domain: 'vat', attentionCount: 0 },
      period,
      today: dueDay,
    })).toBe(true)
    // 마감 당일(오프셋 0)엔 발송하지 않는다 (offsetDays=3 규칙)
    expect(isInternalReminderRuleDue({
      rule: { triggerType: 'deadline_offset', offsetDays: 3, enabled: true, domain: 'vat', attentionCount: 2 },
      period,
      today: deadlineMinus(0),
    })).toBe(false)
  })

  it('skips deadline_offset for non-vat domains (v1 has no other deadline mapping)', () => {
    expect(isInternalReminderRuleDue({
      rule: { triggerType: 'deadline_offset', offsetDays: 3, enabled: true, domain: 'payroll', attentionCount: 4 },
      period,
      today: deadlineMinus(3),
    })).toBe(false)
  })

  it('never sends disabled rules', () => {
    expect(isInternalReminderRuleDue({
      rule: { triggerType: 'daily_digest', offsetDays: null, enabled: false, domain: 'payroll', attentionCount: 9 },
      period,
      today,
    })).toBe(false)
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
