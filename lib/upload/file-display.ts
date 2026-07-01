/**
 * 업로드 파일 상태 → 클라이언트 포털 표시(라벨/배지 스타일) 매핑.
 *
 * Slice 2: passwordStatus === 'required'인 파일은 "처리 실패"가 아니라 "확인 필요"로
 * 보여야 한다. Slice 3-C: invalid/consumed/submittable 상태도 구분한다.
 * 순수 함수로 분리해 단위 테스트 대상으로 둔다.
 */

export type UploadedFilePasswordStatus =
  | 'none'
  | 'required'
  | 'supplied'
  | 'invalid'
  | 'consumed'
  | 'not_needed'

export interface UploadedFileDisplay {
  label: string
  badgeClassName: string
  /** @deprecated Slice 3-C: isPasswordSubmittable 사용 */
  isPasswordRequired: boolean
  isPasswordSubmittable: boolean
  isPasswordInvalid: boolean
}

const FILE_STATUS_LABEL: Record<string, string> = {
  uploaded: '접수됨',
  analyzing: '확인 중',
  matched: '접수 완료',
  needs_review: '접수 완료',
  rejected: '확인 필요',
  failed: '처리 지연',
}

const FILE_STATUS_STYLE: Record<string, string> = {
  uploaded: 'bg-blue-100 text-blue-700',
  analyzing: 'bg-blue-100 text-blue-700',
  matched: 'bg-green-100 text-green-700',
  needs_review: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
}

const PASSWORD_REQUIRED_LABEL = '비밀번호 필요'
const PASSWORD_REQUIRED_STYLE = 'bg-amber-100 text-amber-800'
const PASSWORD_INVALID_LABEL = '비밀번호 오류'
const PASSWORD_INVALID_STYLE = 'bg-red-100 text-red-800'

export function isPasswordRequiredFile(passwordStatus: string | null | undefined): boolean {
  return passwordStatus === 'required'
}

/** Slice 3-C: 비밀번호 입력 UI를 보여줄 수 있는 상태 */
export function isPasswordSubmittable(passwordStatus: string | null | undefined): boolean {
  return passwordStatus === 'required' || passwordStatus === 'invalid'
}

export function isPasswordInvalidFile(passwordStatus: string | null | undefined): boolean {
  return passwordStatus === 'invalid'
}

export function resolveUploadedFileDisplay(file: {
  status: string
  passwordStatus?: string | null
}): UploadedFileDisplay {
  if (isPasswordInvalidFile(file.passwordStatus)) {
    return {
      label: PASSWORD_INVALID_LABEL,
      badgeClassName: PASSWORD_INVALID_STYLE,
      isPasswordRequired: false,
      isPasswordSubmittable: true,
      isPasswordInvalid: true,
    }
  }

  if (isPasswordRequiredFile(file.passwordStatus)) {
    return {
      label: PASSWORD_REQUIRED_LABEL,
      badgeClassName: PASSWORD_REQUIRED_STYLE,
      isPasswordRequired: true,
      isPasswordSubmittable: true,
      isPasswordInvalid: false,
    }
  }

  return {
    label: FILE_STATUS_LABEL[file.status] ?? '검토 대기',
    badgeClassName: FILE_STATUS_STYLE[file.status] ?? 'bg-gray-100 text-gray-500',
    isPasswordRequired: false,
    isPasswordSubmittable: false,
    isPasswordInvalid: false,
  }
}
