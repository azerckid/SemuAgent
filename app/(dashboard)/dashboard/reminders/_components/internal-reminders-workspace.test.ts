import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentsDir = new URL('.', import.meta.url)
const workspaceRoot = join(componentsDir.pathname, '../../../../..')
const workspaceSource = readFileSync(new URL('./internal-reminders-workspace.tsx', import.meta.url), 'utf8')
const actionsSource = readFileSync(new URL('./reminder-actions.tsx', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')
const summarySource = readFileSync(join(workspaceRoot, 'lib/internal-reminders/summary.ts'), 'utf8')
const sendSource = readFileSync(join(workspaceRoot, 'lib/internal-reminders/send.ts'), 'utf8')
const ruleRouteSource = readFileSync(join(workspaceRoot, 'app/api/internal-reminders/rules/[ruleId]/route.ts'), 'utf8')
const testSendRouteSource = readFileSync(join(workspaceRoot, 'app/api/internal-reminders/rules/[ruleId]/test-send/route.ts'), 'utf8')
const sendNowRouteSource = readFileSync(join(workspaceRoot, 'app/api/internal-reminders/send-now/route.ts'), 'utf8')
const sidebarSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/_components/sidebar.tsx'), 'utf8')
const layoutSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/layout.tsx'), 'utf8')
const schemaSource = readFileSync(join(workspaceRoot, 'lib/db/schema.ts'), 'utf8')

describe('internal reminders workspace static contract (JC-016)', () => {
  it('renders the approved Preview section order (S-01, S-70)', () => {
    const sectionOrder = [
      'InternalOnlyBanner',
      'ReminderStats',
      'ReminderRuleList',
      'RecipientPreview',
      'SendLogTable',
      'StateCoverageSection',
      'PreviewNote',
    ]
    const positions = sectionOrder.map((token) => workspaceSource.indexOf(`<${token}`))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('routes sidebar navigation to the independent reminder workspace (S-02, S-72)', () => {
    expect(sidebarSource).toContain("href: '/dashboard/reminders'")
    expect(sidebarSource).toContain('reminderAttentionCount')
    expect(layoutSource).toContain('loadInternalReminderAttentionCount')
    expect(pageSource).toContain('loadInternalReminderSummary')
  })

  it('keeps the internal-only responsibility boundary visible (S-04, S-60~62)', () => {
    const renderSource = `${workspaceSource}\n${sendSource}`

    expect(renderSource).toContain('회사 내부 업무 알림입니다')
    expect(renderSource).toContain('고객사 요청 메일·자동 홈택스 제출/납부는 제공하지 않습니다')
    expect(renderSource).toContain('고객사 요청 메일, 자동 홈택스 제출, 자동 납부 기능이 아닙니다')
    expect(renderSource).not.toContain('자동 신고 완료')
    expect(renderSource).not.toContain('홈택스 제출 완료')
  })

  it('does not import GIWA customer request mail domain tables (S-63, S-91)', () => {
    const implementationSource = [
      pageSource,
      workspaceSource,
      actionsSource,
      summarySource,
      sendSource,
      ruleRouteSource,
      testSendRouteSource,
      sendNowRouteSource,
    ].join('\n')

    for (const forbidden of [
      'clientRequestEvent',
      'outboundEmail',
      'inboundEmail',
      'staffMailbox',
      'requestTemplate',
      'clientRequestSchedule',
      'staff-direct-upload',
      'upload/[token]',
    ]) {
      expect(implementationSource).not.toContain(forbidden)
    }
  })

  it('wires rule toggle, test send, and send-now actions to tenant-scoped API routes (S-40~43)', () => {
    expect(actionsSource).toContain('/api/internal-reminders/rules/${ruleId}')
    expect(actionsSource).toContain('/api/internal-reminders/rules/${ruleId}/test-send')
    expect(actionsSource).toContain("fetch('/api/internal-reminders/send-now'")

    for (const routeSource of [ruleRouteSource, testSendRouteSource, sendNowRouteSource]) {
      expect(routeSource).toContain('requireTenantSession')
      expect(routeSource).toContain('getActiveStaffForUser')
      expect(routeSource).toContain('tenantId')
      expect(routeSource).toContain("revalidatePath('/dashboard/reminders')")
    }
  })

  it('locks send actions when the provider is missing and exposes provider-missing state (S-50~52)', () => {
    expect(summarySource).toContain('RESEND_API_KEY 또는 EMAIL_FROM')
    expect(workspaceSource).toContain('providerConfigured')
    expect(workspaceSource).toContain('메일 발송이 설정되지 않았습니다')
    expect(testSendRouteSource).toContain('summary.provider.configured')
    expect(sendNowRouteSource).toContain('summary.provider.configured')
    expect(testSendRouteSource).toContain('status: 409')
    expect(sendNowRouteSource).toContain('status: 409')
  })

  it('declares dedicated reminder tables and idempotency storage (S-80~82)', () => {
    for (const token of [
      'internalReminderRule',
      'internalReminderRecipientOverride',
      'internalReminderSendLog',
      'internal_reminder_send_log_idempotency_uidx',
    ]) {
      expect(schemaSource).toContain(token)
    }
    expect(sendSource).toContain('buildInternalReminderIdempotencyKey')
  })
})
