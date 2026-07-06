import iconv from 'iconv-lite'
import { SIMPLIFIED_WAGE_ENCODING } from './constants'

/** 사업자등록번호 등 — 하이픈 제거, 숫자만 */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** X(n): 좌측 정렬, 공백 패딩, EUC-KR 바이트 길이 기준 */
export function padX(value: string, byteWidth: number): Buffer {
  const encoded = iconv.encode(value, SIMPLIFIED_WAGE_ENCODING)
  if (encoded.length > byteWidth) {
    return encoded.subarray(0, byteWidth)
  }
  const out = Buffer.alloc(byteWidth, 0x20)
  encoded.copy(out, 0)
  return out
}

/** 9(n): 우측 정렬, 0 패딩 (ASCII 숫자) */
export function pad9(value: number | string, digitWidth: number): Buffer {
  const raw = typeof value === 'number' ? String(Math.trunc(value)) : digitsOnly(value)
  if (raw.length > digitWidth) {
    return Buffer.from(raw.slice(-digitWidth), 'ascii')
  }
  return Buffer.from(raw.padStart(digitWidth, '0'), 'ascii')
}

export function readPad9(buf: Buffer, start: number, length: number): number {
  const slice = buf.subarray(start, start + length).toString('ascii').trim()
  return slice === '' ? 0 : Number.parseInt(slice, 10)
}

export function readPadX(buf: Buffer, start: number, length: number): string {
  return iconv.decode(buf.subarray(start, start + length), SIMPLIFIED_WAGE_ENCODING).trimEnd()
}

export function buildFileName(businessRegistrationNumber: string): string {
  const digits = digitsOnly(businessRegistrationNumber)
  return `SC${digits.padStart(10, '0').slice(-10)}`
}
