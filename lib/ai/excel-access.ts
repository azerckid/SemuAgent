/**
 * Excel 파일 접근 분류 (Slice 1: 감지·상태 구분 전용)
 *
 * 이 모듈은 비밀번호가 걸린 Excel(open-password)을 "일반 파싱 실패"와 구분하기 위한
 * 감지·분류만 담당한다. 실제 복호화나 비밀번호 사용 분석은 이 단계의 범위가 아니다.
 * (참고: docs/04_Logic_Progress/48_PASSWORD_PROTECTED_UPLOAD_WORK_ORDER.md Slice 1)
 */

export type ExcelAccessFailureReason =
  | 'password_required'
  | 'parse_failed'
  | 'unsupported'

/** OLE2/CFB 복합 문서 시그니처. 암호화된 OOXML(.xlsx)과 구버전 .xls가 이 컨테이너를 사용한다. */
const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const

/** 일반(비암호화) .xlsx는 ZIP 컨테이너로 PK\x03\x04 시그니처를 가진다. */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const

function toUint8Array(buffer: ArrayBuffer | Uint8Array): Uint8Array {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
}

function hasSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) return false
  }
  return true
}

/** ASCII 문자열을 UTF-16LE 바이트 패턴으로 인코딩 (CFB 디렉터리 엔트리명 검색용). */
function encodeUtf16LeAscii(value: string): number[] {
  const bytes: number[] = []
  for (const char of value) {
    bytes.push(char.charCodeAt(0) & 0xff, 0x00)
  }
  return bytes
}

function includesByteSequence(haystack: Uint8Array, needle: readonly number[]): boolean {
  if (needle.length === 0) return false
  const lastStart = haystack.length - needle.length
  for (let start = 0; start <= lastStart; start += 1) {
    let matched = true
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        matched = false
        break
      }
    }
    if (matched) return true
  }
  return false
}

const ENCRYPTED_PACKAGE_MARKER = encodeUtf16LeAscii('EncryptedPackage')
const ENCRYPTION_INFO_MARKER = encodeUtf16LeAscii('EncryptionInfo')

/**
 * 버퍼가 "열기 비밀번호가 걸린 OOXML(.xlsx)"인지 시그니처 기반으로 판별한다.
 *
 * 암호화된 OOXML은 ZIP이 아니라 CFB 컨테이너 안에 `EncryptionInfo` / `EncryptedPackage`
 * 스트림을 담는다. 일반 .xlsx(ZIP)에는 이 마커가 없으므로 오탐 위험이 낮다.
 */
export function isPasswordProtectedExcel(buffer: ArrayBuffer | Uint8Array | null | undefined): boolean {
  if (!buffer) return false
  const bytes = toUint8Array(buffer)
  if (!hasSignature(bytes, CFB_SIGNATURE)) return false
  return (
    includesByteSequence(bytes, ENCRYPTED_PACKAGE_MARKER) ||
    includesByteSequence(bytes, ENCRYPTION_INFO_MARKER)
  )
}

const PASSWORD_ERROR_PATTERNS = [
  /password/i,
  /encrypted/i,
  /encryption/i,
  /비밀번호/,
  /암호/,
]

/**
 * XLSX.read 등에서 던진 오류 메시지가 비밀번호/암호화 때문인지 분류한다.
 * 시그니처 감지로 잡지 못한 경우의 보조 신호로 사용한다.
 */
export function isPasswordRelatedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return PASSWORD_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

/**
 * Excel 읽기 실패를 비밀번호 필요 / 일반 파싱 실패로 분류한다.
 * 버퍼 시그니처를 우선 신뢰하고, 없으면 오류 메시지로 보조 판단한다.
 */
export function classifyExcelReadFailure(params: {
  buffer: ArrayBuffer | Uint8Array | null | undefined
  error: unknown
}): ExcelAccessFailureReason {
  if (isPasswordProtectedExcel(params.buffer)) return 'password_required'
  if (isPasswordRelatedError(params.error)) return 'password_required'
  return 'parse_failed'
}

const FAILURE_MESSAGE: Record<ExcelAccessFailureReason, string> = {
  password_required: '비밀번호가 필요한 Excel 파일로 보입니다. 파일을 열기 위한 비밀번호가 필요합니다.',
  parse_failed: 'Excel 파일을 읽지 못했습니다. 파일이 손상되었거나 형식이 올바르지 않을 수 있습니다.',
  unsupported: '지원하지 않는 파일 형식입니다.',
}

export function describeExcelAccessFailure(reason: ExcelAccessFailureReason): string {
  return FAILURE_MESSAGE[reason]
}
