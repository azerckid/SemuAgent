import {
  SIMPLIFIED_WAGE_DATA_KIND,
  SIMPLIFIED_WAGE_PROGRAM_CODE,
  SIMPLIFIED_WAGE_RECORD_LENGTH,
} from './constants'
import { buildFileName, digitsOnly, pad9, padX } from './format'
import type { BuildSimplifiedWageInput, BuildSimplifiedWageResult, SubmitterKind } from './types'
import {
  hasBlockingIssues,
  readyEmployeeSegments,
  validateBuiltRecords,
  validateInputBeforeBuild,
} from './validate'

function submitterKindCode(kind: SubmitterKind): number {
  return kind === 'corporation' ? 2 : 3
}

function buildARecord(
  input: BuildSimplifiedWageInput,
  obligorCount: number,
): Buffer {
  const parts = [
    padX('A', 1),
    pad9(SIMPLIFIED_WAGE_DATA_KIND, 2),
    padX(input.taxOfficeCode, 3),
    pad9(input.submittedOn, 8),
    pad9(submitterKindCode(input.submitterKind), 1),
    padX('', 6),
    padX(input.hometaxId ?? '', 20),
    padX(SIMPLIFIED_WAGE_PROGRAM_CODE, 4),
    padX(digitsOnly(input.businessRegistrationNumber), 10),
    padX(input.businessName, 30),
    padX(input.contactDepartment, 30),
    padX(input.contactName, 30),
    padX(input.contactPhone, 15),
    pad9(obligorCount, 5),
    padX('', 25),
  ]
  const buf = Buffer.concat(parts)
  if (buf.length !== SIMPLIFIED_WAGE_RECORD_LENGTH) {
    throw new Error(`A record byte length ${buf.length} !== ${SIMPLIFIED_WAGE_RECORD_LENGTH}`)
  }
  return buf
}

function buildBRecord(
  input: BuildSimplifiedWageInput,
  cRecords: Buffer[],
): Buffer {
  const sumC14 = cRecords.reduce((sum, c) => sum + Number.parseInt(c.subarray(106, 119).toString('ascii'), 10), 0)
  const sumC15 = cRecords.reduce((sum, c) => sum + Number.parseInt(c.subarray(119, 132).toString('ascii'), 10), 0)

  const parts = [
    padX('B', 1),
    pad9(SIMPLIFIED_WAGE_DATA_KIND, 2),
    padX(input.taxOfficeCode, 3),
    pad9(1, 6),
    padX(input.businessName, 40),
    padX(input.representativeName, 30),
    padX(digitsOnly(input.businessRegistrationNumber), 10),
    padX(digitsOnly(input.obligorRegistrationId), 13),
    pad9(input.year, 4),
    pad9(input.half, 1),
    pad9(cRecords.length, 10),
    pad9(sumC14, 13),
    pad9(sumC15, 13),
    padX('', 44),
  ]
  const buf = Buffer.concat(parts)
  if (buf.length !== SIMPLIFIED_WAGE_RECORD_LENGTH) {
    throw new Error(`B record byte length ${buf.length} !== ${SIMPLIFIED_WAGE_RECORD_LENGTH}`)
  }
  return buf
}

function buildCRecord(
  input: BuildSimplifiedWageInput,
  segment: (typeof input.employees)[number],
  sequence: number,
): Buffer {
  const nationality = segment.isForeignNational ? '9' : '1'
  const residency = '1'
  const countryCode = segment.isForeignNational ? 'US' : 'KR'

  const parts = [
    padX('C', 1),
    pad9(SIMPLIFIED_WAGE_DATA_KIND, 2),
    padX(input.taxOfficeCode, 3),
    pad9(sequence, 7),
    padX(digitsOnly(input.businessRegistrationNumber), 10),
    padX(digitsOnly(segment.residentId ?? ''), 13),
    padX(segment.employeeName, 30),
    padX(segment.phone ?? '', 20),
    padX(nationality, 1),
    padX(residency, 1),
    padX(countryCode, 2),
    padX(segment.workPeriodStart, 8),
    padX(segment.workPeriodEnd, 8),
    pad9(segment.grossPayKrw, 13),
    pad9(segment.recognizedBonusKrw, 13),
    padX('', 58),
  ]
  const buf = Buffer.concat(parts)
  if (buf.length !== SIMPLIFIED_WAGE_RECORD_LENGTH) {
    throw new Error(`C record byte length ${buf.length} !== ${SIMPLIFIED_WAGE_RECORD_LENGTH}`)
  }
  return buf
}

/** Plain A/B/C 레코드 생성 + V-01~V-11 사전검증 (DB·PII 영속화 없음) */
export function buildSimplifiedWageRecords(input: BuildSimplifiedWageInput): BuildSimplifiedWageResult {
  const inputIssues = validateInputBeforeBuild(input)
  if (hasBlockingIssues(inputIssues)) {
    return { ok: false, issues: inputIssues }
  }

  const segments = readyEmployeeSegments(input)
  const cRecords = segments.map((seg, idx) => buildCRecord(input, seg, idx + 1))
  const obligorCount = 1
  const bRecord = buildBRecord(input, cRecords)
  const aRecord = buildARecord(input, obligorCount)
  const records = [aRecord, bRecord, ...cRecords]

  const recordIssues = validateBuiltRecords(records)
  const issues = [...inputIssues, ...recordIssues]
  if (hasBlockingIssues(issues)) {
    return { ok: false, issues }
  }

  return {
    ok: true,
    fileName: buildFileName(input.businessRegistrationNumber),
    records,
  }
}

/** 레코드를 CRLF로 연결한 plain 파일 본문 (슬라이스 2a API용) */
export function serializeSimplifiedWageRecords(records: Buffer[]): Buffer {
  return Buffer.concat(records.flatMap((r, i) => (i < records.length - 1 ? [r, Buffer.from('\r\n', 'ascii')] : [r])))
}
