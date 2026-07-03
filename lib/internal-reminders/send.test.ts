import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/env', () => ({
  requireEmailEnv: () => ({ RESEND_API_KEY: 're_test', EMAIL_FROM: 'JARYO <noreply@example.com>' }),
}))
vi.mock('@/lib/email/from', () => ({
  getTenantEmailFrom: async (_tenantId: string, fallback: string) => fallback,
}))

import {
  buildInternalReminderContextKey,
  buildInternalReminderIdempotencyKey,
  composeInternalReminderEmail,
} from './send'

describe('internal reminder send helpers', () => {
  it('builds deterministic idempotency keys for manual sends', () => {
    const params = {
      ruleId: 'rule/vat',
      recipientId: 'staff:owner',
      contextKey: buildInternalReminderContextKey({
        domain: 'vat',
        periodKey: '2026-H1',
        mode: 'manual',
      }),
      mode: 'manual' as const,
      runKey: '2026-07-02',
    }

    expect(buildInternalReminderIdempotencyKey(params)).toBe(buildInternalReminderIdempotencyKey(params))
    expect(buildInternalReminderIdempotencyKey(params)).toContain('internal-reminder:manual')
    expect(buildInternalReminderIdempotencyKey(params)).not.toContain('/')
  })

  it('uses unique test send keys by caller-provided run key', () => {
    const base = {
      ruleId: 'rule-payroll',
      recipientId: 'staff-owner',
      contextKey: 'payroll:2026-06:test',
      mode: 'test' as const,
    }

    expect(buildInternalReminderIdempotencyKey({ ...base, runKey: 'a' }))
      .not.toBe(buildInternalReminderIdempotencyKey({ ...base, runKey: 'b' }))
  })

  it('composes internal-only mail copy without external request or auto-filing claims', () => {
    const email = composeInternalReminderEmail({
      rule: {
        domainLabel: '부가세',
        subjectPreview: '부가세 2026년 1기 마감 D-3 · 공제 검토 2건 남음',
        bodyPreview: '부가세 신고 마감 전에 공제 검토와 패키지 생성을 확인해 주세요.',
        attentionLabel: '공제 검토 2건',
      },
      recipientName: '김대표',
      companyName: '샘플컴퍼니(주)',
      mode: 'test',
    })

    expect(email.subject).toContain('[테스트]')
    expect(email.text).toContain('세무데스크 내부 업무 리마인드')
    expect(email.text).toContain('자동 홈택스 제출')
    expect(email.text).toContain('자동 납부 기능이 아닙니다')
    expect(email.text).not.toContain('고객사 요청을 발송했습니다')
    expect(email.text).not.toContain('제출 완료')
    expect(email.html).toContain('부가세 신고 마감')
  })
})
