import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = 'libsql://test.local'
  process.env.TURSO_AUTH_TOKEN = 'test-token'
  process.env.BETTER_AUTH_SECRET = '12345678901234567890123456789012'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})
import type { VatReclassificationMutationInput } from '@/lib/validations/vat-reclassification'
import { buildReclassificationSavingsCandidate } from './reclassification-savings'
import { validateReclassificationConfirmation } from './reclassification-mutations'

const evaluation = {
  confidence: 'low' as const,
  suggestedCategory: null,
  factors: [{
    type: 'attendees_unknown' as const,
    direction: 'weakens' as const,
    summary: '참석자 정보가 없습니다.',
  }],
  missingToConfirm: ['참석자 명단', '적격증빙 확인 및 사용자 최종 확정'],
}

function candidate(overrides: {
  evidencePresent?: boolean
  userDecision?: 'pending' | 'reclassified' | 'kept_as_is'
} = {}) {
  return buildReclassificationSavingsCandidate({
    reviewRowId: 'review-1',
    description: '저녁 식대',
    counterparty: '식당',
    supplyAmountKrw: 100_000,
    inputTaxKrw: 10_000,
    evaluation,
    eligibleEvidence: {
      present: overrides.evidencePresent ?? true,
      label: overrides.evidencePresent === false ? '적격증빙 확인 필요' : '카드 내역',
    },
    userDecision: overrides.userDecision ?? 'pending',
    decisionRowId: overrides.userDecision && overrides.userDecision !== 'pending' ? 'review-1' : null,
  })
}

function reclassifyInput(
  fingerprint: string,
  overrides: Partial<Extract<VatReclassificationMutationInput, { action: 'reclassify' }>> = {},
): Extract<VatReclassificationMutationInput, { action: 'reclassify' }> {
  return {
    action: 'reclassify',
    periodKey: '2026-H1',
    expectedFingerprint: fingerprint,
    targetCategory: 'welfare_expense',
    businessContext: '개발팀 분기 회식',
    ...overrides,
  }
}

describe('VAI-9e confirmation gate', () => {
  it('allows a low-confidence candidate after business context and evidence are supplied', () => {
    const row = candidate()
    expect(validateReclassificationConfirmation({
      candidate: row,
      input: reclassifyInput(row.candidateFingerprint),
    })).toBeNull()
  })

  it('blocks reclassification without qualified evidence', () => {
    const row = candidate({ evidencePresent: false })
    expect(validateReclassificationConfirmation({
      candidate: row,
      input: reclassifyInput(row.candidateFingerprint),
    })).toContain('증빙')
  })

  it('blocks stale and already-decided candidates', () => {
    const pending = candidate()
    expect(validateReclassificationConfirmation({
      candidate: pending,
      input: reclassifyInput('a'.repeat(64)),
    })).toContain('변경')

    const decided = candidate({ userDecision: 'kept_as_is' })
    expect(validateReclassificationConfirmation({
      candidate: decided,
      input: {
        action: 'keep_as_is',
        periodKey: '2026-H1',
        expectedFingerprint: decided.candidateFingerprint,
      },
    })).toContain('이미 처리')
  })

  it('allows an explicit keep-as-is decision without inventing supporting evidence', () => {
    const row = candidate({ evidencePresent: false })
    expect(validateReclassificationConfirmation({
      candidate: row,
      input: {
        action: 'keep_as_is',
        periodKey: '2026-H1',
        expectedFingerprint: row.candidateFingerprint,
      },
    })).toBeNull()
  })
})
