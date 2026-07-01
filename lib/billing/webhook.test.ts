import { describe, expect, it } from 'vitest'
import {
  parseTossWebhookPayload,
  tossPaymentStatusWebhookSchema,
  tossWebhookIdempotencyKey,
  verifyTossWebhookEndpointSecret,
} from './webhook'

describe('parseTossWebhookPayload', () => {
  it('PAYMENT_STATUS_CHANGED payload를 Zod로 파싱한다', () => {
    const payload = parseTossWebhookPayload(JSON.stringify({
      eventType: 'PAYMENT_STATUS_CHANGED',
      createdAt: '2026-06-01T10:00:00.000000',
      data: {
        paymentKey: 'pay_123',
        orderId: 'jaryo-order-1',
        status: 'DONE',
        totalAmount: 99000,
      },
    }))

    const parsed = tossPaymentStatusWebhookSchema.parse(payload)
    expect(parsed.eventType).toBe('PAYMENT_STATUS_CHANGED')
    expect(parsed.data.paymentKey).toBe('pay_123')
  })

  it('BILLING_DELETED payload를 Zod로 파싱한다', () => {
    const payload = parseTossWebhookPayload(JSON.stringify({
      eventType: 'BILLING_DELETED',
      createdAt: '2026-06-01T10:00:00.000000',
      billingKey: 'billing-key-1',
      reason: 'customer_deleted',
    }))

    expect(payload.eventType).toBe('BILLING_DELETED')
    expect('billingKey' in payload && payload.billingKey).toBe('billing-key-1')
  })
})

describe('tossWebhookIdempotencyKey', () => {
  it('Toss transmission id를 idempotency key로 우선 사용한다', () => {
    const rawBody = JSON.stringify({
      eventType: 'BILLING_DELETED',
      billingKey: 'billing-key-1',
    })
    const payload = parseTossWebhookPayload(rawBody)
    const headers = new Headers({
      'tosspayments-webhook-transmission-id': 'transmission-123',
    })

    expect(tossWebhookIdempotencyKey({ rawBody, headers, payload })).toBe('toss:transmission-123')
  })

  it('transmission id가 없으면 body sha256으로 안정적인 key를 만든다', () => {
    const rawBody = JSON.stringify({
      eventType: 'BILLING_DELETED',
      billingKey: 'billing-key-1',
    })
    const payload = parseTossWebhookPayload(rawBody)
    const keyA = tossWebhookIdempotencyKey({ rawBody, headers: new Headers(), payload })
    const keyB = tossWebhookIdempotencyKey({ rawBody, headers: new Headers(), payload })

    expect(keyA).toBe(keyB)
    expect(keyA).toMatch(/^toss:sha256:[a-f0-9]{64}$/)
  })
})

describe('verifyTossWebhookEndpointSecret', () => {
  it('secret이 설정되면 query secret 일치를 요구한다', () => {
    expect(verifyTossWebhookEndpointSecret({
      requestUrl: 'https://example.com/api/billing/toss/webhook?secret=secret-token-1234',
      headers: new Headers(),
      expectedSecret: 'secret-token-1234',
    })).toBe(true)

    expect(verifyTossWebhookEndpointSecret({
      requestUrl: 'https://example.com/api/billing/toss/webhook?secret=wrong-token',
      headers: new Headers(),
      expectedSecret: 'secret-token-1234',
    })).toBe(false)
  })

  it('secret이 없으면 readiness 단계에서 endpoint 검증을 통과시킨다', () => {
    expect(verifyTossWebhookEndpointSecret({
      requestUrl: 'https://example.com/api/billing/toss/webhook',
      headers: new Headers(),
      expectedSecret: null,
    })).toBe(true)
  })
})
