import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { extractDocumentTextChunks } from '@/lib/ai/extract'
import { generateReviewAdaptiveStructuringProposal } from '@/lib/ai/review-adaptive-structuring-propose'
import type { ReviewAdaptiveSourceText } from '@/lib/ai/review-adaptive-structuring-propose'
import { runReviewAdaptiveCommonEngine } from '@/lib/reviews/adaptive-structuring-common-engine'
import { reviewAdaptiveStructuringProposalResponseSchema } from '@/lib/reviews/adaptive-structuring-proposal-schema'
import { deriveReviewAdaptiveModelContractFromProposal } from '@/lib/reviews/adaptive-structuring-proposal-to-contract'
import { loadReviewAdaptiveStructuringEligibilityContext } from '@/lib/reviews/adaptive-structuring-eligibility-context'

export const maxDuration = 300

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantSession()
    const { id: sessionId } = await params

    // eligibility는 클라이언트가 보낸 값을 신뢰하지 않고 세션 id만으로 서버가 다시 계산한다.
    const context = await loadReviewAdaptiveStructuringEligibilityContext({ sessionId, tenantId })
    if (!context) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
    }

    if (!context.eligibility.eligible) {
      const notEligible = reviewAdaptiveStructuringProposalResponseSchema.parse({
        status: 'not_eligible',
        reason: context.eligibility.reason,
      })
      return NextResponse.json({ proposal: notEligible, provider: null }, { status: 200 })
    }

    const candidateFileIds = new Set(context.eligibility.candidateFiles.map((file) => file.id))
    const candidateSourceFiles = context.sourceFiles.filter((file) => candidateFileIds.has(file.id))

    const fileTextGroups = await Promise.all(
      candidateSourceFiles.map(async (file): Promise<ReviewAdaptiveSourceText[]> => {
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
            // 'review' profile은 시트별 chunk(sheetName/rowStart/rowEnd 포함)를 반환한다.
            // 'default' profile은 전체 시트를 한 chunk로 합쳐 sheetName을 채우지 않으므로
            // 공통엔진의 워크북 시그니처 매칭이 항상 실패한다.
            profile: 'review',
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
      const needsMoreInfo = reviewAdaptiveStructuringProposalResponseSchema.parse({
        status: 'needs_more_information',
        reason: '업로드 파일에서 텍스트를 읽지 못해 구조를 제안할 수 없습니다.',
      })
      return NextResponse.json({ proposal: needsMoreInfo, provider: null }, { status: 200 })
    }

    const { data, provider } = await generateReviewAdaptiveStructuringProposal(readableFileTexts)

    // AI 제안이 실제 워크북에 적용되는지 결정론적 엔진으로 재실행해 검증한다(preview_only).
    // status: 'proposal_ready'는 AI가 구조를 읽었다는 뜻일 뿐, enginePreview.matched가
    // true여야 그 매핑이 실제로 같은 워크북에서 재현된다는 뜻이다. 둘은 분리해서 판단해야
    // 한다 — 저장/승인/재사용(registry)은 여전히 다루지 않는다.
    const contract = deriveReviewAdaptiveModelContractFromProposal(data)
    const enginePreview = contract ? runReviewAdaptiveCommonEngine(contract, readableFileTexts) : null

    return NextResponse.json({ proposal: data, provider, enginePreview }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/sessions/[id]/review/adaptive/propose]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
