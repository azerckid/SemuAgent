import { describe, expect, it } from 'vitest'
import {
  isPasswordInvalidFile,
  isPasswordRequiredFile,
  isPasswordSubmittable,
  resolveUploadedFileDisplay,
} from './file-display'

describe('isPasswordRequiredFile', () => {
  it('returns true only for required', () => {
    expect(isPasswordRequiredFile('required')).toBe(true)
    expect(isPasswordRequiredFile('invalid')).toBe(false)
    expect(isPasswordRequiredFile('none')).toBe(false)
    expect(isPasswordRequiredFile(undefined)).toBe(false)
    expect(isPasswordRequiredFile(null)).toBe(false)
  })
})

describe('isPasswordSubmittable', () => {
  it('required와 invalid에서만 true', () => {
    expect(isPasswordSubmittable('required')).toBe(true)
    expect(isPasswordSubmittable('invalid')).toBe(true)
    expect(isPasswordSubmittable('consumed')).toBe(false)
    expect(isPasswordSubmittable('none')).toBe(false)
  })
})

describe('isPasswordInvalidFile', () => {
  it('invalid에서만 true', () => {
    expect(isPasswordInvalidFile('invalid')).toBe(true)
    expect(isPasswordInvalidFile('required')).toBe(false)
  })
})

describe('resolveUploadedFileDisplay', () => {
  it('password_required는 status보다 우선해 "비밀번호 필요"로 표시한다', () => {
    const display = resolveUploadedFileDisplay({ status: 'needs_review', passwordStatus: 'required' })
    expect(display.label).toBe('비밀번호 필요')
    expect(display.isPasswordRequired).toBe(true)
    expect(display.isPasswordSubmittable).toBe(true)
    expect(display.isPasswordInvalid).toBe(false)
    expect(display.badgeClassName).toContain('amber')
  })

  it('password_invalid는 "비밀번호 오류"로 표시하고 입력 가능 상태다', () => {
    const display = resolveUploadedFileDisplay({ status: 'needs_review', passwordStatus: 'invalid' })
    expect(display.label).toBe('비밀번호 오류')
    expect(display.isPasswordSubmittable).toBe(true)
    expect(display.isPasswordInvalid).toBe(true)
    expect(display.badgeClassName).toContain('red')
  })

  it('password_required는 status가 failed여도 "처리 실패"가 아니라 "비밀번호 필요"로 보인다', () => {
    const display = resolveUploadedFileDisplay({ status: 'failed', passwordStatus: 'required' })
    expect(display.label).toBe('비밀번호 필요')
    expect(display.isPasswordRequired).toBe(true)
  })

  it('consumed는 일반 status 라벨로 복귀한다', () => {
    const display = resolveUploadedFileDisplay({ status: 'analyzing', passwordStatus: 'consumed' })
    expect(display.label).toBe('확인 중')
    expect(display.isPasswordSubmittable).toBe(false)
  })

  it('일반 파일은 기존 status 라벨을 유지한다', () => {
    expect(resolveUploadedFileDisplay({ status: 'matched' }).label).toBe('접수 완료')
    expect(resolveUploadedFileDisplay({ status: 'matched' }).isPasswordRequired).toBe(false)
    expect(resolveUploadedFileDisplay({ status: 'analyzing', passwordStatus: 'none' }).label).toBe('확인 중')
    expect(resolveUploadedFileDisplay({ status: 'uploaded' }).label).toBe('접수됨')
  })

  it('알 수 없는 status는 기본 라벨로 폴백한다', () => {
    const display = resolveUploadedFileDisplay({ status: 'something_else' })
    expect(display.label).toBe('검토 대기')
    expect(display.isPasswordRequired).toBe(false)
  })
})
