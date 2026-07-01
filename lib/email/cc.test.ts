import { describe, it, expect } from 'vitest'
import { invalidCcEmails, normalizeCcEmails, ccEmailsForSend } from '@/lib/email/cc'

describe('invalidCcEmails', () => {
  it('빈 값/공백/null/undefined는 빈 배열을 반환한다', () => {
    expect(invalidCcEmails(undefined)).toEqual([])
    expect(invalidCcEmails(null)).toEqual([])
    expect(invalidCcEmails('')).toEqual([])
    expect(invalidCcEmails('   ')).toEqual([])
    expect(invalidCcEmails(',,, ;\n')).toEqual([])
  })

  it('모두 올바른 형식이면 빈 배열을 반환한다', () => {
    expect(invalidCcEmails('a@example.com, b@example.com')).toEqual([])
  })

  it('잘못된 형식만 골라낸다 (소문자 정규화 후)', () => {
    expect(invalidCcEmails('ok@example.com, NOT-AN-EMAIL, also@example.com')).toEqual(['not-an-email'])
  })

  it('세미콜론과 개행 구분자도 인식한다', () => {
    expect(invalidCcEmails('ok@example.com;\nbroken@@')).toEqual(['broken@@'])
  })
})

describe('normalizeCcEmails', () => {
  it('빈 값/공백/null/undefined는 null을 반환한다', () => {
    expect(normalizeCcEmails(undefined)).toBeNull()
    expect(normalizeCcEmails(null)).toBeNull()
    expect(normalizeCcEmails('')).toBeNull()
    expect(normalizeCcEmails('   ')).toBeNull()
    expect(normalizeCcEmails(',,, ;\n')).toBeNull()
  })

  it('정규화된 결과는 소문자, trim, ", " 조인 형태이다', () => {
    expect(normalizeCcEmails('  Foo@Example.com ,  bar@example.com  ')).toBe('foo@example.com, bar@example.com')
  })

  it('대소문자만 다른 중복은 한 번만 남긴다', () => {
    expect(normalizeCcEmails('foo@example.com, FOO@example.com, foo@EXAMPLE.com')).toBe('foo@example.com')
  })

  it('동일한 문자열 중복도 한 번만 남긴다', () => {
    expect(normalizeCcEmails('foo@example.com, foo@example.com')).toBe('foo@example.com')
  })

  it('빈 토큰은 무시하고 유효한 이메일만 정규화한다', () => {
    expect(normalizeCcEmails('a@example.com,,c@example.com')).toBe('a@example.com, c@example.com')
  })

  it('세미콜론과 개행 구분자를 쉼표+공백으로 통일한다', () => {
    expect(normalizeCcEmails('a@example.com;b@example.com\nc@example.com')).toBe(
      'a@example.com, b@example.com, c@example.com',
    )
  })

  it('잘못된 이메일이 섞이면 throw하고 메시지에 잘못된 값을 포함한다', () => {
    expect(() => normalizeCcEmails('ok@example.com, not-an-email')).toThrowError(
      /유효하지 않은 참조 이메일: not-an-email/,
    )
  })

  it('잘못된 이메일이 여러 개면 모두 메시지에 포함된다', () => {
    expect(() => normalizeCcEmails('bad1, ok@example.com, bad2@@')).toThrowError(
      /유효하지 않은 참조 이메일: bad1, bad2@@/,
    )
  })

  it('정규화 결과는 idempotent하다', () => {
    const once = normalizeCcEmails('  A@b.com ; a@b.com ')
    const twice = normalizeCcEmails(once)
    expect(once).toBe('a@b.com')
    expect(twice).toBe('a@b.com')
  })
})

describe('ccEmailsForSend', () => {
  it('빈 값은 undefined를 반환한다 (Resend cc 옵션 생략 목적)', () => {
    expect(ccEmailsForSend(undefined)).toBeUndefined()
    expect(ccEmailsForSend(null)).toBeUndefined()
    expect(ccEmailsForSend('')).toBeUndefined()
    expect(ccEmailsForSend('   ')).toBeUndefined()
  })

  it('유효한 입력은 정규화된 문자열 배열을 반환한다', () => {
    expect(ccEmailsForSend(' Foo@Example.com , bar@example.com ')).toEqual([
      'foo@example.com',
      'bar@example.com',
    ])
  })

  it('중복 제거된 단일 주소는 길이 1 배열이다', () => {
    expect(ccEmailsForSend('a@b.com, A@B.com')).toEqual(['a@b.com'])
  })

  it('잘못된 이메일이 섞이면 throw한다', () => {
    expect(() => ccEmailsForSend('ok@example.com, broken')).toThrow()
  })
})
