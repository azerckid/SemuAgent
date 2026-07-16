import { timingSafeEqual } from 'node:crypto'

/**
 * 시크릿·토큰 비교를 상수 시간으로 수행한다.
 *
 * 일반 문자열 `===`는 첫 불일치 바이트에서 즉시 반환하므로 비교 시간이
 * 입력에 따라 달라져 타이밍 사이드채널이 생긴다. bearer 토큰·공유 시크릿처럼
 * 공격자가 값을 추측하며 반복 요청할 수 있는 경로에서는 상수 시간 비교를 쓴다.
 *
 * 길이가 다르면 즉시 false를 반환한다(길이는 비밀이 아니며, timingSafeEqual은
 * 길이가 다른 버퍼에 대해 예외를 던지기 때문). 값 자체의 비교만 상수 시간이다.
 * nullish 입력은 false로 처리해 호출부의 fail-closed 가드를 방해하지 않는다.
 */
export function safeSecretEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  if (aBuffer.length !== bBuffer.length) return false
  return timingSafeEqual(aBuffer, bBuffer)
}
