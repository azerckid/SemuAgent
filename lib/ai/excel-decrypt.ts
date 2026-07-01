import * as officeCrypto from 'officecrypto-tool'
import * as XLSX from 'xlsx'

export type ExcelDecryptResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; reason: 'password_invalid' }

function toBuffer(buffer: ArrayBuffer | Uint8Array | Buffer): Buffer {
  if (Buffer.isBuffer(buffer)) return buffer
  if (buffer instanceof Uint8Array) return Buffer.from(buffer)
  return Buffer.from(new Uint8Array(buffer))
}

/**
 * 비밀번호로 보호된 Excel(open-password) 버퍼를 복호화한다.
 *
 * - 성공: 복호화된 평문 버퍼 반환. 메모리 전용이며, 폐기 책임은 호출측에 있다.
 * - 실패: `password_invalid` (오답 또는 복호화 불가).
 *
 * 보안: 비밀번호 값과 라이브러리 오류 원문은 이 함수 밖으로 반환·로깅하지 않는다.
 * (오류 메시지에 입력값이 섞여 나갈 가능성을 원천 차단)
 */
export async function tryDecryptExcel(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  password: string,
): Promise<ExcelDecryptResult> {
  const input = toBuffer(buffer)
  try {
    const decrypted = await officeCrypto.decrypt(input, { password })
    // 일부 케이스에서 오답이 throw 대신 깨진 버퍼로 반환될 수 있으므로,
    // 실제 파싱 가능한 워크북인지 가볍게 확인해 password_invalid를 확정한다.
    XLSX.read(decrypted, { type: 'buffer' })
    return { ok: true, buffer: decrypted }
  } catch {
    return { ok: false, reason: 'password_invalid' }
  }
}
