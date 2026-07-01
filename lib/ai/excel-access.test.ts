import { describe, expect, it } from 'vitest'
import {
  classifyExcelReadFailure,
  describeExcelAccessFailure,
  isPasswordProtectedExcel,
  isPasswordRelatedError,
} from './excel-access'

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]

function utf16LeAscii(value: string): number[] {
  const bytes: number[] = []
  for (const char of value) {
    bytes.push(char.charCodeAt(0) & 0xff, 0x00)
  }
  return bytes
}

/** 암호화 OOXML을 흉내 낸 최소 버퍼: CFB 시그니처 + UTF-16LE 스트림명 마커. */
function encryptedExcelLikeBuffer(marker = 'EncryptedPackage'): Uint8Array {
  return new Uint8Array([
    ...CFB_SIGNATURE,
    ...new Array(40).fill(0x00),
    ...utf16LeAscii(marker),
    ...new Array(16).fill(0x00),
  ])
}

/** 일반 .xlsx(ZIP)를 흉내 낸 버퍼. */
function normalExcelLikeBuffer(): Uint8Array {
  return new Uint8Array([
    ...ZIP_SIGNATURE,
    ...utf16LeAscii('xl/workbook.xml'),
    ...new Array(32).fill(0x11),
  ])
}

describe('isPasswordProtectedExcel', () => {
  it('detects an encrypted OOXML container (EncryptedPackage stream)', () => {
    expect(isPasswordProtectedExcel(encryptedExcelLikeBuffer('EncryptedPackage'))).toBe(true)
  })

  it('detects an encrypted OOXML container (EncryptionInfo stream)', () => {
    expect(isPasswordProtectedExcel(encryptedExcelLikeBuffer('EncryptionInfo'))).toBe(true)
  })

  it('does not flag a normal ZIP-based .xlsx as password protected', () => {
    expect(isPasswordProtectedExcel(normalExcelLikeBuffer())).toBe(false)
  })

  it('does not flag a CFB container without encryption markers (e.g. legacy .xls)', () => {
    const legacyXls = new Uint8Array([...CFB_SIGNATURE, ...new Array(64).fill(0x00)])
    expect(isPasswordProtectedExcel(legacyXls)).toBe(false)
  })

  it('returns false for empty or missing buffers', () => {
    expect(isPasswordProtectedExcel(null)).toBe(false)
    expect(isPasswordProtectedExcel(undefined)).toBe(false)
    expect(isPasswordProtectedExcel(new Uint8Array([]))).toBe(false)
  })
})

describe('isPasswordRelatedError', () => {
  it('recognizes password/encryption error messages', () => {
    expect(isPasswordRelatedError(new Error('File is password-protected'))).toBe(true)
    expect(isPasswordRelatedError(new Error('Encrypted workbook not supported'))).toBe(true)
    expect(isPasswordRelatedError('암호가 걸려 있습니다')).toBe(true)
  })

  it('does not treat generic parse errors as password related', () => {
    expect(isPasswordRelatedError(new Error('Bad zip file'))).toBe(false)
    expect(isPasswordRelatedError(new Error('Unsupported file format'))).toBe(false)
  })
})

describe('classifyExcelReadFailure', () => {
  it('classifies encrypted buffers as password_required regardless of error', () => {
    expect(
      classifyExcelReadFailure({
        buffer: encryptedExcelLikeBuffer(),
        error: new Error('some opaque parser error'),
      }),
    ).toBe('password_required')
  })

  it('classifies password-related errors as password_required', () => {
    expect(
      classifyExcelReadFailure({
        buffer: normalExcelLikeBuffer(),
        error: new Error('password required to open'),
      }),
    ).toBe('password_required')
  })

  it('classifies generic failures as parse_failed', () => {
    expect(
      classifyExcelReadFailure({
        buffer: normalExcelLikeBuffer(),
        error: new Error('Corrupted central directory'),
      }),
    ).toBe('parse_failed')
  })
})

describe('describeExcelAccessFailure', () => {
  it('returns distinct Korean messages per reason', () => {
    expect(describeExcelAccessFailure('password_required')).toContain('비밀번호')
    expect(describeExcelAccessFailure('parse_failed')).toContain('손상')
    expect(describeExcelAccessFailure('unsupported')).toContain('지원')
  })
})
