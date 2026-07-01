import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as officeCrypto from 'officecrypto-tool'
import * as XLSX from 'xlsx'
import {
  client,
  clientChecklist,
  uploadFile,
  uploadSession,
} from '@/lib/db/schema'

const inspectSpy = vi.hoisted(() => vi.fn())

vi.mock('@/lib/bookkeeping/transaction-extraction', () => ({
  inspectBookkeepingFileForTransactions: (...args: unknown[]) => inspectSpy(...args),
}))

vi.mock('@/lib/env', () => ({
  requireAiEnv: () => ({
    ANALYSIS_CONFIDENCE_THRESHOLD: 0.7,
    GEMINI_ANALYSIS_MODEL: 'gemini-test',
  }),
  isGeminiEnabled: () => false,
}))

const analyzeWithOpenAISpy = vi.fn()
const analyzeWithClaudeSpy = vi.fn()
const analyzeWithGeminiSpy = vi.fn()

vi.mock('./openai', () => ({
  analyzeWithOpenAI: (...args: unknown[]) => analyzeWithOpenAISpy(...args),
}))
vi.mock('./claude', () => ({
  analyzeWithClaude: (...args: unknown[]) => analyzeWithClaudeSpy(...args),
}))
vi.mock('./gemini', () => ({
  analyzeWithGemini: (...args: unknown[]) => analyzeWithGeminiSpy(...args),
}))

const dbUpdates: Array<Record<string, unknown>> = []
let trackedFileStatus = 'uploaded'
let uploadFileSelectCount = 0

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === uploadFile) {
          return {
            where: () => ({
              limit: async () => {
                uploadFileSelectCount += 1
                if (uploadFileSelectCount === 1) {
                  return [mockUploadFileRow]
                }
                return [{ status: trackedFileStatus }]
              },
            }),
          }
        }

        if (table === uploadSession) {
          return {
            innerJoin: () => ({
              where: () => ({
                limit: async () => [{ session: mockSessionRow, clientRecord: mockClientRow }],
              }),
            }),
          }
        }

        if (table === clientChecklist) {
          return {
            innerJoin: () => ({
              innerJoin: () => ({
                where: async () => [],
              }),
            }),
          }
        }

        throw new Error(`Unexpected select.from table: ${String(table)}`)
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        dbUpdates.push(values)
        if (typeof values.status === 'string') {
          trackedFileStatus = values.status
        }
        return { where: async () => undefined }
      }),
    })),
    insert: vi.fn(() => ({
      values: async () => undefined,
    })),
  },
}))

const mockUploadFileRow = {
  id: 'file-password-1',
  tenantId: 'tenant-1',
  uploadSessionId: 'session-1',
  storageKey: 'https://example.blob.vercel-storage.com/encrypted.xlsx',
  fileType: 'excel' as const,
  originalFilename: 'SampleA_PayList_19FY_2604.xlsx',
  status: 'uploaded' as const,
  passwordStatus: 'none' as const,
  contentHash: 'hash',
  fileSize: 45000,
  uploadedAt: '2026-06-13T00:00:00.000+09:00',
}

const mockSessionRow = {
  id: 'session-1',
  tenantId: 'tenant-1',
  clientId: 'client-1',
  accountingPeriod: '2026-01',
  status: 'submitted',
  analysisNotes: null,
  extractedCriteria: null,
  additionalCriteria: null,
}

const mockClientRow = {
  id: 'client-1',
  tenantId: 'tenant-1',
  analysisNotes: null,
}

async function buildEncryptedExcelBuffer(): Promise<ArrayBuffer> {
  const ws = XLSX.utils.aoa_to_sheet([
    ['날짜', '거래처', '금액'],
    ['2026-01-01', 'A사', 1000],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const plain = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const encrypted = await officeCrypto.encrypt(plain, { password: 'test123' })
  return encrypted.buffer.slice(
    encrypted.byteOffset,
    encrypted.byteOffset + encrypted.byteLength,
  ) as ArrayBuffer
}

const { analyzeFile } = await import('./analyze')

describe('analyzeFile password-protected Excel ordering', () => {
  beforeEach(() => {
    inspectSpy.mockClear()
    analyzeWithOpenAISpy.mockClear()
    analyzeWithClaudeSpy.mockClear()
    analyzeWithGeminiSpy.mockClear()
    dbUpdates.length = 0
    uploadFileSelectCount = 0
    trackedFileStatus = 'uploaded'
    inspectSpy.mockImplementation(() => {
      throw new Error('inspectBookkeepingFileForTransactions must not run for password_required files')
    })
  })

  it('암호화 Excel은 failed가 아니라 needs_review + passwordStatus=required로 종료한다', async () => {
    const encryptedBuffer = await buildEncryptedExcelBuffer()

    await analyzeFile('file-password-1', 'tenant-1', { overrideBuffer: encryptedBuffer })

    expect(inspectSpy).not.toHaveBeenCalled()
    expect(analyzeWithOpenAISpy).not.toHaveBeenCalled()
    expect(analyzeWithClaudeSpy).not.toHaveBeenCalled()
    expect(analyzeWithGeminiSpy).not.toHaveBeenCalled()

    expect(dbUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'analyzing' }),
        expect.objectContaining({ status: 'needs_review', passwordStatus: 'required' }),
      ]),
    )
    expect(dbUpdates.some((update) => update.status === 'failed')).toBe(false)
  })
})

describe('password pipeline precondition', () => {
  it('bookkeeping 검사는 암호화 Excel에서 throw하지만 extract는 password_required를 먼저 반환한다', async () => {
    const encryptedBuffer = await buildEncryptedExcelBuffer()
    const file = {
      id: 'file-password-precondition',
      fileType: 'excel' as const,
      originalFilename: 'SampleA_PayList.xlsx',
    }

    const { extractDocumentText } = await import('./extract')
    const { inspectBookkeepingFileForTransactions: realInspect } = await vi.importActual<
      typeof import('@/lib/bookkeeping/transaction-extraction')
    >('@/lib/bookkeeping/transaction-extraction')

    const extraction = await extractDocumentText({
      fileBuffer: encryptedBuffer,
      fileType: 'excel',
      originalFilename: file.originalFilename,
    })

    expect(extraction.failureReason).toBe('password_required')
    expect(() => realInspect({ file, buffer: encryptedBuffer })).toThrow(/password-protected/i)
  })
})
