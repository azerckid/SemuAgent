/**
 * Giwa Chain proof worker.
 *
 * 온체인에는 해시와 타임스탬프만 기록한다. 파일명·테넌트 ID·세션 ID 원문은 절대 전달하지 않는다.
 * proof 실패는 non-fatal — 호출부에서 catch해야 하며, 업로드/분석/완료 흐름을 막으면 안 된다.
 *
 * 이 모듈은 upload/route.ts에서 동적 import로만 로드해야 한다.
 * 정적 import 시 viem/eth 초기화가 업로드 토큰 발급 경로를 깰 수 있다.
 */

import { createHash, randomUUID } from 'crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { db } from '@/lib/db'
import { auditProof, checklistItem, materialMatch, uploadFile } from '@/lib/db/schema'
import { getChainEnvOrNull } from '@/lib/env'
import { now, toDBString } from '@/lib/time'

// ---------------------------------------------------------------------------
// Giwa Sepolia 체인 정의
// ---------------------------------------------------------------------------

const GIWA_SEPOLIA_CHAIN_ID = 91342
const GIWA_CHAIN = 'giwa-sepolia'
const GIWA_EXPLORER = 'https://sepolia-explorer.giwa.io'

// ---------------------------------------------------------------------------
// 해시 헬퍼
// ---------------------------------------------------------------------------

/** sha256(id + salt) → bytes32 hex */
function buildSaltedHash(id: string, salt: string): `0x${string}` {
  const hex = createHash('sha256').update(id + salt).digest('hex')
  return `0x${hex}` as `0x${string}`
}

/** SHA-256 of arbitrary string → bytes32 hex */
function sha256Hex(input: string): `0x${string}` {
  const hex = createHash('sha256').update(input).digest('hex')
  return `0x${hex}` as `0x${string}`
}

/**
 * checklist_item 충족 결과를 정렬 JSON으로 만들어 해시한다.
 * 체크리스트 미배정 세션은 sha256('[]') — zero hash가 아니므로 컨트랙트에 안전하다.
 */
async function buildChecklistSummaryHash(
  sessionId: string,
  tenantId: string,
): Promise<`0x${string}`> {
  const files = await db
    .select({ id: uploadFile.id })
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, sessionId), eq(uploadFile.tenantId, tenantId)))

  if (files.length === 0) return sha256Hex('[]')

  const matches = await db
    .select({
      itemId: materialMatch.checklistItemId,
      itemName: checklistItem.name,
      status: materialMatch.status,
    })
    .from(materialMatch)
    .innerJoin(checklistItem, eq(materialMatch.checklistItemId, checklistItem.id))
    .where(
      and(
        inArray(materialMatch.uploadFileId, files.map((f) => f.id)),
        eq(materialMatch.tenantId, tenantId),
      ),
    )

  if (matches.length === 0) return sha256Hex('[]')

  const sorted = matches
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
    .map((m) => ({ itemId: m.itemId, status: m.status }))

  return sha256Hex(JSON.stringify(sorted))
}

// ---------------------------------------------------------------------------
// viem 클라이언트 팩토리
// ---------------------------------------------------------------------------

function makeClients(rpcUrl: string, privateKey: `0x${string}`) {
  const chain = {
    id: GIWA_SEPOLIA_CHAIN_ID,
    name: 'Giwa Sepolia',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] as [string] } },
  } as const

  const account = privateKeyToAccount(privateKey)

  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })

  return { wallet, publicClient, account }
}

// ---------------------------------------------------------------------------
// 컨트랙트 ABI
// ---------------------------------------------------------------------------

const REGISTRY_ABI = [
  {
    name: 'recordFileReceived',
    type: 'function',
    inputs: [
      { name: 'tenantHash', type: 'bytes32' },
      { name: 'sessionHash', type: 'bytes32' },
      { name: 'fileHash', type: 'bytes32' },
      { name: 'receivedAt', type: 'uint64' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'recordSessionCompleted',
    type: 'function',
    inputs: [
      { name: 'tenantHash', type: 'bytes32' },
      { name: 'sessionHash', type: 'bytes32' },
      { name: 'checklistSummaryHash', type: 'bytes32' },
      { name: 'completedAt', type: 'uint64' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

// ---------------------------------------------------------------------------
// 공통: pending 레코드 저장 → tx 전송 → submitted 업데이트
// ---------------------------------------------------------------------------

async function sendAndRecord({
  proofId,
  tenantId,
  uploadFileId,
  uploadSessionId,
  proofType,
  txArgs,
  payloadHash,
  contractAddress,
  rpcUrl,
  privateKey,
}: {
  proofId: string
  tenantId: string
  uploadFileId?: string
  uploadSessionId?: string
  proofType: 'file_received' | 'session_completed'
  txArgs: readonly [`0x${string}`, `0x${string}`, `0x${string}`, bigint]
  payloadHash: `0x${string}`
  contractAddress: `0x${string}`
  rpcUrl: string
  privateKey: `0x${string}`
}): Promise<void> {
  const ts = toDBString(now())

  // pending 레코드 먼저 저장
  await db.insert(auditProof).values({
    id: proofId,
    tenantId,
    uploadFileId: uploadFileId ?? null,
    uploadSessionId: uploadSessionId ?? null,
    proofType,
    status: 'pending',
    chain: GIWA_CHAIN,
    chainId: GIWA_SEPOLIA_CHAIN_ID,
    contractAddress,
    payloadHash,
    createdAt: ts,
  })

  const { wallet, publicClient } = makeClients(rpcUrl, privateKey)
  let txHash: `0x${string}`

  try {
    if (proofType === 'file_received') {
      txHash = await wallet.writeContract({
        address: contractAddress,
        abi: REGISTRY_ABI,
        functionName: 'recordFileReceived',
        args: txArgs,
      })
    } else {
      txHash = await wallet.writeContract({
        address: contractAddress,
        abi: REGISTRY_ABI,
        functionName: 'recordSessionCompleted',
        args: txArgs,
      })
    }
  } catch (err) {
    await db
      .update(auditProof)
      .set({ status: 'failed', errorMessage: String(err) })
      .where(eq(auditProof.id, proofId))
    throw err
  }

  const explorerUrl = `${GIWA_EXPLORER}/tx/${txHash}`

  // submitted 업데이트
  await db
    .update(auditProof)
    .set({ status: 'submitted', txHash, explorerUrl })
    .where(eq(auditProof.id, proofId))

  // tx receipt 짧게 대기 (10s). 타임아웃이면 submitted 유지 — Cron에서 confirmed 전환
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 10_000 })
    if (receipt.status === 'success') {
      await db
        .update(auditProof)
        .set({ status: 'confirmed', confirmedAt: toDBString(now()) })
        .where(eq(auditProof.id, proofId))
    } else {
      await db
        .update(auditProof)
        .set({ status: 'failed', errorMessage: 'receipt.status = reverted' })
        .where(eq(auditProof.id, proofId))
    }
  } catch {
    // 타임아웃 또는 네트워크 오류 — submitted 유지
  }
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

export interface FileReceivedProofParams {
  uploadFileId: string
  uploadSessionId: string
  tenantId: string
  /** upload_file.content_hash (SHA-256 hex, without 0x) */
  contentHash: string
  /** Unix timestamp (seconds) */
  receivedAt: number
}

/**
 * 파일 수신 proof 전송.
 * env 미설정 또는 이미 submitted/confirmed 레코드가 있으면 skip.
 */
export async function submitFileReceivedProof(params: FileReceivedProofParams): Promise<void> {
  const chainEnv = getChainEnvOrNull()
  if (!chainEnv) {
    console.info('[proof] Giwa Chain env 미설정 — file proof 건너뜀')
    return
  }

  const { uploadFileId, uploadSessionId, tenantId, contentHash, receivedAt } = params

  // 중복 방지: submitted/confirmed 레코드 존재 시 skip
  const existing = await db
    .select({ id: auditProof.id })
    .from(auditProof)
    .where(
      and(
        eq(auditProof.uploadFileId, uploadFileId),
        eq(auditProof.tenantId, tenantId),
        eq(auditProof.proofType, 'file_received'),
        inArray(auditProof.status, ['submitted', 'confirmed']),
      ),
    )
    .limit(1)

  if (existing[0]) return

  const salt = chainEnv.GIWA_SERVER_SALT
  const tenantHash = buildSaltedHash(tenantId, salt)
  const sessionHash = buildSaltedHash(uploadSessionId, salt)
  const fileHash = `0x${contentHash}` as `0x${string}`

  await sendAndRecord({
    proofId: randomUUID(),
    tenantId,
    uploadFileId,
    uploadSessionId,
    proofType: 'file_received',
    txArgs: [tenantHash, sessionHash, fileHash, BigInt(receivedAt)],
    payloadHash: fileHash,
    contractAddress: chainEnv.GIWA_CONTRACT_ADDRESS as `0x${string}`,
    rpcUrl: chainEnv.GIWA_CHAIN_RPC_URL,
    privateKey: chainEnv.GIWA_CHAIN_PRIVATE_KEY as `0x${string}`,
  })
}

export interface SessionCompletedProofParams {
  uploadSessionId: string
  tenantId: string
  /** Unix timestamp (seconds) */
  completedAt: number
}

/**
 * 세션 완료 proof 전송.
 * env 미설정 또는 이미 submitted/confirmed 레코드가 있으면 skip.
 */
export async function submitSessionCompletedProof(
  params: SessionCompletedProofParams,
): Promise<void> {
  const chainEnv = getChainEnvOrNull()
  if (!chainEnv) {
    console.info('[proof] Giwa Chain env 미설정 — session proof 건너뜀')
    return
  }

  const { uploadSessionId, tenantId, completedAt } = params

  // 중복 방지
  const existing = await db
    .select({ id: auditProof.id })
    .from(auditProof)
    .where(
      and(
        eq(auditProof.uploadSessionId, uploadSessionId),
        eq(auditProof.tenantId, tenantId),
        eq(auditProof.proofType, 'session_completed'),
        inArray(auditProof.status, ['submitted', 'confirmed']),
      ),
    )
    .limit(1)

  if (existing[0]) return

  const salt = chainEnv.GIWA_SERVER_SALT
  const tenantHash = buildSaltedHash(tenantId, salt)
  const sessionHash = buildSaltedHash(uploadSessionId, salt)
  const summaryHash = await buildChecklistSummaryHash(uploadSessionId, tenantId)

  await sendAndRecord({
    proofId: randomUUID(),
    tenantId,
    uploadSessionId,
    proofType: 'session_completed',
    txArgs: [tenantHash, sessionHash, summaryHash, BigInt(completedAt)],
    payloadHash: summaryHash,
    contractAddress: chainEnv.GIWA_CONTRACT_ADDRESS as `0x${string}`,
    rpcUrl: chainEnv.GIWA_CHAIN_RPC_URL,
    privateKey: chainEnv.GIWA_CHAIN_PRIVATE_KEY as `0x${string}`,
  })
}
