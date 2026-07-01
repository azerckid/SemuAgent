import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { extractDocumentTextChunks } from '@/lib/ai/extract'
import { generatePayrollAdaptiveStructuringProposal } from '@/lib/ai/payroll-adaptive-structuring-propose'
import type { PayrollSourceText } from '@/lib/ai/payroll-extract'
import { runPayrollAdaptiveCommonEngine } from '@/lib/payroll/adaptive-structuring-common-engine'
import { loadPayrollAdaptiveStructuringEligibilityContext } from '@/lib/payroll/adaptive-structuring-eligibility-context'
import { payrollAdaptiveStructuringProposalResponseSchema } from '@/lib/payroll/adaptive-structuring-proposal-schema'
import { derivePayrollAdaptiveModelContractFromProposal } from '@/lib/payroll/adaptive-structuring-proposal-to-contract'

export const maxDuration = 300

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { id: sessionId } = await params

    // eligibility는 클라이언트가 보낸 값을 신뢰하지 않고 세션 id만으로 서버가 다시 계산한다.
    const context = await loadPayrollAdaptiveStructuringEligibilityContext({ sessionId, tenantId })
    if (!context) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
    }

    if (!context.eligibility.eligible) {
      const notEligible = payrollAdaptiveStructuringProposalResponseSchema.parse({
        status: 'not_eligible',
        reason: context.eligibility.reason,
      })
      return NextResponse.json({ proposal: notEligible, provider: null }, { status: 200 })
    }

    const fileTextGroups = await Promise.all(
      context.sourceFiles.map(async (file): Promise<PayrollSourceText[]> => {
        try {
          const blob = await get(file.storageKey, { access: 'private' })
          if (!blob || blob.statusCode !== 200) {
            return [{ filename: file.originalFilename, text: null, summary: 'Blob 접근 실패' }]
          }
          const buffer = await new Response(blob.stream).arrayBuffer()
          const chunks = await extractDocumentTextChunks({
            fileBuffer: buffer,
            fileType: file.fileType as 'pdf' | 'excel' | 'image' | 'other',
            originalFilename: file.originalFilename,
            profile: 'payroll',
          })
          return chunks.map((chunk) => ({
            filename: file.originalFilename,
            text: chunk.text,
            summary: chunk.summary,
            chunkIndex: chunk.chunkIndex,
            chunkTotal: chunk.chunkTotal,
            sheetName: chunk.sheetName,
            rowStart: chunk.rowStart,
            rowEnd: chunk.rowEnd,
          }))
        } catch {
          return [{ filename: file.originalFilename, text: null, summary: '파일 처리 중 오류 발생' }]
        }
      }),
    )

    const fileTexts = fileTextGroups.flat()
    const readableFileTexts = fileTexts.filter((fileText) => fileText.text)

    if (readableFileTexts.length === 0) {
      const needsMoreInfo = payrollAdaptiveStructuringProposalResponseSchema.parse({
        status: 'needs_more_information',
        reason: '업로드 파일에서 텍스트를 읽지 못해 구조를 제안할 수 없습니다.',
      })
      return NextResponse.json({ proposal: needsMoreInfo, provider: null }, { status: 200 })
    }

    const { data, provider } = await generatePayrollAdaptiveStructuringProposal(readableFileTexts)

    // AI 제안이 실제 워크북에 적용되는지 결정론적 엔진으로 재실행해 검증한다(preview_only).
    // 저장은 하지 않으며, 승인/재사용은 Slice 4에서 다룬다.
    const contract = derivePayrollAdaptiveModelContractFromProposal(data)
    const enginePreview = contract ? runPayrollAdaptiveCommonEngine(contract, readableFileTexts) : null

    return NextResponse.json({ proposal: data, provider, enginePreview }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/sessions/[id]/payroll/adaptive/propose]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
