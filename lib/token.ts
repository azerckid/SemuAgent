import { randomBytes, createHash } from 'crypto'

// 토큰별 독립적인 256-bit 엔트로피 — 보안 모델: docs/03_Technical_Specs/01_MVP_TECHNICAL_BASELINE.md
export function generateRawToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}
