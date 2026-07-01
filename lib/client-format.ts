/**
 * 클라이언트 전용 표시 날짜 포맷 유틸리티.
 *
 * ⚠️  사용 제한:
 *  - UI 표시(날짜 라벨·타임스탬프)와 폼 기본값에만 사용한다.
 *  - 토큰 만료·회계 기간·DB 저장·이메일 발송 등 서버 비즈니스 로직에는
 *    반드시 lib/time.ts (Luxon)를 사용한다.
 *
 * 배경: Luxon을 'use client' 컴포넌트에서 직접 import 하면 ~70 KB가
 *      클라이언트 번들에 포함된다. 서버에서 내려온 ISO 문자열을 UI에
 *      표시하는 단순 포맷팅은 네이티브 Intl.DateTimeFormat 으로 대체한다.
 *      타임존은 KST(Asia/Seoul)로 고정한다.
 */

const KST = 'Asia/Seoul'

/** ISO 문자열 → Date 객체. 유효하지 않으면 null. */
function parseISO(iso: string): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

type Parts = Partial<Record<Intl.DateTimeFormatPartTypes, string>>

/** Intl.DateTimeFormat.formatToParts 결과를 Record로 변환. */
function getParts(
  d: Date,
  opts: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
  locale = 'ko-KR',
): Parts {
  return Object.fromEntries(
    new Intl.DateTimeFormat(locale, { timeZone: KST, ...opts })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
}

/** HH:mm 시간 파트 (24시간, 선행 0 포함). */
function getTimeParts(d: Date): Parts {
  // en-GB + hourCycle: 'h23' → 00-23 보장
  return getParts(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, 'en-GB')
}

// ─────────────────────────────────────────────────────────────────────────────
// ISO 문자열 → 표시용 포맷
// ─────────────────────────────────────────────────────────────────────────────

/**
 * '06.17' 형식
 * - Luxon `fromISO(value).toFormat('MM.dd')` 대체
 * - 파싱 실패 시 원본 문자열 반환 (기존 동작과 동일)
 */
export function formatMonthDay(iso: string): string {
  const d = parseISO(iso)
  if (!d) return iso
  const p = getParts(d, { month: '2-digit', day: '2-digit' })
  return `${p.month}.${p.day}`
}

/**
 * '2026-06-17' 형식
 * - Luxon `fromISO(value).toFormat('yyyy-MM-dd')` 대체
 */
export function formatDateISO(iso: string): string {
  const d = parseISO(iso)
  if (!d) return '-'
  const p = getParts(d, { year: 'numeric', month: '2-digit', day: '2-digit' })
  return `${p.year}-${p.month}-${p.day}`
}

/**
 * '06/17 14:30' 형식
 * - Luxon `fromISO(value).toFormat('MM/dd HH:mm')` 대체
 */
export function formatDateTimeSlash(iso: string): string {
  const d = parseISO(iso)
  if (!d) return '-'
  const date = getParts(d, { month: '2-digit', day: '2-digit' })
  const time = getTimeParts(d)
  return `${date.month}/${date.day} ${time.hour}:${time.minute}`
}

/**
 * '2026년 6월 17일' 형식 (월·일 선행 0 없음)
 * - Luxon `fromISO(value).toFormat('yyyy년 M월 d일')` 대체
 */
export function formatDateKorean(iso: string): string {
  const d = parseISO(iso)
  if (!d) return '-'
  const p = getParts(d, { year: 'numeric', month: 'numeric', day: 'numeric' })
  return `${p.year}년 ${p.month}월 ${p.day}일`
}

/**
 * '2026-06-17 14:30' 형식
 * - Luxon `fromISO(value).toFormat('yyyy-MM-dd HH:mm')` 대체
 */
export function formatDateTimeISO(iso: string): string {
  const d = parseISO(iso)
  if (!d) return '-'
  const date = getParts(d, { year: 'numeric', month: '2-digit', day: '2-digit' })
  const time = getTimeParts(d)
  return `${date.year}-${date.month}-${date.day} ${time.hour}:${time.minute}`
}

/**
 * '2026. 6. 17. 14:30' 형식 (월·일 선행 0 없음)
 * - Luxon `fromISO(value).toFormat('yyyy. M. d. HH:mm')` 대체
 */
export function formatDateTimeLong(iso: string): string {
  const d = parseISO(iso)
  if (!d) return '-'
  const date = getParts(d, { year: 'numeric', month: 'numeric', day: 'numeric' })
  const time = getTimeParts(d)
  return `${date.year}. ${date.month}. ${date.day}. ${time.hour}:${time.minute}`
}

// ─────────────────────────────────────────────────────────────────────────────
// 클라이언트 현재 시각 유틸리티 (폼 기본값·낙관적 UI 전용)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 현재 KST 연월 → '2026-06' (폼 기본값 전용)
 * - Luxon `now().toFormat('yyyy-MM')` 대체
 */
export function nowYearMonth(): string {
  const d = new Date()
  const p = getParts(d, { year: 'numeric', month: '2-digit' })
  return `${p.year}-${p.month}`
}

/**
 * 현재 KST { year, month } 숫자 (폼 기본값 전용)
 * - Luxon `now().year` / `now().month` 대체
 */
export function nowYearMonthComponents(): { year: number; month: number } {
  const d = new Date()
  const p = getParts(d, { year: 'numeric', month: 'numeric' })
  return { year: Number(p.year), month: Number(p.month) }
}

/**
 * 현재 시각 ISO 문자열 (낙관적 UI 타임스탬프 전용)
 * - Luxon `now().toISO()` 대체
 * - DB 저장용이 아닌 클라이언트 상태 표시 전용. 실제 DB 타임스탬프는 서버에서 생성.
 */
export function nowISOString(): string {
  return new Date().toISOString()
}
