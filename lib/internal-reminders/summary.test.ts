import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { buildCompanyHomePeriod } from '@/lib/company-home/summary'
import {
  INTERNAL_REMINDER_SYSTEM_USER_ID,
  buildInternalReminderProviderState,
  buildInternalReminderRecipients,
  buildInternalReminderRules,
  buildInternalReminderStats,
  internalReminderRuleId,
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

  it('JC-018 P1 regression: payroll rule label matches its actual mixed send behavior', () => {
    // 급여 규칙은 실제로 담당자+확인 필요 직원에게 발송되므로, 화면 라벨도
    // "담당자 본인"만이 아니라 그 사실을 정확히 반영해야 한다.
    const rules = buildInternalReminderRules({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      period,
      payrollLabel: '2026년 6월 급여',
      attentions: [],
      storedRules: [],
      now: DateTime.fromISO('2026-07-02T00:00:00', { zone: 'Asia/Seoul' }),
    })

    const payrollRule = rules.find((rule) => rule.domain === 'payroll')!
    expect(payrollRule.recipientSource).toBe('mixed')
    expect(payrollRule.recipientLabel).toBe('담당자 본인 + 확인 필요 직원')

    // 다른 도메인은 v1에서 staff만 유지되고 라벨도 그대로다.
    const vatRule = rules.find((rule) => rule.domain === 'vat')!
    expect(vatRule.recipientSource).toBe('staff')
    expect(vatRule.recipientLabel).toBe('담당자 본인')
  })

  it('JC-018 P1 regression: normalizes a pre-existing stored payroll rule (recipientSource=staff) to mixed', () => {
    // JC-018 배포 전에 저장된 테넌트는 payroll 규칙이 recipientSource='staff'로
    // DB에 남아 있다. payroll의 recipientSource는 코드 고정 정책이라(설정 UI 없음)
    // 저장값이 있어도 항상 mixed로 정규화되어야 한다 — 그렇지 않으면 기존
    // 테넌트에서는 직원 발송 게이트가 영구히 꺼진 채로 남는다.
    const payrollRuleId = internalReminderRuleId({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      domain: 'payroll',
      triggerType: 'daily_digest',
      offsetDays: null,
    })
    const rules = buildInternalReminderRules({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      period,
      payrollLabel: '2026년 6월 급여',
      attentions: [],
      storedRules: [{
        id: payrollRuleId,
        domain: 'payroll',
        triggerType: 'daily_digest',
        offsetDays: null,
        enabled: true,
        recipientSource: 'staff', // JC-018 이전에 저장된 낡은 값
        subjectTemplate: '{{payrollLabel}} 급여 확인 필요 {{attentionCount}}건 · 마감 전 처리',
        bodyTemplate: '급여대장의 확인 필요 직원과 4대보험 고지액 매칭 상태를 확인해 주세요.',
      }],
    })

    const payrollRule = rules.find((rule) => rule.domain === 'payroll')!
    expect(payrollRule.recipientSource).toBe('mixed')
    expect(payrollRule.recipientLabel).toBe('담당자 본인 + 확인 필요 직원')
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
