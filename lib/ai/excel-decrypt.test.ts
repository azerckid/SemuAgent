import { describe, it, expect } from 'vitest'
import * as officeCrypto from 'officecrypto-tool'
import * as XLSX from 'xlsx'
import { tryDecryptExcel } from './excel-decrypt'

const PASSWORD = 'S3cret!_2026'

function buildPlainXlsx(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    ['항목', '금액'],
    ['기본급', 3000000],
    ['식대', 200000],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '급여대장')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

describe('tryDecryptExcel', () => {
  it('올바른 비밀번호로 복호화에 성공하고 워크북을 다시 파싱할 수 있다', async () => {
    const encrypted = await officeCrypto.encrypt(buildPlainXlsx(), { password: PASSWORD })
    const result = await tryDecryptExcel(encrypted, PASSWORD)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const wb = XLSX.read(result.buffer, { type: 'buffer' })
      expect(wb.SheetNames).toContain('급여대장')
    }
  })

  it('틀린 비밀번호는 password_invalid를 반환한다', async () => {
    const encrypted = await officeCrypto.encrypt(buildPlainXlsx(), { password: PASSWORD })
    const result = await tryDecryptExcel(encrypted, 'definitely-wrong')

    expect(result).toEqual({ ok: false, reason: 'password_invalid' })
  })

  it('암호화되지 않았거나 손상된 버퍼는 password_invalid를 반환한다', async () => {
    const result = await tryDecryptExcel(Buffer.from('not an office document'), 'whatever')

    expect(result.ok).toBe(false)
  })

  it('성공 결과에 비밀번호 값이 포함되지 않는다', async () => {
    const encrypted = await officeCrypto.encrypt(buildPlainXlsx(), { password: PASSWORD })
    const result = await tryDecryptExcel(encrypted, PASSWORD)

    expect(JSON.stringify(Object.keys(result))).not.toContain('password')
  })
})
